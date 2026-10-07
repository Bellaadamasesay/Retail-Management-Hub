# Retail Management System

Unified retail platform for a physical store: stock tracking, point-of-sale and
admin oversight, with role-based access (Super Admin, Inventory Keeper, Cashier).
This is the Next.js UI; it runs against a mock API until the backend exists.

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · GSAP · light and dark themes.

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` controls the number locale and whether the mock API is on
(`NEXT_PUBLIC_API_MOCKING=enabled`). Mock data lives in `src/lib/api/fixtures`. All money is in Leones (Le), stored as integer cents and formatted by `src/lib/format/money.ts`.

## Scripts

| Command             | What it does                                      |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Dev server on port 3000                           |
| `npm run build`     | Production build                                  |
| `npm run lint`      | ESLint                                            |
| `npm run typecheck` | Generate route types, then `tsc`                  |
| `npm run format`    | Prettier                                          |

## Layout

```
src/app/          routes, layouts, template (page transitions)
src/components/   ui (shadcn), data, brand, providers
src/lib/          motion (GSAP hooks), format, api (types, fixtures, mocks), utils
docs/             local planning docs (git-ignored)
```

`/design` (dev only) shows the colour tokens, components and motion using the
mock fixtures. Fonts are self-hosted from npm, so builds need no network access
to Google.
