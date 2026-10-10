# Retail Management System

Unified retail platform for a physical store: stock tracking, point-of-sale and
admin oversight, with role-based access (Super Admin, Inventory Keeper, Cashier).
One Next.js app: the UI, plus the API as route handlers under `src/app/api`,
backed by PostgreSQL through Drizzle ORM.

Next.js (App Router) · TypeScript · PostgreSQL · Drizzle · Tailwind CSS · shadcn/ui · GSAP · light and dark themes.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in DATABASE_URL and SESSION_SECRET
npm run db:migrate           # create the tables
npm run db:seed              # store settings + one account per role (prints the passwords)
npm run dev
```

The database starts empty apart from those accounts: add products from
Products (with their opening quantities) and everything else follows from use.
All money is in Leones (Le), stored as integer cents and formatted by
`src/lib/format/money.ts`.

### Database

- Schema: `src/server/db/schema.ts`. After changing it, run `npm run db:generate`
  to write a migration into `drizzle/` (commit it), then `npm run db:migrate`.
- Every stock change goes through `applyMovement` (`src/server/stock.ts`), which
  updates the variation and writes the ledger row in the same transaction.
- Product photos are stored in the database (small JPEGs) and served by
  `/api/products/:id/image`.
- Sessions are signed JWTs in an httpOnly cookie; every API request re-reads the
  user, so revoking access or changing a role applies immediately.

## Scripts

| Command             | What it does                                      |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Dev server on port 3000                           |
| `npm run build`     | Production build                                  |
| `npm run lint`      | ESLint                                            |
| `npm run typecheck` | Generate route types, then `tsc`                  |
| `npm run format`    | Prettier                                          |
| `npm run db:migrate`  | Apply pending migrations in `drizzle/`          |
| `npm run db:seed`     | First-run accounts and settings (safe to rerun) |
| `npm run db:generate` | Write a migration after a schema change         |

## Layout

```
src/app/          routes, layouts, template (page transitions)
src/components/   ui (shadcn), data, brand, providers
src/lib/          motion (GSAP hooks), format, api (types + client), auth, rbac, utils
src/server/       API logic: db (schema, connection), catalog, stock, sales, users, auth
drizzle/          SQL migrations (generated, committed)
scripts/          seed script
docs/             local planning docs (git-ignored)
```

`/design` (dev only) shows the colour tokens, components and motion with a few
sample rows. Fonts are self-hosted from npm, so builds need no network access
to Google.
