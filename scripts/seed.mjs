/**
 * First-run setup: the store's settings row and one account per role, so
 * every part of the app can be signed into. Safe to run again: anything that
 * already exists is left alone. No products, sales or stock: those start empty.
 *
 *   npm run db:seed
 *
 * Passwords are generated (or SEED_PASSWORD, if set) and printed once, along
 * with the cashier's till PIN. Change them from Users after signing in.
 */
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import pg from "pg";
import { loadEnv, poolConfig } from "../src/server/db/connection.mjs";

loadEnv();

const STAFF = [
  { name: "Bella Sesay", email: "bella@retailhub.com", role: "SUPER_ADMIN" },
  { name: "Miss Barrie", email: "missy@retailhub.com", role: "INVENTORY_KEEPER" },
  { name: "Dominic Oladapo", email: "dominic@retailhub.com", role: "CASHIER" },
];

const WORDS = ["Amber", "Cedar", "Harbor", "Maple", "Olive", "Linen", "Sandal", "Willow", "Copper", "Thistle", "Coral", "Indigo"];
const password = () => process.env.SEED_PASSWORD || `${WORDS[randomInt(WORDS.length)]}-${WORDS[randomInt(WORDS.length)]}-${randomInt(1000, 10000)}`;
const pin = () => String(randomInt(0, 10000)).padStart(4, "0");

const pool = new pg.Pool(poolConfig(process.env.DATABASE_URL));
try {
  await pool.query(
    `insert into settings (id, store_name, address, phone) values (1, $1, '', '') on conflict (id) do nothing`,
    ["DaniCess Store"],
  );

  const created = [];
  for (const person of STAFF) {
    const exists = await pool.query("select 1 from users where lower(email) = lower($1)", [person.email]);
    if (exists.rowCount) continue;
    const secret = password();
    const till = person.role === "CASHIER" ? pin() : null;
    await pool.query(
      `insert into users (name, username, email, role, password_hash, pin_hash) values ($1, $2, $3, $4, $5, $6)`,
      [person.name, person.email.split("@")[0], person.email, person.role, await bcrypt.hash(secret, 10), till ? await bcrypt.hash(till, 10) : null],
    );
    created.push({ ...person, password: secret, pin: till });
  }

  if (created.length === 0) {
    console.log("Nothing to do: the store settings and accounts already exist.");
  } else {
    console.log("Created these accounts. Note the passwords now: they aren't stored anywhere readable.\n");
    for (const c of created) {
      console.log(`  ${c.role.padEnd(17)} ${c.email.padEnd(24)} password ${c.password}${c.pin ? `   till PIN ${c.pin}` : ""}`);
    }
  }
} finally {
  await pool.end();
}
