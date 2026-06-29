# PROJECT_AUDIT.md — Wheelz / AUREN

> Read-only audit. Nothing in the project was changed, installed, or built.
> Goal: a clear inventory of what exists today so the next phases can be planned.
>
> Note on naming: the repo and Docker image are called **`wheelz`**, but the
> brand shown in the UI and code is **"AUREN"** (header wordmark, page-title
> strategy, design-token comments). Same app, two names. The product domain is a
> **premium car-tire store** with a "fitment-first" idea: pick your car + season
> once, then only see tires that physically fit, previewed on your actual car.

The whole experience and all on-screen text are in **Georgian (ქართული)**.

---

## 1. Stack & Setup

### Framework & key dependencies
- **Angular 21** (all `@angular/*` packages at `^21.0.0`; CLI/build at `^21.0.2`).
  This is a very recent Angular: **standalone components + signals throughout**,
  **no NgModules at all**.
- **SSR is ON** (server-side rendering). Uses `@angular/ssr` + an **Express 5**
  server (`src/server.ts`) with `compression`. The server renders Angular for all
  routes and serves the static browser build.
- **3D:** `three` `^0.184` — used for an interactive 3D tire viewer (lazy-loaded).
- **Animation:** `gsap` `^3.15` — all motion is hand-rolled GSAP, centralized in a
  single `MotionService` (an ESLint rule forbids importing `gsap` anywhere else).
- **RxJS** `~7.8` — used only as the data-service contract (every data method
  returns an `Observable`), then bridged into signals via `toSignal`.
- **Fonts:** self-hosted **FiraGO** + **Noto Sans Georgian** (Georgian-first).
  `@fontsource-variable/archivo` is installed but **not used anywhere**.

### Build tooling & package manager
- **Package manager: npm** (declared `packageManager: "npm@11.6.2"`,
  `angular.json` → `cli.packageManager: "npm"`, and a `package-lock.json` exists).
- **Builder: `@angular/build:application`** — the modern esbuild/Vite-based
  builder, **not** the old webpack builder. Output mode `server` (SSR), server
  entry `src/server.ts`.
- **Scripts:** `start` (`ng serve`), `build` (`ng build`), `watch`,
  `serve:ssr:wheelz` (`node dist/wheelz/server/server.mjs`), `test` (`ng test`),
  `lint` (`ng lint`). There is **no `e2e` script**.
- **Tests: Vitest** (`@angular/build:unit-test` builder + `vitest@^4` + `jsdom`).
- **Lint:** flat-config ESLint (`eslint.config.js`) = JS + typescript-eslint +
  angular-eslint + prettier, plus the custom "no direct gsap import" rule.
- **TypeScript is fully strict** (`strict`, `noUncheckedIndexedAccess`,
  `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `strictTemplates`,
  etc.). Path aliases: `@core/*`, `@features/*`, `@shared/*`, `@data/*`.
- **Containerization:** a `Dockerfile` (multi-stage, `node:22`, builds then runs
  the SSR server, EXPOSE 4000). **No CI pipeline** (`.github/` etc. is absent).

### Styling approach
- **No UI/component library** (no Angular Material, no Tailwind). The entire UI is
  **custom CSS**, written as **inline `styles:` inside each component**.
- **SCSS** global layer: `src/styles.scss` pulls in `src/styles/tokens.scss`,
  `fonts.scss`, `typography.scss`.
- **Design-token system = "Three Climates".** `tokens.scss` defines a neutral
  "studio" base plus three theme classes (`.climate-summer`, `.climate-winter`,
  `.climate-all-season`). Selecting a season puts a `climate-<season>` class on
  `<html>`, which **retints the whole site** (accent color, sky/ground/glow). This
  is the signature visual idea and it is genuinely wired up.

### State management
- **No store library** (no NgRx / NgXs / Akita).
- State lives in **root-provided services holding Angular signals**, shared by
  injecting the same singleton, and persisted to **localStorage** where needed:
  - `GarageService` — selected vehicle + recent vehicles.
  - `ClimateService` — selected season (drives the theme).
  - `CartService` — cart lines (currently `add()` only).
  - `FitmentEngineService` — the "spine": derives `selectedTrim` and
    `compatibleTires` as computed signals off the garage selection.
- Components consume those computed signals; they never re-query or re-compute
  fitment locally. **Signals are used everywhere** (`signal`, `computed`,
  `effect`, `input()`, `viewChild`, `toSignal`); `OnPush` change detection on
  every component.

---

## 2. Structure

### `/src` folder structure (2–3 levels)

```
src/
├─ index.html · main.ts · main.server.ts · server.ts · styles.scss
├─ styles/
│  ├─ tokens.scss          # "Three Climates" design tokens (single source of truth)
│  ├─ fonts.scss           # FiraGO @font-face
│  └─ typography.scss
├─ assets/
│  ├─ data/                # ← THE "DATABASE": tires.json, vehicles.json,
│  │                       #   fitments.json, brands.json
│  ├─ tires/<id>/          # per-tire catalog.svg + sidewall.svg + tread.svg (+ a few model.glb)
│  ├─ cars/                # 8 car side-profile SVGs
│  ├─ showcase/            # tire-anatomy SVGs (home scroll scene)
│  └─ fonts/               # firago TTF files
└─ app/
   ├─ app.ts · app.html · app.scss · app.config.ts · app.config.server.ts
   ├─ app.routes.ts · app.routes.server.ts · app.spec.ts
   ├─ core/
   │  ├─ auren-title.strategy.ts
   │  ├─ guards/            # cart-not-empty.guard.ts, vehicle-selected.guard.ts
   │  ├─ models/           # tire, fitment, vehicle, brand, visual, compatibility,
   │  │                    #   load-index, speed-rating, index (barrel)
   │  └─ services/         # fitment-data (abstract) + mock-fitment-data,
   │                       #   fitment-engine, climate, garage, cart, storage,
   │                       #   motion, tire-ring-scale, look-url (+ spec files)
   ├─ features/
   │  ├─ home/home.page.ts
   │  ├─ garage/garage.page.ts
   │  ├─ season/season.page.ts
   │  ├─ catalog/catalog.page.ts
   │  ├─ product/product.page.ts
   │  ├─ configurator/configurator.page.ts
   │  │  └─ components/ car-stage/ · spec-hud/ · tire-rail/
   │  ├─ checkout/ cart.page.ts · checkout.page.ts · order.page.ts
   │  └─ brands/brand.page.ts
   ├─ layout/ header/header.ts · footer/footer.ts
   └─ shared/
      ├─ components/ tire-viewer/ · mini-stage/ · season-frame/ ·
      │              eu-label/ · glass-panel/ · contact-line/
      ├─ directives/ reveal-on-scroll.directive.ts
      └─ pipes/ tire-size.pipe.ts · speed-rating.pipe.ts · load-index.pipe.ts
```

Almost every component is **inline-template + inline-styles** (only the root
`App` has separate `.html`/`.scss` files).

### Components, pages, and routes

**Feature pages (one per route):** Home, Garage, Season, Catalog, Product,
Configurator, Cart, Checkout, Order, Brand.

**Configurator sub-components:** `CarStage` (2D car+tire compositing),
`TireRail` (scroll-snap tire picker), `SpecHud` (spec panel / mobile bottom sheet).

**Shared components:** `TireViewer` (Three.js 3D), `MiniStage` (small "on your
car" thumbnail), `SeasonFrame` (season chooser card), `EuLabel` (EU tyre label),
`GlassPanel`, `ContactLine` (animated brand mark). Plus a `RevealOnScroll`
directive and three pipes (`tireSize`, `speedRating`, `loadIndex`).

**Routes** (`src/app/app.routes.ts`) — **all lazy-loaded** via `loadComponent`,
titles set by `AurenTitleStrategy` ("<page> — AUREN"):

| Path | Page | Guard | Notes |
|---|---|---|---|
| `''` | HomePage | — | Marketing / "wow" landing |
| `garage` | GaragePage | — | Make → Model → Trim picker |
| `season` | SeasonPage | — | Climate (season) chooser |
| `configurator` | ConfiguratorPage | **vehicleSelectedGuard** | Core feature; redirects to `/garage` unless a car is set or a valid `?look=` link is present |
| `catalog` | CatalogPage | — | Tire listing |
| `tire/:id` | ProductPage | — | Tire detail (`:id` bound as a signal input) |
| `cart` | CartPage | — | **Stub** |
| `checkout` | CheckoutPage | **cartNotEmptyGuard** | Redirects to `/cart` if empty; **stub** |
| `order/:id` | OrderPage | — | **Stub** |
| `brands/:id` | BrandPage | — | Minimal stub |
| `**` | → redirect to `''` | — | Catch-all |

### How routing is configured
- Standalone bootstrap: `app.config.ts` calls `provideRouter(routes,
  withComponentInputBinding())` — so route params (e.g. `:id`) arrive as
  **signal inputs** (`input.required<string>()`) instead of `ActivatedRoute`.
- **Guards** are functional (`CanActivateFn`): `vehicleSelectedGuard` and
  `cartNotEmptyGuard`. **No resolvers** — pages fetch their own data via signals.
- **Server routes** (`app.routes.server.ts`): everything is rendered on demand
  (`RenderMode.Server`); there is **no prerendering** configured.
- Filters and steps are reflected in **query params** (e.g.
  `/garage?make=bmw&model=...`, `/catalog?season=winter&brand=...`,
  `/configurator?look=...`), which makes states shareable and SSR-friendly.

---

## 3. Features That Already Exist

### Pages / features (what each does)

- **Home** — Marketing landing. Photo hero with a subtle desktop parallax, a
  pinned **scroll-driven "tire anatomy" scene** (GSAP ScrollTrigger), a 3-step
  "how it works" promise, a **"featured looks" rail** (each card deep-links to an
  exact car+tire configuration via `?look=`), and a brand wall.
- **Garage** — Vehicle selection: **Make → Model → Trim**, with
  search-as-you-type across makes+models, "recently selected" chips, animated step
  transitions, and a brief "confirmation moment" that then auto-navigates to the
  season chooser / configurator. Selection persists in localStorage.
- **Season** — Three cinematic "climate frames" (Summer / All-season / Winter).
  Choosing one sets the global climate (retinting the whole site) and continues
  to wherever the flow pointed (`?next=`).
- **Catalog** — Tire grid. **When a car is selected it shows ONLY compatible
  tires** (incompatible tires never appear); with no car it shows the full
  catalog plus a "select your car" banner. Filters for season / rim size / brand /
  price sort, all query-param driven. On hover (with a car selected) a card
  crossfades to a **"mounted on your car" mini preview**.
- **Product detail** — Tire page with a **rule-by-rule fitment checklist** when a
  car is selected (rim diameter, overall diameter ±2/±3%, load index, speed
  rating, with the special winter speed-rating exception), pass/warn/fail marks,
  advisories, the EU tyre label, a full spec table, and a **3D viewer** when the
  tire has a GLB model (otherwise the studio image).
- **Configurator (the core feature)** — Composites the chosen tire onto the
  selected car in **2D** and lets you flip through compatible tires in a rail.
  Highlights below. Supports `?look=` (restore an exact car+tire, even with an
  empty garage — it hydrates the garage from the link) and `?tire=` (preselect).
  "Save look" copies a shareable URL. "Add set to cart" plays a fly-to-cart
  animation. An "inspect" button opens the 3D viewer with a shared-element
  (GSAP Flip) transition.
- **Cart / Checkout / Order** — **Explicit stubs** ("Phase 5"). Cart only shows an
  empty/non-empty message; checkout and order are placeholders. The cart **badge
  count** in the header does work.
- **Brand** — Minimal data-backed stub (name, country, tier, story text).

### Standout / "innovative" UI features
- **Fitment-aware catalog** — the catalog literally hides tires that don't fit
  your car. This is driven by a real, unit-tested fitment engine, not a fake
  filter.
- **2D "tire on your car" configurator** (`CarStage`) — each tire is rendered as a
  **sidewall "ring" layer** whose outer radius is computed from the tire's aspect
  ratio (`tireRingScale`), composited over the car's rims. Positions are pure
  percentage ratios of a 2400-px stage, so it's pixel-correct from mobile to 4K
  with no JS on resize. Swapping tires is a careful animation: it **decodes the
  next image before animating** (no flash), morphs the sidewall height, crossfades
  lettering, dips the body ~4px "on its suspension", and is interruptible
  (rapid taps queue-jump). Reduced-motion users get a plain crossfade.
- **"Three Climates" theming** — the selected season retints the entire site.
- **Lazy 3D tire viewer** — Three.js is loaded only behind `@defer`, with
  constrained OrbitControls (no pan, clamped zoom/angle), auto-rotate that
  respects reduced-motion, and a DRACO decoder wired up for compressed models.
- **Shareable deep links** (`?look=`) that reconstruct a full car+tire scene.
- **Graceful asset fallbacks** — if a car render fails to load, `CarStage` draws a
  neutral car silhouette from the geometry anchors instead of breaking.
- Strong **accessibility / reduced-motion** discipline throughout (aria labels,
  live regions, `prefers-reduced-motion` paths).

### Where product data comes from
- **Static JSON fixtures, compiled into the app bundle.** There is **no API and no
  database.** Four files under `src/assets/data/` are imported as ES modules
  (`resolveJsonModule`) directly into `MockFitmentDataService`:
  - `tires.json` — **44 tires**
  - `vehicles.json` — **5 makes, 8 models, 12 trims**
  - `fitments.json` — fitment specs keyed by id (joined onto trims)
  - `brands.json` — **3 brands** (fictional: Aurelia, Kinetik, Vektor)
- All imagery (tire catalog/sidewall/tread art, car profiles) is **programmatic
  placeholder SVG/GLB** generated by scripts; only a handful of tires ship a 3D
  `model.glb`. Brand/make logos are referenced by the JSON but the files are
  **not on disk**.

---

## 4. Internationalization

- **Yes — `@angular/localize` is set up** (Angular's built-in i18n). Template text
  uses `i18n` attributes and `$localize` template strings extensively (the app is
  authored Georgian-first).
- **Source locale: `ka` (Georgian).** `LOCALE_ID` is hard-set to `'ka'` and
  Georgian locale data is registered in `app.config.ts`.
- **A second locale `en` (English) is declared** in `angular.json`, pointing at
  `src/locale/messages.en.xlf` with base href `/en/`.
- **Caveat:** that translation file does **not exist** — there is no `src/locale/`
  directory and no `.xlf` file anywhere. So the English build is configured but
  has **no actual translations yet**; only Georgian is real. (`@angular/localize`
  is also wired as a polyfill in `angular.json`.)

---

## 5. Backend / Data

### HTTP / API calls
- **None.** There is no `HttpClient`, no `provideHttpClient`, no `fetch`, no API
  base URL, and no `src/environments/` config anywhere in the app.
- The Express server (`src/server.ts`) only does **SSR + static file serving**.
  It contains a **commented-out** `app.get('/api/{*splat}', ...)` example — i.e.
  the place a real API *would* go, but nothing is implemented.
- **The intended API seam exists but is unused.** `FitmentDataService` is an
  abstract class used as a DI token; `app.config.ts` binds it to
  `MockFitmentDataService` with a comment explicitly noting a future
  `HttpFitmentDataService` could be swapped in "with zero component changes". The
  contract (every method returns an `Observable`) was clearly designed for that
  future HTTP swap, but the swap has not happened.

**Methods a future backend must provide (the data contract):**
```ts
abstract class FitmentDataService {
  getMakes(): Observable<Make[]>;
  getModels(makeId: string): Observable<VehicleModel[]>;
  getModel(modelId: string): Observable<VehicleModel | undefined>;
  getTrims(modelId: string): Observable<VehicleTrim[]>;
  getTrim(trimId: string): Observable<VehicleTrim | undefined>;
  getBrands(): Observable<Brand[]>;
  getTires(): Observable<Tire[]>;
  getTire(tireId: string): Observable<Tire | undefined>;
}
```
These map naturally to endpoints like `GET /makes`, `GET /makes/:id/models`,
`GET /models/:id`, `GET /models/:id/trims`, `GET /trims/:id`, `GET /brands`,
`GET /tires`, `GET /tires/:id`.

### Data models / interfaces (the "what is a tire" definitions)

**Tire (the product)** — `src/app/core/models/tire.model.ts`:
```ts
export type Season = 'summer' | 'winter' | 'all-season';

export interface EuTireLabel {
  fuelEfficiency: 'A' | 'B' | 'C' | 'D' | 'E';
  wetGrip: 'A' | 'B' | 'C' | 'D' | 'E';
  noiseDb: number;
  noiseClass: 'A' | 'B' | 'C';
}

export interface TireAttributes {
  runFlat: boolean;
  studdable?: boolean;
  threePMSF?: boolean;   // 3-Peak Mountain Snowflake (severe-snow cert)
  mudSnow?: boolean;     // M+S marking
  treadDepthMm?: number;
}

export interface TireMedia {
  catalogUrl: string;    // hero studio shot
  sidewallUrl: string;   // sidewall view used to composite the on-car ring
  treadUrl?: string;     // top-down tread pattern
  glbUrl?: string;       // 3D model (optional)
  gallery: string[];
}

export interface Tire {
  id: string;
  brandId: string;
  model: string;         // "SportContact 7"
  season: Season;
  size: TireSize;
  loadIndex: number;     // table-mapped to kg
  speedRating: SpeedRating;
  priceGel: number;      // per tire; UI leads with set-of-4 price
  inStock: number;
  euLabel: EuTireLabel;
  attributes: TireAttributes;
  media: TireMedia;
  tags: string[];        // 'flagship','touring','sport','eco','run-flat'...
}
```

**Tire size & fitment** — `src/app/core/models/fitment.model.ts`:
```ts
export interface TireSize {
  widthMm: number;        // 225
  aspect: number;         // 45  (sidewall height as % of width)
  rimDiameterInch: number;// 18
}

export type SpeedRating = 'Q' | 'R' | 'S' | 'T' | 'H' | 'V' | 'W' | 'Y';

export interface OemTireByRim {
  rimDiameterInch: number;
  front: TireSize;
  rear?: TireSize;        // present only if the car is staggered
}

export interface VehicleTireFitment {
  rimDiametersInch: number[];   // OEM rim diameters the car ships with
  oemBySize: OemTireByRim[];    // OEM tire spec per rim diameter
  staggered: boolean;           // front/rear different sizes
  minLoadIndex: number;         // safety floor
  oemSpeedRating: SpeedRating;  // baseline for the speed-rating comparison
}
```

**Vehicle** — `src/app/core/models/vehicle.model.ts`:
```ts
export interface Make { id: string; name: string; logoUrl: string; }

export type BodyType = 'sedan' | 'coupe' | 'suv' | 'hatchback' | 'wagon' | 'pickup';

export interface VehicleModel {
  id: string;            // "bmw-3-series-g20"
  makeId: string;
  name: string;          // "3 Series"
  generation: string;    // "G20"
  yearFrom: number;
  yearTo: number | null; // null = current
  bodyType: BodyType;
}

export interface VehicleTrim {
  id: string;            // "bmw-3-series-g20-320i"
  modelId: string;
  name: string;          // "320i"
  fitment: VehicleTireFitment; // decides which tires fit
  visual: VehicleVisual;       // configurator stage assets/anchors
}
```

**Brand** — `src/app/core/models/brand.model.ts`:
```ts
export interface Brand {
  id: string;
  name: string;
  country: string;
  logoUrl: string;
  story?: string;
  tier: 'flagship' | 'performance' | 'value';
}
```

**Compatibility result** (engine output) — `src/app/core/models/compatibility.model.ts`:
```ts
export type FitmentRule = 'rim-diameter' | 'overall-diameter' | 'load-index' | 'speed-rating';
export type FitLevel = 'oem' | 'alternative' | 'no-fit';

export interface FitmentCheck {
  rule: FitmentRule;
  status: 'pass' | 'warning' | 'fail';
  detail: string;
}

export interface Advisory {
  kind: 'winter-speed-rating' | 'season-use' | 'aggressive-sizing';
  text: string;
}

export interface CompatibilityResult {
  fits: boolean;
  level: FitLevel;
  reasons: FitmentCheck[];
  advisories: Advisory[];
  overallDiameterDeltaPct: number;
}
```

**Configurator visual contract** — `src/app/core/models/visual.model.ts`:
```ts
export interface WheelAnchor {
  cx: number; cy: number;        // rim center in stage space
  rimRadiusPx: number;           // inner edge of the tire ring
  oemSidewallPx: number;         // calibration reference for the ring scale
  occlusionMaskUrl?: string;     // optional fender-lip overlay
}

export interface VehicleVisual {
  sideProfileUrl: string;        // car in side profile, with rims
  stageWidthPx: 2400;            // normative coordinate space
  groundY: number;
  frontWheel: WheelAnchor;
  rearWheel: WheelAnchor;
  bodyColorVariants?: { name: string; hex: string; url: string }[];
}
```

There are also two reference tables in `core/models/`: `load-index.ts`
(ISO load index → kg) and `speed-rating.ts` (rating order + km/h + comparison
helpers). The **fitment engine** (`core/services/fitment-engine.service.ts`) is a
set of **pure functions** (`checkCompatibility`, `compatibleTiresForCar`,
`evaluateTireForCar`, `resolveStaggeredSets`, `filterTiresBySeason`,
`overallDiameterMm`, etc.) plus a thin signal wrapper — this is the most
substantial and best-tested logic in the project.

---

## 6. Code Quality Notes

### Overall structure quality — **clean and modern (above typical prototype level)**
- Consistent, disciplined architecture: standalone components, signals + `OnPush`
  everywhere, a clear `core / features / shared / layout` layout, path aliases,
  fully strict TypeScript, and a single enforced entry point for animation.
- Clear separation of concerns: a pure, unit-tested **fitment engine**; a clean
  **data-access abstraction**; UI components that only consume computed signals.
- SSR-safe patterns (platform checks, a localStorage wrapper that no-ops on the
  server) and thorough reduced-motion handling.
- **Tests** are focused on the valuable core: ~6 spec files covering the fitment
  engine, the data-join, the stage geometry, and the look-URL serializer
  (roughly 68 `it()` blocks). **No component/DOM tests and no e2e** exist.

### What would block or complicate adding a real backend + admin panel
1. **Data is 100% static and compiled into the bundle.** All four JSON files are
   `import`ed into `MockFitmentDataService`; there is no runtime data source.
   Changing a price means rebuilding the app. An admin panel today has nothing to
   write to.
2. **No real API layer.** The `FitmentDataService` seam is clean and ready, but
   **no `HttpFitmentDataService` and no server API exist**; `provideHttpClient`
   isn't even configured. The Express server only does SSR + static files.
3. **No auth / users / roles / sessions whatsoever.** "Garage" and "cart" are
   anonymous localStorage blobs. An admin panel needs an identity/permission
   system that isn't here.
4. **No persistence beyond localStorage** — no database, ORM, or migrations.
5. **No environment configuration** — no `src/environments/`, nothing to point at
   staging vs production APIs, no secrets story. Only `PORT`/`NODE_ENV` are read
   (in the server).
6. **Commerce is not transactional.** `priceGel` and `inStock` are plain numbers
   in JSON; components assume client-trusted values. Real commerce needs
   server-authoritative pricing/inventory and an orders backend (cart/checkout/
   order pages are stubs, and `CartService` only has `add()`).

### Obvious technical debt / loose ends
- **Stubbed pages:** Cart, Checkout, Order, and Brand are placeholders.
- **Missing assets referenced by data:** brand/make logos (`/assets/brands/*.svg`,
  `/assets/makes/*.svg`) are referenced in JSON but **not on disk**; all tire/car
  imagery is placeholder art.
- **i18n half-wired:** the `en` locale is declared but its `messages.en.xlf` file
  is missing, so English has no translations.
- **Unused dependencies:** `@fontsource-variable/archivo` and `@angular/forms`
  are installed but not used. (`@angular/forms` matters later — checkout and any
  admin panel will need real form handling, which hasn't been started.)
- **Spec references with no specs:** code comments cite numbered design docs
  ("spec 04-data-model.md", "spec 07-design-animations.md", etc.) that are **not
  in the repo**. Only `README.md` (stock) and `docs/ASSET-MANIFEST.md`
  (substantive) exist, so onboarding readers will chase docs that aren't there.
- **Two identities** ("wheelz" repo vs "AUREN" brand) and **fictional brands/seed
  data** — fine for a demo, but will need reconciling for production.
- **No CI/CD** and **no prerendering** configured (every route is SSR-on-demand).

### Bottom line
The gap to a "real app with backend + admin" is **breadth, not code quality**:
the existing code is clean, modern, and well-tested where it counts. The fitment
engine is the standout asset (pure, framework-agnostic, can run server-side
unchanged) and is the natural thing to build the backend contract around. The
biggest lifts are: stand up a backend + database, implement
`HttpFitmentDataService` behind the existing seam, add auth/roles, build the
admin CRUD, and finish the commerce flow (cart/checkout/order + forms).
