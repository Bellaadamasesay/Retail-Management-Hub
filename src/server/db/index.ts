import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { poolConfig } from "./connection.mjs";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;
/** A transaction handle: same query API as the database. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

// One pool per server process; kept on globalThis so dev hot reloads don't open new ones.
const cache = globalThis as unknown as { __rmhDb?: Db };

/** The database, connected on first use (so builds and pages that don't need it never connect). */
export function getDb(): Db {
  if (!cache.__rmhDb) {
    const pool = new Pool(poolConfig(process.env.DATABASE_URL));
    // An idle connection dropped by the server (restart, maintenance) must not crash the app:
    // the pool discards it and opens a fresh one for the next query.
    pool.on("error", (error) => console.error("[db] idle connection lost:", error.message));
    cache.__rmhDb = drizzle(pool, { schema });
  }
  return cache.__rmhDb;
}

export { schema };
