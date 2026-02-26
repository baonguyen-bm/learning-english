import pg from "pg";
import { readFileSync } from "fs";
import { config } from "dotenv";

config({ path: ".env.local" });

const dbPassword = process.argv[2] || process.env.SUPABASE_DB_PASSWORD;

if (!dbPassword) {
  console.error(
    "Usage: node scripts/migrate.mjs <database-password>\n" +
      "Find it in Supabase Dashboard → Settings → Database → Connection string"
  );
  process.exit(1);
}

const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];

const client = new pg.Client({
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: dbPassword,
  ssl: { rejectUnauthorized: false },
});

try {
  console.log(`Connecting to db.${projectRef}.supabase.co ...`);
  await client.connect();
  console.log("Connected.\n");

  const sql = readFileSync("supabase/migrations/20260226_initial_schema.sql", "utf-8");
  console.log("Running migration...");
  await client.query(sql);
  console.log("Migration complete.\n");

  const { rows } = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  console.log("Tables created:", rows.map((r) => r.table_name).join(", "));
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
