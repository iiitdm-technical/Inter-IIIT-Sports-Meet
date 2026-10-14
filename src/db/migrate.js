import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ Error: DATABASE_URL is not set in the environment.");
    process.exit(1);
  }

  const hostname = new URL(databaseUrl).hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: isLocalhost ? false : { rejectUnauthorized: true },
  });

  const db = drizzle(pool);

  console.log("🚀 Running Drizzle migrations...");
  const migrationsFolder = path.join(__dirname, "migrations");

  try {
    await migrate(db, { migrationsFolder });
    console.log("✅ Migrations applied successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
