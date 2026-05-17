import { readFileSync } from "fs";
import { Pool } from "pg";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  family: 4,
});

// Read the migration file
const sql = readFileSync(
  new URL("../drizzle/migrations/0000_overjoyed_pepper_potts.sql", import.meta.url),
  "utf-8"
);

// Split on the drizzle statement-breakpoint marker and filter empty
const statements = sql
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

console.log(`Applying ${statements.length} SQL statements...`);

const client = await pool.connect();
try {
  await client.query("BEGIN");
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    // Use a savepoint per statement so we can rollback just that one on error
    await client.query(`SAVEPOINT sp_${i}`);
    try {
      await client.query(stmt);
      console.log(`  [${i + 1}/${statements.length}] OK`);
    } catch (err) {
      await client.query(`ROLLBACK TO SAVEPOINT sp_${i}`);
      // If the error is "already exists", skip it
      if (err.message.includes("already exists")) {
        console.log(`  [${i + 1}/${statements.length}] SKIP (already exists)`);
      } else {
        console.error(`  [${i + 1}/${statements.length}] ERROR: ${err.message}`);
        console.error(`  Statement: ${stmt.substring(0, 100)}...`);
        await client.query("ROLLBACK");
        process.exit(1);
      }
    }
  }
  await client.query("COMMIT");
  console.log("✓ Migration applied successfully!");
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
