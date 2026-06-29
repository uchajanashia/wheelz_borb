# tyre — monorepo

Monorepo for **tyre.ge**, the tire store. Managed with **npm workspaces** (no Nx/Turborepo).

## Layout

- `apps/website/` — the customer-facing storefront (Angular 21 SSR). The existing, working app.
- `apps/api/` — backend API (NestJS + PostgreSQL + Prisma). Placeholder; scaffolded later.
- `apps/adminka/` — admin panel. Placeholder; scaffolded later.
- `packages/shared/` — shared TypeScript package (domain types live here next).
- `docs/` — project documentation (audit, decisions, asset manifest).

## Common commands (run from the repo root)

```bash
npm install            # install all workspaces
npm run dev            # serve the website (ng serve)
npm run build          # build the website
npm test               # run the website's unit tests
npm run lint           # lint the website
```

Per-workspace commands also work, e.g. `npm run build --workspace @tyre/website`.
