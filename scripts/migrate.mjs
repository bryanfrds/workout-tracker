// Applies db/*.sql in filename order, once each. Run with the database URL in
// the environment, e.g. `kv run --env-file .env.local -- node scripts/migrate.mjs`.
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client, neonConfig } from "@neondatabase/serverless";

const DB_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "db");

// A single advisory lock id, so two runners (two deploys, a laptop and CI) can't
// apply the same file twice. The number is arbitrary but must never change.
const LOCK_ID = 528491;

if (!process.env.DATABASE_URL) {
  // Never echo the value, here or anywhere else in this script.
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

// The HTTP driver can't hold a transaction open, so this talks WebSocket. Node 22+
// has one built in; older runtimes need the `ws` package.
if (typeof WebSocket === "undefined") {
  try {
    neonConfig.webSocketConstructor = (await import("ws")).default;
  } catch {
    console.error("No WebSocket available. Use Node 22+ or install `ws`.");
    process.exit(1);
  }
}

const client = new Client(process.env.DATABASE_URL);
await client.connect();

let failed;
try {
  // Bootstrapped here rather than in a migration file: the ledger has to exist
  // before the first file can be recorded.
  await client.query(`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const files = (await readdir(DB_DIR)).filter((f) => f.endsWith(".sql")).sort();
  const { rows } = await client.query("select filename from schema_migrations");
  const applied = new Set(rows.map((r) => r.filename));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skipped  ${file}`);
      continue;
    }

    const sql = await readFile(join(DB_DIR, file), "utf8");
    await client.query("begin");
    try {
      // Released by commit or rollback. Taken inside the transaction so it works
      // through the pooled connection string.
      await client.query("select pg_advisory_xact_lock($1)", [LOCK_ID]);

      // Re-checked under the lock: another runner may have applied it while we
      // were waiting, in which case this is a no-op rather than an error.
      const { rowCount } = await client.query("select 1 from schema_migrations where filename = $1", [file]);
      if (rowCount) {
        await client.query("commit");
        console.log(`skipped  ${file}`);
        continue;
      }

      await client.query(sql);
      await client.query("insert into schema_migrations (filename) values ($1)", [file]);
      await client.query("commit");
      console.log(`applied  ${file}`);
    } catch (err) {
      await client.query("rollback").catch(() => {});
      console.error(`failed   ${file}`);
      console.error(err instanceof Error ? err.message : err);
      failed = true;
      break; // Later files may depend on this one, so stop rather than skip ahead.
    }
  }
} finally {
  await client.end();
}

if (failed) process.exit(1);
