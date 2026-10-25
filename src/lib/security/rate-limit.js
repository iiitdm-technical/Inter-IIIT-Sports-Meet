import { sql } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { httpError } from "./request.js";

/**
 * Fixed-window rate limiting stored in MySQL so limits hold across
 * restarts and multiple app instances.
 */
export const LIMITS = {
  loginPerIp: { limit: 30, windowSeconds: 15 * 60 },
  loginPerAccount: { limit: 8, windowSeconds: 15 * 60 },
  upload: { limit: 20, windowSeconds: 60 * 60 },
  draftSave: { limit: 1500, windowSeconds: 60 * 60 },
  submit: { limit: 10, windowSeconds: 60 * 60 },
  adminWrite: { limit: 120, windowSeconds: 60 * 60 },
  download: { limit: 300, windowSeconds: 60 * 60 },
};

/**
 * Counts one hit for `key` and reports whether it is within the limit.
 * Returns { ok, count, retryAfter } where retryAfter is in seconds.
 */
export async function hit(key, { limit, windowSeconds }) {
  const db = getDb();
  const result = await db.transaction(async (tx) => {
    // The upsert serializes first hits and increments on the existing row.
    // Keep count's CASE before window_start's CASE: MySQL evaluates duplicate
    // key assignments from left to right, and both conditions must inspect the
    // old window_start before it is reset.
    await tx.execute(sql`
      INSERT INTO rate_limits (\`key\`, window_start, \`count\`)
      VALUES (${key}, UTC_TIMESTAMP(3), 1)
      ON DUPLICATE KEY UPDATE
        \`count\` = CASE
          WHEN window_start <= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ${windowSeconds} SECOND) THEN 1
          ELSE \`count\` + 1
        END,
        window_start = CASE
          WHEN window_start <= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ${windowSeconds} SECOND) THEN UTC_TIMESTAMP(3)
          ELSE window_start
        END
    `);

    // The upsert retains its exclusive row lock until this transaction ends,
    // so this read corresponds to this hit even when other app instances race.
    const [rows] = await tx.execute(sql`
      SELECT \`count\`,
        GREATEST(1, CEIL(
          TIMESTAMPDIFF(
            MICROSECOND,
            UTC_TIMESTAMP(3),
            DATE_ADD(window_start, INTERVAL ${windowSeconds} SECOND)
          ) / 1000000
        )) AS retry_after
      FROM rate_limits
      WHERE \`key\` = ${key}
    `);
    const row = rows[0];
    if (!row) throw new Error("Rate limit row disappeared during the hit transaction");
    return {
      ok: Number(row.count) <= limit,
      count: Number(row.count),
      retryAfter: Number(row.retry_after),
    };
  });

  // Occasionally clear windows that expired more than a day ago.
  if (Math.random() < 0.01) {
    db.execute(sql`DELETE FROM rate_limits WHERE window_start < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 DAY)`).catch(() => {});
  }
  return result;
}

/** Current count for `key` without adding a hit. */
export async function peek(key, { limit, windowSeconds }) {
  const db = getDb();
  const [rows] = await db.execute(sql`
    SELECT \`count\`,
      GREATEST(1, CEIL(
        TIMESTAMPDIFF(
          MICROSECOND,
          UTC_TIMESTAMP(3),
          DATE_ADD(window_start, INTERVAL ${windowSeconds} SECOND)
        ) / 1000000
      )) AS retry_after
    FROM rate_limits
    WHERE \`key\` = ${key}
      AND window_start > DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ${windowSeconds} SECOND)
  `);
  const row = rows[0];
  if (!row) return { ok: true, count: 0, retryAfter: 0 };
  return { ok: Number(row.count) < limit, count: Number(row.count), retryAfter: Number(row.retry_after) };
}

export async function reset(key) {
  await getDb().execute(sql`DELETE FROM rate_limits WHERE \`key\` = ${key}`);
}

/** Adds a hit and throws a 429 error when the limit is exceeded. */
export async function enforce(key, rule, message = "Too many requests. Please wait and try again.") {
  const result = await hit(key, rule);
  if (!result.ok) throw httpError(429, message, { retryAfter: result.retryAfter });
  return result;
}
