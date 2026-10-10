/**
 * How to reach Postgres, shared by the app, drizzle-kit (migrations) and the seed script.
 *
 * - localhost, or a Render *internal* URL (host without dots, e.g. dpg-abc123-a): plain connection.
 * - anything else, e.g. Render's *external* URL (…render.com): TLS. The certificate isn't
 *   verified against a CA unless DATABASE_SSL=verify, because managed hosts often present
 *   chains Node doesn't ship with; the link is still encrypted.
 *
 * @param {string | undefined} url
 * @returns {import("pg").PoolConfig}
 */
export function poolConfig(url) {
  if (!url) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local (see .env.example).");
  }
  const { hostname } = new URL(url);
  const local = hostname === "localhost" || hostname === "127.0.0.1" || !hostname.includes(".");
  return {
    connectionString: url,
    ssl: local ? false : { rejectUnauthorized: process.env.DATABASE_SSL === "verify" },
    max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
  };
}

/** Loads .env.local then .env for scripts that run outside Next (Next loads them itself). */
export function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // Missing file: fine, the variables may come from the environment.
    }
  }
}
