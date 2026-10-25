import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabasePool } from "./index.js";

const directory = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set in the environment.");

  const pool = createDatabasePool(databaseUrl);
  try {
    const db = drizzle(pool);
    console.log("Running MySQL Drizzle migrations...");
    await migrate(db, { migrationsFolder: path.join(directory, "migrations") });
    console.log("MySQL migrations applied successfully.");
  } finally {
    await pool.end();
  }
}

runMigrations().catch((error) => {
  console.error("MySQL migration failed:", error.message);
  process.exitCode = 1;
});
