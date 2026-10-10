import { defineConfig } from "drizzle-kit";
import { loadEnv, poolConfig } from "./src/server/db/connection.mjs";

loadEnv();
const { connectionString, ssl } = poolConfig(process.env.DATABASE_URL);
const { hostname, port, username, password, pathname } = new URL(connectionString!);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    host: hostname,
    port: Number(port || 5432),
    user: decodeURIComponent(username),
    password: decodeURIComponent(password),
    database: pathname.slice(1),
    ssl,
  },
});
