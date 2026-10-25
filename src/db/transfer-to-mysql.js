import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isIP } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";
import mysql from "mysql2/promise";
import { getDatabasePoolOptions } from "./index.js";
import {
  TRANSFER_TABLES,
  canonicalizeJson,
  createRowsChecksum,
  normalizeColumnValue,
  normalizeTimestamp,
  parseTransferArguments,
} from "./transfer-utils.js";

const { Client } = pg;
const SAFE_TABLE_NAMES = TRANSFER_TABLES.map(({ name }) => name);
const EXPECTED_MYSQL_COLLATION = "utf8mb4_0900_bin";
const MAX_SIGNED_MYSQL_INT = 2_147_483_647n;

class TransferError extends Error {}

function quotePgIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function quoteMysqlIdentifier(identifier) {
  return `\`${identifier.replaceAll("`", "``")}\``;
}

function stripIpv6Brackets(hostname) {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
}

function isLocalHost(hostname) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname.toLowerCase());
}

function decodeUrlPart(part, variableName) {
  try {
    return decodeURIComponent(part);
  } catch {
    throw new TransferError(`${variableName} contains invalid URL encoding.`);
  }
}

function parseDatabaseUrl(raw, variableName, protocols, defaultPort) {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new TransferError(`${variableName} is required. This tool does not load .env files or fall back to DATABASE_URL.`);
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new TransferError(`${variableName} must be a valid database URL.`);
  }
  if (!protocols.includes(parsed.protocol)) {
    throw new TransferError(`${variableName} must use ${protocols.join(" or ")} protocol.`);
  }

  const host = stripIpv6Brackets(parsed.hostname);
  const port = parsed.port ? Number(parsed.port) : defaultPort;
  const database = decodeUrlPart(parsed.pathname.replace(/^\//, ""), variableName);
  const user = decodeUrlPart(parsed.username, variableName);
  const password = decodeUrlPart(parsed.password, variableName);
  if (!host || !database || !user) {
    throw new TransferError(`${variableName} must include a host, database name, and username.`);
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new TransferError(`${variableName} has an invalid port.`);
  }
  return { host, port, database, user, password, local: isLocalHost(host) };
}

async function readOptionalCa(variableName, environment) {
  const filePath = environment[variableName];
  if (!filePath) return undefined;
  try {
    return await readFile(path.resolve(filePath), "utf8");
  } catch {
    throw new TransferError(`${variableName} could not be read.`);
  }
}

async function makeConnectionSettings(environment = process.env) {
  const sourceUrl = parseDatabaseUrl(
    environment.SOURCE_DATABASE_URL,
    "SOURCE_DATABASE_URL",
    ["postgres:", "postgresql:"],
    5432,
  );
  const targetConnection = getTransferTargetConnectionOptions(environment.TARGET_DATABASE_URL, {
    tlsMode: environment.MYSQL_TLS_MODE,
  });
  if (!sourceUrl.local && isIP(sourceUrl.host)) {
    throw new TransferError("SOURCE_DATABASE_URL must use a DNS hostname for verified remote TLS.");
  }
  if (!isLocalHost(targetConnection.host) && isIP(targetConnection.host)) {
    throw new TransferError("TARGET_DATABASE_URL must use a DNS hostname for verified remote TLS.");
  }

  const [sourceCa, targetCa] = await Promise.all([
    readOptionalCa("SOURCE_POSTGRES_CA_FILE", environment),
    readOptionalCa("TARGET_MYSQL_CA_FILE", environment),
  ]);
  const sourceSsl = sourceUrl.local && !sourceCa
    ? false
    : { rejectUnauthorized: true, ...(sourceCa ? { ca: sourceCa } : {}) };
  if (targetCa) {
    if (targetConnection.ssl === false) {
      throw new TransferError("TARGET_MYSQL_CA_FILE requires MYSQL_TLS_MODE=verify or require.");
    }
    targetConnection.ssl = { ...targetConnection.ssl, ca: targetCa };
  }

  return {
    source: {
      host: sourceUrl.host,
      port: sourceUrl.port,
      user: sourceUrl.user,
      password: sourceUrl.password,
      database: sourceUrl.database,
      ssl: sourceSsl,
      application_name: "inter-iiit-postgres-to-mysql-transfer",
      connectionTimeoutMillis: 15_000,
      keepAlive: true,
    },
    target: {
      ...targetConnection,
      timezone: "Z",
      dateStrings: true,
      supportBigNumbers: true,
      bigNumberStrings: true,
      connectTimeout: 15_000,
      multipleStatements: false,
    },
    targetLockHash: createHash("sha256")
      .update(`${targetConnection.host}:${targetConnection.port}/${targetConnection.database}`)
      .digest("hex")
      .slice(0, 40),
  };
}

/**
 * Reuse the application pool's TLS policy so transfer and runtime connections
 * honor MYSQL_TLS_MODE identically. Only transfer-specific connection options
 * are added here; TLS policy is never silently weakened in this script.
 */
export function getTransferTargetConnectionOptions(databaseUrl, { tlsMode } = {}) {
  let options;
  try {
    options = { ...getDatabasePoolOptions(databaseUrl, { tlsMode }) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/^MYSQL_TLS_MODE\b/.test(message)) throw new TransferError(message);
    if (/^DATABASE_URL\b/.test(message)) {
      throw new TransferError(message.replaceAll("DATABASE_URL", "TARGET_DATABASE_URL"));
    }
    throw new TransferError("TARGET_DATABASE_URL is not a valid MySQL connection URL.");
  }
  if (!options.host || !options.database || !options.user) {
    throw new TransferError("TARGET_DATABASE_URL must include a host, database name, and username.");
  }
  // Pool-only settings are not needed by createConnection.
  delete options.connectionLimit;
  delete options.waitForConnections;
  return options;
}

function createPostgresClient(options) {
  // node-postgres otherwise falls back to PGPASSWORD / .pgpass when URL password is empty.
  // A password callback makes the explicit SOURCE_DATABASE_URL authoritative, including empty.
  const explicitPassword = options.password;
  return new Client({ ...options, password: async () => explicitPassword });
}

function assertSourceColumnType(column, metadata) {
  const expectedType = {
    integer: "integer",
    varchar: "character varying",
    text: "text",
    boolean: "boolean",
    timestamp: "timestamp with time zone",
    json: "jsonb",
  }[column.type];
  const actualType = column.type === "json" ? metadata.udt_name : metadata.data_type;
  if (actualType !== expectedType) return false;
  if (column.type === "varchar" && Number(metadata.character_maximum_length) !== column.length) return false;
  return metadata.is_nullable === (column.nullable ? "YES" : "NO");
}

async function validateSourceSchema(source) {
  const names = SAFE_TABLE_NAMES;
  const result = await source.query(`
    SELECT table_name, column_name, data_type, udt_name, is_nullable, character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ANY($1::text[])
  `, [names]);
  const actual = new Map(result.rows.map((row) => [`${row.table_name}.${row.column_name}`, row]));

  for (const table of TRANSFER_TABLES) {
    const expectedNames = new Set(table.columns.map(({ name }) => name));
    const actualNames = new Set(result.rows.filter((row) => row.table_name === table.name).map(({ column_name }) => column_name));
    for (const name of expectedNames) {
      const metadata = actual.get(`${table.name}.${name}`);
      const definition = table.columns.find((column) => column.name === name);
      if (!metadata || !assertSourceColumnType(definition, metadata)) {
        throw new TransferError(`PostgreSQL source schema mismatch at ${table.name}.${name}; transfer stopped without copying data.`);
      }
    }
    for (const name of actualNames) {
      if (!expectedNames.has(name)) {
        throw new TransferError(`PostgreSQL source has an unmapped column in ${table.name}; transfer stopped without copying data.`);
      }
    }
  }

  const primaryKeys = await source.query(`
    SELECT tc.table_name, kcu.column_name, kcu.ordinal_position
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_catalog = kcu.constraint_catalog
      AND tc.constraint_schema = kcu.constraint_schema
      AND tc.constraint_name = kcu.constraint_name
      AND tc.table_name = kcu.table_name
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = ANY($1::text[])
    ORDER BY tc.table_name, kcu.ordinal_position
  `, [names]);
  const sourceKeys = new Map();
  for (const row of primaryKeys.rows) {
    const key = sourceKeys.get(row.table_name) ?? [];
    key.push(row.column_name);
    sourceKeys.set(row.table_name, key);
  }
  for (const table of TRANSFER_TABLES) {
    if (JSON.stringify(sourceKeys.get(table.name) ?? []) !== JSON.stringify([table.primaryKey])) {
      throw new TransferError(`PostgreSQL source primary key mismatch in ${table.name}; transfer stopped without copying data.`);
    }
  }
}

function targetTypeMatches(column, metadata) {
  const dataType = metadata.data_type.toLowerCase();
  const columnType = metadata.column_type.toLowerCase();
  switch (column.type) {
    case "integer":
      return dataType === "int" && /^(?:int|int\(11\))$/.test(columnType);
    case "varchar":
      return dataType === "varchar" && Number(metadata.character_maximum_length) === column.length;
    case "text":
      return dataType === "text";
    case "boolean":
      return dataType === "tinyint" && columnType === "tinyint(1)";
    case "timestamp":
      return dataType === "datetime" && Number(metadata.datetime_precision) === 6;
    case "json":
      return dataType === "json";
    default:
      return false;
  }
}

function tupleKey(parts) {
  return JSON.stringify(parts);
}

// MySQL exposes information_schema labels in provider-dependent casing, even
// when the SELECT spells the identifiers in lowercase. Normalize metadata
// labels only; application values and JSON keys must remain byte-for-byte.
async function executeMetadata(target, query, parameters) {
  const [rows, fields] = await target.execute(query, parameters);
  return [rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]))), fields];
}

async function validateTargetSchema(target) {
  const placeholders = SAFE_TABLE_NAMES.map(() => "?").join(", ");
  const [tableRows] = await executeMetadata(target, `
    SELECT table_name, engine, table_collation
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name IN (${placeholders})
  `, SAFE_TABLE_NAMES);
  const tablesByName = new Map(tableRows.map((row) => [row.table_name, row]));

  const [triggerRows] = await executeMetadata(target, `
    SELECT event_object_table
    FROM information_schema.triggers
    WHERE trigger_schema = DATABASE() AND event_object_table IN (${placeholders})
  `, SAFE_TABLE_NAMES);
  if (triggerRows.length > 0) {
    throw new TransferError("MySQL target application tables must not have triggers during transfer.");
  }

  const [columnRows] = await executeMetadata(target, `
    SELECT table_name, column_name, data_type, column_type, is_nullable,
           character_maximum_length, datetime_precision, character_set_name,
           collation_name, extra
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name IN (${placeholders})
  `, SAFE_TABLE_NAMES);
  const columnsByTable = new Map();
  for (const metadata of columnRows) {
    const columns = columnsByTable.get(metadata.table_name) ?? new Map();
    columns.set(metadata.column_name, metadata);
    columnsByTable.set(metadata.table_name, columns);
  }

  for (const table of TRANSFER_TABLES) {
    const tableMetadata = tablesByName.get(table.name);
    if (!tableMetadata) throw new TransferError(`MySQL target is missing required table ${table.name}.`);
    if (String(tableMetadata.engine).toLowerCase() !== "innodb") {
      throw new TransferError(`MySQL target table ${table.name} must use InnoDB for transactional rollback.`);
    }
    if (String(tableMetadata.table_collation).toLowerCase() !== EXPECTED_MYSQL_COLLATION) {
      throw new TransferError(`MySQL target table ${table.name} must use ${EXPECTED_MYSQL_COLLATION}.`);
    }

    const actualColumns = columnsByTable.get(table.name) ?? new Map();
    const expectedNames = new Set(table.columns.map(({ name }) => name));
    for (const column of table.columns) {
      const metadata = actualColumns.get(column.name);
      if (!metadata || !targetTypeMatches(column, metadata)) {
        throw new TransferError(`MySQL target schema mismatch at ${table.name}.${column.name}.`);
      }
      if (metadata.is_nullable !== (column.nullable ? "YES" : "NO")) {
        throw new TransferError(`MySQL target nullability mismatch at ${table.name}.${column.name}.`);
      }
      if (column.type === "varchar" || column.type === "text") {
        if (String(metadata.character_set_name).toLowerCase() !== "utf8mb4"
          || String(metadata.collation_name).toLowerCase() !== EXPECTED_MYSQL_COLLATION) {
          throw new TransferError(`MySQL target text collation mismatch at ${table.name}.${column.name}.`);
        }
      }
      const hasAutoIncrement = String(metadata.extra).toLowerCase().includes("auto_increment");
      if (hasAutoIncrement !== (table.autoIncrement && column.name === "id")) {
        throw new TransferError(`MySQL target auto-increment mismatch at ${table.name}.${column.name}.`);
      }
      if (/\b(?:virtual|stored) generated\b/i.test(String(metadata.extra))) {
        throw new TransferError(`Generated columns are not supported in MySQL target table ${table.name}.`);
      }
    }
    for (const name of actualColumns.keys()) {
      if (!expectedNames.has(name)) throw new TransferError(`MySQL target has an unmapped column in ${table.name}.`);
    }
  }

  const [primaryRows] = await executeMetadata(target, `
    SELECT table_name, column_name, seq_in_index
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name IN (${placeholders}) AND index_name = 'PRIMARY'
    ORDER BY table_name, seq_in_index
  `, SAFE_TABLE_NAMES);
  const primaryKeys = new Map();
  for (const row of primaryRows) {
    const keys = primaryKeys.get(row.table_name) ?? [];
    keys.push(row.column_name);
    primaryKeys.set(row.table_name, keys);
  }
  for (const table of TRANSFER_TABLES) {
    if (JSON.stringify(primaryKeys.get(table.name) ?? []) !== JSON.stringify([table.primaryKey])) {
      throw new TransferError(`MySQL target primary key mismatch in ${table.name}.`);
    }
  }

  const [indexRows] = await executeMetadata(target, `
    SELECT table_name, index_name, non_unique, seq_in_index, column_name
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name IN (${placeholders})
    ORDER BY table_name, index_name, seq_in_index
  `, SAFE_TABLE_NAMES);
  const uniqueKeys = new Map();
  for (const row of indexRows) {
    if (Number(row.non_unique) !== 0 || row.index_name === "PRIMARY") continue;
    const key = `${row.table_name}:${row.index_name}`;
    const columns = uniqueKeys.get(key) ?? [];
    columns.push(row.column_name);
    uniqueKeys.set(key, columns);
  }
  const uniqueTupleSet = new Set([...uniqueKeys.entries()].map(([key, columns]) => {
    const tableName = key.slice(0, key.indexOf(":"));
    return tupleKey([tableName, ...columns]);
  }));
  for (const table of TRANSFER_TABLES) {
    for (const uniqueKey of table.uniqueKeys) {
      if (!uniqueTupleSet.has(tupleKey([table.name, ...uniqueKey]))) {
        throw new TransferError(`MySQL target is missing a required unique key in ${table.name}.`);
      }
    }
  }

  const [foreignRows] = await executeMetadata(target, `
    SELECT table_name, column_name, referenced_table_name, referenced_column_name
    FROM information_schema.key_column_usage
    WHERE table_schema = DATABASE() AND table_name IN (${placeholders})
      AND referenced_table_name IS NOT NULL
  `, SAFE_TABLE_NAMES);
  const actualForeignKeys = new Set(foreignRows.map((row) => tupleKey([
    row.table_name, row.column_name, row.referenced_table_name, row.referenced_column_name,
  ])));
  const expectedForeignKeys = new Set();
  for (const table of TRANSFER_TABLES) {
    for (const foreignKey of table.foreignKeys) {
      expectedForeignKeys.add(tupleKey([
        table.name, foreignKey.column, foreignKey.referencedTable, foreignKey.referencedColumn,
      ]));
    }
  }
  if (actualForeignKeys.size !== expectedForeignKeys.size
    || [...expectedForeignKeys].some((key) => !actualForeignKeys.has(key))) {
    throw new TransferError("MySQL target foreign keys do not match the reviewed transfer mapping.");
  }
}

async function assertTargetIntegrityChecks(target) {
  const [rows] = await target.execute(`
    SELECT @@SESSION.foreign_key_checks AS foreign_key_checks,
           @@SESSION.unique_checks AS unique_checks
  `);
  if (Number(rows[0]?.foreign_key_checks) !== 1 || Number(rows[0]?.unique_checks) !== 1) {
    throw new TransferError("MySQL target must have foreign_key_checks and unique_checks enabled; no integrity checks are disabled by this tool.");
  }
}

async function readTableCounts(connection, dialect) {
  const counts = new Map();
  for (const table of TRANSFER_TABLES) {
    const name = dialect === "postgres" ? quotePgIdentifier(table.name) : quoteMysqlIdentifier(table.name);
    const sql = dialect === "postgres"
      ? `SELECT COUNT(*)::text AS row_count FROM public.${name}`
      : `SELECT CAST(COUNT(*) AS CHAR) AS row_count FROM ${name}`;
    const result = dialect === "postgres"
      ? (await connection.query(sql)).rows[0]
      : (await connection.execute(sql))[0][0];
    counts.set(table.name, BigInt(result.row_count));
  }
  return counts;
}

function printCounts(title, sourceCounts, targetCounts) {
  console.log(`\n${title}`);
  console.log(`${"Table".padEnd(36)} ${"PostgreSQL".padStart(14)} ${"MySQL".padStart(14)}`);
  for (const table of TRANSFER_TABLES) {
    const sourceCount = sourceCounts.get(table.name);
    const targetCount = targetCounts.get(table.name);
    console.log(`${table.name.padEnd(36)} ${formatCount(sourceCount).padStart(14)} ${formatCount(targetCount).padStart(14)}`);
  }
}

function formatCount(value) {
  return value.toLocaleString("en-US");
}

async function validateTimestampRange(source) {
  const issues = [];
  for (const table of TRANSFER_TABLES) {
    const timestampColumns = table.columns.filter(({ type }) => type === "timestamp");
    if (timestampColumns.length === 0) continue;

    const expressions = [];
    for (const column of timestampColumns) {
      const name = quotePgIdentifier(column.name);
      expressions.push(`COUNT(*) FILTER (
        WHERE ${name} IS NOT NULL
          AND (${name} < TIMESTAMPTZ '1000-01-01 00:00:00+00'
            OR ${name} >= TIMESTAMPTZ '10000-01-01 00:00:00+00')
      )::text AS ${quotePgIdentifier(`${column.name}_out_of_range`)}`);
    }
    const result = await source.query(`SELECT ${expressions.join(", ")} FROM public.${quotePgIdentifier(table.name)}`);
    for (const column of timestampColumns) {
      const outOfRange = BigInt(result.rows[0][`${column.name}_out_of_range`]);
      if (outOfRange > 0n) issues.push({ table: table.name, column: column.name, rows: outOfRange, kind: "outside MySQL DATETIME range" });
    }
  }
  return issues;
}

function timestampIssueMessage(issues) {
  const details = issues.map(({ table, column, rows, kind }) => `${table}.${column}: ${formatCount(rows)} row(s) ${kind}`).join("; ");
  return `Source timestamps cannot be represented losslessly as MySQL DATETIME(6): ${details}. No rows were copied.`;
}

function pgColumnExpression(column) {
  const name = quotePgIdentifier(column.name);
  if (column.type === "timestamp") {
    return `to_char(${name} AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') AS ${name}`;
  }
  if (column.type === "json") return `${name}::text AS ${name}`;
  return name;
}

function mysqlColumnExpression(column) {
  const name = quoteMysqlIdentifier(column.name);
  if (column.type === "timestamp") return `DATE_FORMAT(${name}, '%Y-%m-%d %H:%i:%s.%f') AS ${name}`;
  if (column.type === "json") return `CAST(${name} AS CHAR CHARACTER SET utf8mb4) AS ${name}`;
  return name;
}

function buildPgPageQuery(table, cursor, limit) {
  const keyColumn = table.columns.find(({ name }) => name === table.primaryKey);
  const key = quotePgIdentifier(table.primaryKey);
  const selection = table.columns.map(pgColumnExpression).join(", ");
  const stringKey = keyColumn.type === "varchar" || keyColumn.type === "text";
  const where = cursor === null
    ? ""
    : stringKey
      ? `WHERE convert_to(${key}, 'UTF8') > convert_to($1::text, 'UTF8')`
      : `WHERE ${key} > $1`;
  const limitParameter = cursor === null ? "$1" : "$2";
  const query = `SELECT ${selection} FROM public.${quotePgIdentifier(table.name)} ${where}
    ORDER BY ${stringKey ? `convert_to(${key}, 'UTF8')` : key} ASC LIMIT ${limitParameter}`;
  return { query, parameters: cursor === null ? [limit] : [cursor, limit] };
}

function buildMysqlPageQuery(table, cursor, limit) {
  const keyColumn = table.columns.find(({ name }) => name === table.primaryKey);
  const key = quoteMysqlIdentifier(table.primaryKey);
  const selection = table.columns.map(mysqlColumnExpression).join(", ");
  const stringKey = keyColumn.type === "varchar" || keyColumn.type === "text";
  const where = cursor === null
    ? ""
    : stringKey
      ? `WHERE BINARY ${key} > BINARY ?`
      : `WHERE ${key} > ?`;
  return {
    query: `SELECT ${selection} FROM ${quoteMysqlIdentifier(table.name)} ${where}
      ORDER BY ${stringKey ? `BINARY ${key}` : key} ASC LIMIT ?`,
    parameters: cursor === null ? [limit] : [cursor, limit],
  };
}

function mysqlInsertValue(column, value) {
  if (value === null) return null;
  if (column.type === "timestamp") {
    return normalizeTimestamp(value).replace("T", " ").replace(/Z$/, "");
  }
  if (column.type === "json") {
    canonicalizeJson(value); // Validate it without converting exact decimal values through JS Number.
    return value;
  }
  return normalizeColumnValue(column, value);
}

function updateMaxId(maxIds, table, row) {
  if (!table.autoIncrement) return;
  const id = BigInt(row.id);
  const currentMaximum = maxIds.get(table.name);
  if (currentMaximum === undefined || id > currentMaximum) maxIds.set(table.name, id);
}

async function copyTable(source, target, table, batchSize, maxIds) {
  const checksums = createRowsChecksum(table);
  let cursor = null;
  while (true) {
    const page = buildPgPageQuery(table, cursor, batchSize);
    const rows = (await source.query(page.query, page.parameters)).rows;
    if (rows.length === 0) break;

    const columnNames = table.columns.map(({ name }) => name);
    const values = [];
    const rowPlaceholders = rows.map((row) => {
      checksums.update(row);
      updateMaxId(maxIds, table, row);
      for (const column of table.columns) values.push(mysqlInsertValue(column, row[column.name]));
      return `(${table.columns.map(() => "?").join(", ")})`;
    });
    const insertSql = `INSERT INTO ${quoteMysqlIdentifier(table.name)} (${columnNames.map(quoteMysqlIdentifier).join(", ")}) VALUES ${rowPlaceholders.join(", ")}`;
    await target.execute(insertSql, values);
    cursor = rows[rows.length - 1][table.primaryKey];
  }
  return checksums;
}

async function checksumSourceTable(source, table, batchSize) {
  const checksums = createRowsChecksum(table);
  let cursor = null;
  while (true) {
    const page = buildPgPageQuery(table, cursor, batchSize);
    const rows = (await source.query(page.query, page.parameters)).rows;
    if (rows.length === 0) break;
    for (const row of rows) checksums.update(row);
    cursor = rows[rows.length - 1][table.primaryKey];
  }
  return checksums;
}

async function checksumTargetTable(target, table, batchSize) {
  const checksums = createRowsChecksum(table);
  let cursor = null;
  while (true) {
    const page = buildMysqlPageQuery(table, cursor, batchSize);
    const [rows] = await target.execute(page.query, page.parameters);
    if (rows.length === 0) break;
    for (const row of rows) checksums.update(row);
    cursor = rows[rows.length - 1][table.primaryKey];
  }
  return checksums;
}

async function acquireTargetLock(target, lockHash) {
  const [rows] = await target.execute("SELECT GET_LOCK(?, 0) AS acquired", [`inter-iiit-transfer:${lockHash}`]);
  if (Number(rows[0]?.acquired) !== 1) {
    throw new TransferError("Another transfer tool instance is using this MySQL database; no data was copied.");
  }
}

async function releaseTargetLock(target, lockHash) {
  try {
    await target.execute("SELECT RELEASE_LOCK(?)", [`inter-iiit-transfer:${lockHash}`]);
  } catch {
    // The connection is closed immediately afterward; never log connection details.
  }
}

async function readAutoIncrementMetadata(target) {
  const autoIncrementTables = TRANSFER_TABLES.filter(({ autoIncrement }) => autoIncrement).map(({ name }) => name);
  const placeholders = autoIncrementTables.map(() => "?").join(", ");
  const [rows] = await executeMetadata(target, `
    SELECT table_name, auto_increment
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name IN (${placeholders})
  `, autoIncrementTables);
  return new Map(rows.map((row) => [row.table_name, row.auto_increment == null ? null : BigInt(row.auto_increment)]));
}

function printAutoIncrementMetadata(maxIds, nextIds) {
  console.log("\nMySQL next AUTO_INCREMENT values:");
  for (const table of TRANSFER_TABLES.filter(({ autoIncrement }) => autoIncrement)) {
    const next = nextIds.get(table.name);
    const max = maxIds.get(table.name);
    const nextText = next === null || next === undefined ? "unavailable" : next.toString();
    const maxText = max === undefined ? "no imported IDs" : `max imported ID ${max.toString()}`;
    console.log(`  ${table.name}: ${nextText} (${maxText})`);
  }
}

async function runTransfer(options) {
  const settings = await makeConnectionSettings();
  const source = createPostgresClient(settings.source);
  let target;
  let sourceConnected = false;
  let targetConnected = false;
  let sourceTransaction = false;
  let targetTransaction = false;
  let targetLock = false;
  let targetCommitAttempted = false;
  let targetCommitted = false;

  console.log(options.apply
    ? "SAFE PostgreSQL → MySQL transfer (APPLY)"
    : "SAFE PostgreSQL → MySQL transfer (READ-ONLY DRY RUN)");
  console.log("All nine allowlisted application tables are included; Drizzle migration history is intentionally excluded.");
  console.log("Payment proof pathname values are preserved; payment files remain in Neon S3/Object Storage and are not copied or deleted.");
  console.log("Session hashes are copied unchanged. Keep the application SESSION_SECRET unchanged.");
  if (settings.target.ssl && settings.target.ssl.rejectUnauthorized === false) {
    console.warn("WARNING: MySQL TLS is encryption-only (MYSQL_TLS_MODE=require); the server certificate is not verified and an active MITM can intercept traffic.");
  }
  if (options.apply) {
    console.warn("WARNING: --writes-frozen is an operator assertion only. This tool does not freeze source writes or perform a live cutover.");
    console.warn("WARNING: use a dedicated, otherwise idle MySQL target; a single PostgreSQL snapshot does not by itself capture writes committed later.");
  } else {
    console.log("No rows will be written. PostgreSQL is read in a consistent read-only REPEATABLE READ snapshot.");
  }

  try {
    await source.connect();
    sourceConnected = true;
    target = await mysql.createConnection(settings.target);
    targetConnected = true;
    await target.query("SET SESSION time_zone = '+00:00'");
    // MySQL normally treats an explicit 0 in an AUTO_INCREMENT column as a request for a new ID.
    // Keep source ID 0 intact without changing the server's global SQL mode.
    await target.query("SET SESSION sql_mode = IF(FIND_IN_SET('NO_AUTO_VALUE_ON_ZERO', @@SESSION.sql_mode) > 0, @@SESSION.sql_mode, CONCAT_WS(',', NULLIF(@@SESSION.sql_mode, ''), 'NO_AUTO_VALUE_ON_ZERO'))");
    await assertTargetIntegrityChecks(target);

    await source.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    sourceTransaction = true;
    await source.query("SET LOCAL TIME ZONE 'UTC'");

    await validateSourceSchema(source);
    await validateTargetSchema(target);

    const sourceCounts = await readTableCounts(source, "postgres");
    const timestampIssues = await validateTimestampRange(source);
    let targetCounts;

    if (options.apply) {
      await acquireTargetLock(target, settings.targetLockHash);
      targetLock = true;
      await target.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      await target.beginTransaction();
      targetTransaction = true;
      targetCounts = await readTableCounts(target, "mysql");
    } else {
      await target.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      await target.query("START TRANSACTION READ ONLY");
      targetTransaction = true;
      targetCounts = await readTableCounts(target, "mysql");
    }

    printCounts(options.apply ? "Counts before copy" : "Read-only snapshot counts", sourceCounts, targetCounts);

    if (options.apply) {
      const nonEmptyTables = TRANSFER_TABLES.filter(({ name }) => targetCounts.get(name) !== 0n);
      if (nonEmptyTables.length > 0) {
        throw new TransferError(`MySQL target is not empty (${nonEmptyTables.map(({ name }) => name).join(", ")}); --apply refuses to merge or overwrite data.`);
      }
    }
    if (timestampIssues.length > 0) throw new TransferError(timestampIssueMessage(timestampIssues));

    if (!options.apply) {
      const mismatches = [];
      for (const table of TRANSFER_TABLES) {
        if (sourceCounts.get(table.name) !== targetCounts.get(table.name)) {
          console.log(`Checksum ${table.name}: skipped (row counts differ).`);
          continue;
        }
        const [sourceChecksums, targetChecksums] = await Promise.all([
          checksumSourceTable(source, table, options.batchSize),
          checksumTargetTable(target, table, options.batchSize),
        ]);
        const sourceDigest = sourceChecksums.finish();
        const targetDigest = targetChecksums.finish();
        if (sourceChecksums.rowCount !== targetChecksums.rowCount || sourceDigest !== targetDigest) {
          mismatches.push(table.name);
          console.log(`Checksum ${table.name}: MISMATCH.`);
        } else {
          // For equal counts, canonical row checksums verify every copied value without logging data.
          console.log(`Checksum ${table.name}: PASS (${formatCount(sourceCounts.get(table.name))} row(s)).`);
        }
      }
      if (mismatches.length > 0) {
        throw new TransferError(`Read-only row checksum verification failed for: ${mismatches.join(", ")}. No rows were written.`);
      }
      await target.commit();
      targetTransaction = false;
      await source.query("COMMIT");
      sourceTransaction = false;
      console.log("Dry run complete. No data was changed.");
      return;
    }

    const sourceChecksums = new Map();
    const maxIds = new Map();
    for (const table of TRANSFER_TABLES) {
      const checksums = await copyTable(source, target, table, options.batchSize, maxIds);
      if (checksums.rowCount !== sourceCounts.get(table.name)) {
        throw new TransferError(`Source row count changed within its snapshot for ${table.name}; target transaction will be rolled back.`);
      }
      sourceChecksums.set(table.name, checksums);
      console.log(`Copied ${table.name}: ${formatCount(sourceCounts.get(table.name))} row(s).`);
    }

    const copiedCounts = await readTableCounts(target, "mysql");
    for (const table of TRANSFER_TABLES) {
      if (copiedCounts.get(table.name) !== sourceCounts.get(table.name)) {
        throw new TransferError(`Row count verification failed for ${table.name}; target transaction will be rolled back.`);
      }
    }

    for (const table of TRANSFER_TABLES) {
      const targetChecksums = await checksumTargetTable(target, table, options.batchSize);
      const sourceTableChecksums = sourceChecksums.get(table.name);
      if (targetChecksums.rowCount !== sourceCounts.get(table.name)
        || sourceTableChecksums.finish() !== targetChecksums.finish()) {
        throw new TransferError(`Canonical row checksum verification failed for ${table.name}; target transaction will be rolled back.`);
      }
      console.log(`Verified ${table.name}: row count and canonical checksum match.`);
    }

    // Finish the read-only source snapshot before committing the verified destination transaction.
    await source.query("COMMIT");
    sourceTransaction = false;
    targetCommitAttempted = true;
    await target.commit();
    targetTransaction = false;
    targetCommitted = true;

    try {
      const autoIncrementAfterCommit = await readAutoIncrementMetadata(target);
      printAutoIncrementMetadata(maxIds, autoIncrementAfterCommit);
      for (const [tableName, maxId] of maxIds) {
        if (maxId === MAX_SIGNED_MYSQL_INT) {
          console.warn(`WARNING: ${tableName} reached the signed INT ID ceiling; both source and target need an ID type migration before further inserts.`);
          continue;
        }
        const nextId = autoIncrementAfterCommit.get(tableName);
        if (nextId === null || nextId === undefined || nextId <= maxId) {
          console.warn(`WARNING: committed data is intact, but verify the next AUTO_INCREMENT value for ${tableName} before enabling writers.`);
        }
      }
    } catch {
      console.warn("WARNING: transfer committed, but post-commit AUTO_INCREMENT metadata could not be read; verify it before enabling writers.");
    }
    console.log("Transfer committed. The destination contains a snapshot; this did not perform a live cutover or copy Neon S3 objects.");
  } catch (error) {
    if (targetTransaction && targetConnected) {
      try {
        await target.rollback();
      } catch {
        // Report only the original, sanitized failure.
      }
      targetTransaction = false;
    }
    if (sourceTransaction && sourceConnected) {
      try {
        await source.query("ROLLBACK");
      } catch {
        // Report only the original, sanitized failure.
      }
      sourceTransaction = false;
    }
    const safeMessage = error instanceof TransferError
      ? error.message
      : `unexpected database or transfer error${error?.code && /^[A-Z0-9_]+$/.test(error.code) ? ` (${error.code})` : " (details withheld)"}`;
    console.error(`Transfer aborted: ${safeMessage}`);
    if (targetCommitAttempted && !targetCommitted) {
      console.error("The MySQL commit response may be ambiguous. Do not rerun --apply until a read-only dry run verifies the target.");
    }
    process.exitCode = 1;
  } finally {
    if (targetLock && targetConnected) await releaseTargetLock(target, settings.targetLockHash);
    if (targetConnected) {
      try {
        await target.end();
      } catch {
        // Do not surface driver messages that could contain connection details.
      }
    }
    if (sourceConnected) {
      try {
        await source.end();
      } catch {
        // Do not surface driver messages that could contain connection details.
      }
    }
  }
}

function printHelp() {
  console.log(`Usage: node src/db/transfer-to-mysql.js [--apply --writes-frozen] [--batch-size N]

Default mode is read-only: it checks the allowlisted schemas, reads PostgreSQL
from a REPEATABLE READ / READ ONLY snapshot, reports source and target counts,
and checks canonical row checksums for tables whose counts match.

Required environment variables (no .env files are loaded):
  SOURCE_DATABASE_URL   PostgreSQL connection URL
  TARGET_DATABASE_URL   MySQL connection URL

Optional verified-CA files:
  SOURCE_POSTGRES_CA_FILE
  TARGET_MYSQL_CA_FILE

MySQL target TLS uses the shared MYSQL_TLS_MODE policy: verify (default for
remote hosts, verifies certificate and identity) or require (encrypted but
does not authenticate the server; vulnerable to an active MITM).

Copy only after independently freezing all source writes, with explicit flags:
  node src/db/transfer-to-mysql.js --apply --writes-frozen

--writes-frozen is an operator acknowledgment, not a database write freeze.
The destination must be dedicated and empty in every allowlisted application
table. The tool never disables foreign keys, truncates, drops, or merges rows.
Payment proof objects remain in Neon S3/Object Storage; only their pathname
values are copied. Drizzle migration history is intentionally not copied.`);
}

async function main() {
  let options;
  try {
    options = parseTransferArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`Invalid transfer options: ${error.message}`);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    printHelp();
    return;
  }
  try {
    await runTransfer(options);
  } catch (error) {
    const safeMessage = error instanceof TransferError
      ? error.message
      : `unexpected setup error${error?.code && /^[A-Z0-9_]+$/.test(error.code) ? ` (${error.code})` : " (details withheld)"}`;
    console.error(`Transfer aborted: ${safeMessage}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
