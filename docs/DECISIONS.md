# Project Decisions

Confirmed decisions for the tyre project. This is the running record — append new
decisions over time; don't rewrite history.

## Confirmed

### Brand / domain
- The product is **tyre.ge** — the main tire store in Georgia.
- The storefront in-app wording is currently "AUREN" (legacy); brand/UI wording is a
  separate later task and is intentionally not changed during the monorepo migration.

### Architecture
- **Monorepo:** npm workspaces (`apps/*` + `packages/*`). Not Nx, not Turborepo —
  kept deliberately simple.
- **Backend:** NestJS + PostgreSQL + Prisma.
- **Shared code:** lives in `packages/shared` (shared domain types consumed by
  website, API, and admin).

### Catalog / data
- **Real catalog size:** 606 products — **603 tires + 3 disks** — across **29 real
  brands**.
- **No winter tires** in the current export yet (pending a future export).
- **No product images yet.**
- Current website data is still static JSON fixtures; moving to the API/DB is a
  later task.

### Pricing
- The storefront shows **RETAIL price**.
- **B2B / wholesale pricing is a separate, later feature** (not in the storefront's
  first cut).

### Inventory
- The supplier is effectively **unlimited stock**, but the **admin controls stock per
  product**. The exact mechanism (e.g. manual override, thresholds) is **TBD**.

### Fitment engine / car configurator scope
- The fitment engine and the on-car configurator are a **PASSENGER-car feature**.
- **Truck / commercial lines rely on filter-based catalog browsing**, not the
  configurator.

## Monorepo migration notes (adjustments made during the move)

Moving the app under `apps/website/` with npm-workspace dependency hoisting (deps
live in the **root** `node_modules`) required two small `angular.json` changes —
no feature/UI code was touched:

1. **Global font styles** changed from literal `node_modules/@fontsource/...css`
   paths to bare package specifiers (`@fontsource/noto-sans-georgian/400.css`), so
   esbuild resolves them via Node module resolution (finds the hoisted copy).
   This is layout-independent and the more idiomatic form.
2. **Draco 3D decoder** — `@angular/build` forbids asset inputs outside the
   workspace root, so the old `node_modules/three/.../draco` asset entry could no
   longer point at the hoisted `three`. The runtime decoder files
   (`draco_decoder.js`, `draco_decoder.wasm`, `draco_wasm_wrapper.js`, ~1 MB) are
   now vendored into `apps/website/src/assets/draco/` and shipped by the existing
   `src/assets → assets` rule. They still land at `/assets/draco/`, so
   `TireViewer`'s `DRACOLoader` path is unchanged. (The unused draco *encoder* and
   the alternate `gltf/` decoder set were intentionally not vendored.)

The Angular project name inside `angular.json` was deliberately left as `wheelz`
so the build output stays `dist/wheelz/...` and the existing `Dockerfile` SSR path
(`dist/wheelz/server/server.mjs`) keeps working. The `Dockerfile` itself still
assumes the old flat layout and will need updating when the app is containerised
from the monorepo — a separate later task.
