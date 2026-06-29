# Wheelz / AUREN — Codebase Audit (read-only)

> Date: 2026-06-26 · Scope: exact state of the repo as committed. Where something
> is absent, it is marked **MISSING**. No intentions are described — only code that exists.

The repo is named `wheelz` (package + Docker) but the **brand in the UI/code is "AUREN"**
(title strategy, header wordmark, token comments). Two names, one app.

---

## 1. Stack & tooling

- **Framework:** Angular **21** (all `@angular/*` at `^21.0.0`; CLI `^21.0.2`).
- **Builder:** the modern **`@angular/build:application`** builder (esbuild/Vite-based, **not** webpack). **SSR is ON** — `outputMode: "server"`, server entry `src/server.ts`, dev/test/build all via `@angular/build`. So: Angular CLI project, esbuild builder, **SSR + Express 5** server. Not Nx, not Analog, not standalone Vite.
- **SSR runtime:** Express 5 + `compression` + `@angular/ssr/node` (`src/server.ts`). Serves static `/browser` then renders Angular for all other routes.
- **3D / motion:** `three@^0.184` (lazy, behind `@defer`), `gsap@^3.15` (centralized in `MotionService` only, enforced by an ESLint `no-restricted-imports` rule).
- **i18n:** `@angular/localize`. Source locale **`ka` (Georgian)**; an `en` locale is declared in `angular.json` pointing at `src/locale/messages.en.xlf` — **that file is MISSING** (the `en` build would have no translation source).
- **Node version:** **not pinned in `package.json`** (no `engines` field, no `.nvmrc`) — **MISSING**. The only signal is the **Dockerfile → `node:22-bookworm-slim`**; `@types/node` is `^20.17.19`; `packageManager` is `npm@11.6.2`.

### `package.json` (verbatim)

```json
{
  "name": "wheelz",
  "version": "0.0.0",
  "scripts": {
    "ng": "ng",
    "start": "ng serve",
    "build": "ng build",
    "watch": "ng build --watch --configuration development",
    "test": "ng test",
    "serve:ssr:wheelz": "node dist/wheelz/server/server.mjs",
    "lint": "ng lint"
  },
  "prettier": {
    "printWidth": 100,
    "singleQuote": true,
    "overrides": [{ "files": "*.html", "options": { "parser": "angular" } }]
  },
  "private": true,
  "packageManager": "npm@11.6.2",
  "dependencies": {
    "@angular/common": "^21.0.0",
    "@angular/compiler": "^21.0.0",
    "@angular/core": "^21.0.0",
    "@angular/forms": "^21.0.0",
    "@angular/localize": "^21.2.17",
    "@angular/platform-browser": "^21.0.0",
    "@angular/platform-server": "^21.0.0",
    "@angular/router": "^21.0.0",
    "@angular/ssr": "^21.0.2",
    "@fontsource-variable/archivo": "^5.2.8",
    "@fontsource/firago": "^5.2.5",
    "@fontsource/noto-sans-georgian": "^5.2.8",
    "compression": "^1.8.1",
    "express": "^5.1.0",
    "gsap": "^3.15.0",
    "rxjs": "~7.8.0",
    "three": "^0.184.0",
    "tslib": "^2.3.0"
  },
  "devDependencies": {
    "@angular/build": "^21.0.2",
    "@angular/cli": "^21.0.2",
    "@angular/compiler-cli": "^21.0.0",
    "@eslint/js": "^10.0.1",
    "@types/compression": "^1.8.1",
    "@types/express": "^5.0.1",
    "@types/node": "^20.17.19",
    "@types/three": "^0.184.1",
    "angular-eslint": "21.4.0",
    "eslint": "^10.3.0",
    "eslint-config-prettier": "^10.1.8",
    "jsdom": "^27.1.0",
    "prettier": "^3.8.4",
    "puppeteer-core": "^25.1.0",
    "typescript": "~5.9.2",
    "typescript-eslint": "8.59.2",
    "vitest": "^4.0.8"
  }
}
```

> Note: `@fontsource-variable/archivo` is a dependency but **not** referenced in any SCSS/TS (Archivo is unused; only FiraGO + Noto Sans Georgian are wired). `@angular/forms` is installed but **no `FormsModule`/reactive forms are used anywhere** (the only input is a plain `<input>` in the garage).

### TypeScript config (`tsconfig.json`)

Strict everything:

```jsonc
"strict": true,
"noUncheckedIndexedAccess": true,
"noImplicitOverride": true,
"noPropertyAccessFromIndexSignature": true,
"noImplicitReturns": true,
"noFallthroughCasesInSwitch": true,
"isolatedModules": true,
"resolveJsonModule": true,         // ← JSON fixtures are imported as modules
"target": "ES2022",
"module": "preserve",
// angularCompilerOptions: strictTemplates, strictInjectionParameters,
//                         strictInputAccessModifiers all true
```

**Path aliases:**

```jsonc
"paths": {
  "@core/*":     ["src/app/core/*"],
  "@features/*": ["src/app/features/*"],
  "@shared/*":   ["src/app/shared/*"],
  "@data/*":     ["src/assets/data/*"]   // JSON fixtures
}
```

- **Components:** 100% **standalone** (every component declares `imports: [...]`). **Zero NgModules.** No `provideHttpClient`, no `provideAnimations` (motion is hand-rolled GSAP).
- **Signals:** used pervasively — `signal`, `computed`, `effect`, `input()`/`input.required()`, `output()`, `viewChild`, `toSignal`/`toObservable`. `ChangeDetectionStrategy.OnPush` everywhere. No zone-based patterns in app code.
- **RxJS:** `~7.8.0`, used as the **data-service contract** (every `FitmentDataService` method returns `Observable<…>`) and bridged into signals via `toSignal`. Operators in use: `of`, `map`, `switchMap`, `forkJoin`, `firstValueFrom`, `filter`.

---

## 2. Repository structure

No monorepo. Single Angular CLI project `wheelz` in `angular.json` (`newProjectRoot: "projects"` exists but is unused). No Nx, no workspace sub-projects.

```
wheelz/
├─ angular.json              # single project, @angular/build:application, SSR, i18n(ka/en)
├─ package.json · package-lock.json
├─ tsconfig.json · tsconfig.app.json · tsconfig.spec.json
├─ eslint.config.js          # flat config; bans direct gsap import outside MotionService
├─ Dockerfile                # node:22 multi-stage SSR build → dist/wheelz/server/server.mjs
├─ .editorconfig · .prettierrc · .prettierignore · .gitattributes · .gitignore
├─ .vscode/                  # extensions, launch, tasks
├─ README.md                 # stock Angular-CLI generated readme
├─ docs/
│  ├─ ASSET-MANIFEST.md      # the ONLY real spec doc present (333 lines)
│  └─ r2-shots/              # 8 PNG screenshots (catalog/product/season per climate)
├─ scripts/
│  ├─ generate-placeholder-assets.mjs   # makes the SVG car/tire placeholders
│  ├─ generate-placeholder-glb.mjs       # makes procedural .glb tires
│  └─ screenshots.mjs                     # puppeteer-core screenshotter
├─ public/                   # favicon.ico, robots.txt, main_hero.png (hero photo)
└─ src/
   ├─ index.html · main.ts · main.server.ts · server.ts · styles.scss
   ├─ styles/
   │  ├─ tokens.scss         # design tokens — "Three Climates" (single source of truth)
   │  ├─ fonts.scss          # FiraGO @font-face (TTF placeholders)
   │  └─ typography.scss
   ├─ assets/
   │  ├─ data/               # ← THE DATABASE: tires.json, vehicles.json, fitments.json, brands.json
   │  ├─ tires/<id>/         # per-tire catalog.svg + sidewall.svg + tread.svg (+ 4 model.glb)
   │  ├─ cars/               # 8 car side-profile SVGs
   │  ├─ showcase/           # tire/wheel anatomy SVGs (home scroll scene)
   │  └─ fonts/              # firago-400/500/600.ttf
   │  └─ (MISSING: assets/brands/*.svg and assets/makes/*.svg referenced by JSON)
   └─ app/
      ├─ app.ts · app.html · app.scss · app.config.ts · app.config.server.ts
      ├─ app.routes.ts · app.routes.server.ts · app.spec.ts
      ├─ core/
      │  ├─ auren-title.strategy.ts
      │  ├─ guards/           # cart-not-empty.guard.ts, vehicle-selected.guard.ts
      │  ├─ models/           # tire, fitment, vehicle, brand, visual, compatibility,
      │  │                    #   load-index, speed-rating, index (barrel)
      │  └─ services/         # fitment-data (abstract) + mock-fitment-data,
      │     │                 #   fitment-engine, climate, garage, cart, storage,
      │     │                 #   motion, tire-ring-scale, look-url  (+ 5 .spec.ts)
      ├─ features/
      │  ├─ home/home.page.ts
      │  ├─ garage/garage.page.ts
      │  ├─ season/season.page.ts
      │  ├─ catalog/catalog.page.ts
      │  ├─ product/product.page.ts
      │  ├─ configurator/configurator.page.ts
      │  │  └─ components/  car-stage/ · spec-hud/ · tire-rail/
      │  ├─ checkout/  cart.page.ts · checkout.page.ts · order.page.ts
      │  └─ brands/brand.page.ts
      ├─ layout/  header/header.ts · footer/footer.ts
      └─ shared/
         ├─ components/  tire-viewer/ · mini-stage/ · car… season-frame/ ·
         │               eu-label/ · glass-panel/ · contact-line/
         ├─ directives/  reveal-on-scroll.directive.ts
         └─ pipes/       tire-size.pipe.ts · speed-rating.pipe.ts · load-index.pipe.ts
```

Everything is **inline-template + inline-styles** components (no separate `.html`/`.scss` per component except the root `app`).

---

## 3. Routing & app shell

**All routes are lazy** (`loadComponent`), titles set via `AurenTitleStrategy` (`"<route> — AUREN"`). From `src/app/app.routes.ts`:

| Path | Component | Lazy | Guard | Notes |
|---|---|---|---|---|
| `''` | HomePage | ✅ | — | |
| `garage` | GaragePage | ✅ | — | Make→Model→Trim picker |
| `season` | SeasonPage | ✅ | — | climate chooser |
| `configurator` | ConfiguratorPage | ✅ | **`vehicleSelectedGuard`** | redirects to `/garage` unless a vehicle is set OR a valid `?look=` is present |
| `catalog` | CatalogPage | ✅ | — | |
| `tire/:id` | ProductPage | ✅ | — | param via `withComponentInputBinding` |
| `cart` | CartPage | ✅ | — | **stub** |
| `checkout` | CheckoutPage | ✅ | **`cartNotEmptyGuard`** | redirects to `/cart` if empty; **stub** |
| `order/:id` | OrderPage | ✅ | — | **stub** |
| `brands/:id` | BrandPage | ✅ | — | minimal |
| `**` | → redirect `''` | — | — | |

- **Guards:** 2 `CanActivateFn` (functional). **Resolvers: none (MISSING)** — pages fetch their own data via signals in the constructor/fields.
- **Server routes** (`app.routes.server.ts`): single `{ path: '**', renderMode: RenderMode.Server }` — **everything SSR-rendered on demand, no prerendering** (comment notes prerender is deferred to "spec 08").
- **App shell** (`app.ts` / `app.html`): `<app-header/>` + `<main><router-outlet/></main>` + `<app-footer/>` + a plain `.route-overlay` div used for a 200 ms fade-through-dark page transition (GSAP, reduced-motion-aware). `App` eagerly injects `ClimateService` so the climate theme class lands on `<html>` at bootstrap. `Header` shows season chip, garage chip (selected vehicle label), and cart badge.

---

## 4. Data layer (the important one)

### Where product/tire data lives — **static JSON fixtures, bundled at build time**

There is **NO database, NO HTTP, NO API, NO backend call, NO environment config.** All product/vehicle data is four JSON files under `src/assets/data/`, imported as ES modules (`resolveJsonModule`) directly into `MockFitmentDataService`:

```
src/assets/data/tires.json      (44 tires,  ~34 KB)
src/assets/data/vehicles.json   (5 makes, 8 models, 12 trims, ~7.7 KB)
src/assets/data/fitments.json   (fitment specs keyed by id, ~4.2 KB)
src/assets/data/brands.json     (3 brands, ~0.8 KB)
```

**Source path:** `src/assets/data/tires.json` — first ~30 lines:

```json
[
  {
    "id": "aurelia-sportcontact-7-22545r18",
    "brandId": "aurelia",
    "model": "SportContact 7",
    "season": "summer",
    "size": { "widthMm": 225, "aspect": 45, "rimDiameterInch": 18 },
    "loadIndex": 95,
    "speedRating": "Y",
    "priceGel": 540,
    "inStock": 12,
    "euLabel": { "fuelEfficiency": "A", "wetGrip": "A", "noiseDb": 71, "noiseClass": "B" },
    "attributes": { "runFlat": true, "treadDepthMm": 7.5 },
    "media": {
      "catalogUrl": "/assets/tires/aurelia-sportcontact-7-22545r18/catalog.svg",
      "sidewallUrl": "/assets/tires/aurelia-sportcontact-7-22545r18/sidewall.svg",
      "treadUrl": "/assets/tires/aurelia-sportcontact-7-22545r18/tread.svg",
      "glbUrl": "/assets/tires/aurelia-sportcontact-7-22545r18/model.glb",
      "gallery": []
    },
    "tags": ["flagship", "sport", "run-flat"]
  },
  ...
]
```

`vehicles.json` carries `makes[]`, `models[]`, and `trims[]` where each trim has a `fitmentId` (joined to `fitments.json`) and a `visual` (the configurator stage anchors). `brands.json` head:

```json
[
  { "id": "aurelia", "name": "AURELIA", "country": "Germany",
    "logoUrl": "/assets/brands/aurelia.svg", "story": "…", "tier": "flagship" },
  { "id": "kinetik", "name": "Kinetik", "country": "Japan",  "tier": "performance", … },
  { "id": "vektor",  "name": "VEKTOR",  "country": "Poland", "tier": "value", … }
]
```

> Brands are 3 fictional names (Aurelia / Kinetik / Vektor). `logoUrl`s point at `/assets/brands/*.svg` and make `logoUrl`s at `/assets/makes/*.svg`, **but neither directory exists** — those logo assets are **MISSING**.

### Data models / interfaces (full)

`src/app/core/models/fitment.model.ts`:

```ts
export interface TireSize { widthMm: number; aspect: number; rimDiameterInch: number; }
export type SpeedRating = 'Q' | 'R' | 'S' | 'T' | 'H' | 'V' | 'W' | 'Y';
export interface OemTireByRim { rimDiameterInch: number; front: TireSize; rear?: TireSize; }
export interface VehicleTireFitment {
  rimDiametersInch: number[];
  oemBySize: OemTireByRim[];
  staggered: boolean;
  minLoadIndex: number;
  oemSpeedRating: SpeedRating;
}
```

`src/app/core/models/tire.model.ts`:

```ts
export type Season = 'summer' | 'winter' | 'all-season';
export interface EuTireLabel {
  fuelEfficiency: 'A'|'B'|'C'|'D'|'E';
  wetGrip: 'A'|'B'|'C'|'D'|'E';
  noiseDb: number;
  noiseClass: 'A'|'B'|'C';
}
export interface TireAttributes {
  runFlat: boolean; studdable?: boolean; threePMSF?: boolean;
  mudSnow?: boolean; treadDepthMm?: number;
}
export interface TireMedia {
  catalogUrl: string; sidewallUrl: string; treadUrl?: string;
  glbUrl?: string; gallery: string[];
}
export interface Tire {
  id: string; brandId: string; model: string; season: Season;
  size: TireSize; loadIndex: number; speedRating: SpeedRating;
  priceGel: number; inStock: number;
  euLabel: EuTireLabel; attributes: TireAttributes; media: TireMedia; tags: string[];
}
```

`vehicle.model.ts`: `Make {id,name,logoUrl}`, `BodyType`, `VehicleModel {id,makeId,name,generation,yearFrom,yearTo,bodyType}`, `VehicleTrim {id,modelId,name,fitment,visual}`.
`brand.model.ts`: `Brand {id,name,country,logoUrl,story?,tier:'flagship'|'performance'|'value'}`.
`visual.model.ts`: `WheelAnchor {cx,cy,rimRadiusPx,oemSidewallPx,occlusionMaskUrl?}`, `VehicleVisual {sideProfileUrl, stageWidthPx:2400, groundY, frontWheel, rearWheel, bodyColorVariants?}`.
`compatibility.model.ts`: `FitmentRule`, `FitLevel='oem'|'alternative'|'no-fit'`, `FitmentCheck {rule,status:'pass'|'warning'|'fail',detail}`, `Advisory`, `CompatibilityResult {fits,level,reasons[],advisories[],overallDiameterDeltaPct}`.
`load-index.ts`: ISO load-index → kg table (75–120) + `loadIndexKg()`.
`speed-rating.ts`: order array, km/h table, `speedRatingRank/Delta/Kmh()`.

### Services

| Service | File | Role | Key public surface |
|---|---|---|---|
| **FitmentDataService** (abstract — DI token) | `core/services/fitment-data.service.ts` | Data-access contract. **This is the only intended API boundary.** | `getMakes(): Observable<Make[]>`, `getModels(makeId)`, `getModel(modelId)`, `getTrims(modelId)`, `getTrim(trimId)`, `getBrands()`, `getTires()`, `getTire(tireId)` |
| **MockFitmentDataService** (the bound impl) | `core/services/mock-fitment-data.service.ts` | Imports the 4 JSON fixtures, joins trims↔fitments, returns everything via `of(...)`. **No network.** | implements all of the above against in-memory arrays |
| **FitmentEngineService** | `core/services/fitment-engine.service.ts` | "The spine." Pure fitment math + signal wrapper over garage selection. | signals `selectedTrim`, `compatibleTires` (FittedTire[] \| null); method `check(fitment,tire,opts)`. Pure exports: `checkCompatibility`, `compatibleTiresForCar`, `evaluateTireForCar`, `resolveStaggeredSets`, `filterTiresBySeason`, `sidewallMm`, `overallDiameterMm`, `oemReferenceSidewallMm`, `classifyOverallDiameter` |
| **ClimateService** (root) | `core/services/climate.service.ts` | Global season state; writes `climate-<season>` class on `<html>`; persists to localStorage. | `season` (Signal), `hasSeason`, `themeClass`; `setSeason(season)`, `clear()` |
| **GarageService** (root) | `core/services/garage.service.ts` | Selected + recent vehicles (localStorage-backed, lightweight refs). | `selectedVehicle`, `recentVehicles`, `hasVehicle`; `selectVehicle(ref)`, `clear()` |
| **CartService** (root) | `core/services/cart.service.ts` | Cart lines (sets of 4 / staggered), localStorage. **`add()` only — no remove/update yet.** | `items`, `isEmpty`, `setCount`; `add(line)` |
| **StorageService** (root) | `core/services/storage.service.ts` | SSR-safe localStorage wrapper (no-op on server, try/catch). | `get<T>(key)`, `set(key,val)`, `remove(key)` |
| **MotionService** (root) | `core/services/motion.service.ts` | The ONLY gsap import site; reduced-motion signal; ScrollTrigger/Flip lazy-loaded; auto-kill on destroy/route-leave. | `reduced` (Signal), `dur`, `ease`; `timeline()`, `set()`, `to()`, `reveal()`, `scrollScene()`, `flipSnapTo()`, `flipTo()` |
| **AurenTitleStrategy** (root) | `core/auren-title.strategy.ts` | `"<title> — AUREN"`. | `updateTitle()` |
| pure utils | `tire-ring-scale.ts`, `look-url.ts` | stage geometry (`tireRingScale`, `anchorRectPct`, `STAGE_WIDTH/HEIGHT_PX`) and `?look=` serialize/parse | pure functions, unit-tested |

**HTTP / API / env: none.** Grep for `HttpClient`/`provideHttpClient`/`fetch(` finds **zero** real usages (the one match was the word "prefetch"). No `src/environments/` directory. `src/server.ts` has a commented-out `app.get('/api/...')` example only.

---

## 5. State management

No store library (no NgRx/NgXs/Akita). State = **root-provided services holding Angular signals**, with localStorage persistence via `StorageService`. Cross-component sharing is by injecting the same singleton.

**Selected season / climate** lives in `ClimateService` (`src/app/core/services/climate.service.ts`):

```ts
@Injectable({ providedIn: 'root' })
export class ClimateService {
  private readonly seasonState = signal<Season | null>(this.storage.get<Season>(SEASON_KEY));
  readonly season = this.seasonState.asReadonly();
  readonly hasSeason = computed(() => this.seasonState() !== null);
  readonly themeClass = computed(() => { const s = this.seasonState(); return s ? `climate-${s}` : ''; });

  constructor() {
    effect(() => {                          // browser-only: paint the theme class on <html>
      if (!this.isBrowser) return;
      const root = this.doc.documentElement;
      root.classList.remove(...ALL_CLASSES);
      const cls = this.themeClass();
      if (cls) root.classList.add(cls);
    });
  }
  setSeason(season: Season) { this.seasonState.set(season); this.storage.set(SEASON_KEY, season); }
  clear()                   { this.seasonState.set(null);  this.storage.remove(SEASON_KEY); }
}
```

The **"spine"** is `FitmentEngineService`: it derives `selectedTrim` and `compatibleTires` as signals off `GarageService.selectedVehicle`, and feature pages (catalog, configurator, product) consume those computed signals — nothing re-queries or re-computes fitment locally. Season filtering layers on top in the components (`catalog.page.ts`, `configurator.page.ts`) via `ClimateService.season()`.

---

## 6. Design system / styling

- **No component library** — Angular Material is **not** present. The entire UI is **custom**, with inline `styles:` per component consuming CSS custom properties.
- **Structure:** `src/styles.scss` (resets + `@use` of the three partials) → `src/styles/{fonts,tokens,typography}.scss`. Plus `node_modules/@fontsource/noto-sans-georgian/{400,500}.css` pulled in via `angular.json`.
- **Design tokens — the "Three Climates" system** (`src/styles/tokens.scss`): a neutral "studio" base (`--studio-*`, `--ink-*`, machined-metal accent) plus three theme classes (`.climate-summer/.climate-winter/.climate-all-season`) set by `ClimateService` on the root that **retint `--accent`, `--clime-key`, sky/ground/glow** custom properties. Spacing/radii/z-index/motion tokens all live here and are mirrored by `MotionService.dur`/`ease`.
- **Typography:** **FiraGO** self-hosted as **TTF placeholders** (`fonts.scss`, `font-display: swap`, Noto Sans Georgian fallback). Georgian-first; the comment notes production should subset to woff2 at the same family name (drop-in). `@fontsource-variable/archivo` is installed but unused.

Token file (`src/styles/tokens.scss`) — key excerpt:

```scss
:root {
  --studio-0:#0b0c0e; --studio-1:#15171a; --studio-2:#1e2125;
  --ink-0:#eceef1; --ink-1:#8a9099; --line:#ffffff12; --metal:#b9c0c7;
  --bg-0:var(--studio-0); --bg-1:var(--studio-1); --bg-2:var(--studio-2);
  --glass-bg: color-mix(in srgb, var(--studio-1) 70%, transparent); --glass-blur:14px;
  --accent: var(--metal); --accent-ink: var(--studio-0);
  --clime-sky-top:#1a1d22; --clime-sky-low:#23272e; --clime-key:var(--metal);
  --clime-ground:#0f1113; --clime-glow:#b9c0c71f; --clime-grade:transparent;
  --success:#5fb87e; --warning:#e0a53c; --danger:#d5564b;
  --font-display:'FiraGO','Noto Sans Georgian',system-ui,sans-serif;
  --font-body:   'FiraGO','Noto Sans Georgian',system-ui,sans-serif;
  /* type scale --text-xs … --text-display:5.61rem; weights 400/500/600;
     spacing 1–10; radii sm/md/lg/full; z-index map; --dur-* / --ease-*;
     --container-max:1440px; --header-height:64px; --touch-target:44px */
}
.climate-summer  { --clime-key:#ff7a2e; --accent:var(--clime-key); /* warm sun */ }
.climate-winter  { --clime-key:#afc9e2; --accent:var(--clime-key); /* cold light */ }
.climate-all-season { --clime-key:#c9cfc6; --accent:var(--clime-key); /* overcast */ }
```

---

## 7. Key feature components

> Common pattern: each page injects `FitmentDataService` / `FitmentEngineService` and binds data through `toSignal`. Route params arrive as signal **inputs** (`input.required<string>()`) via `withComponentInputBinding`. No `@Input()`/`@Output()` decorators — all `input()`/`output()` signal APIs.

- **Catalog** — `features/catalog/catalog.page.ts`. Inputs: none (reads `ActivatedRoute` query params + engine/climate signals). Data: `engine.compatibleTires()` when a car is selected (compatible-only, no-fit excluded), else full `data.getTires()`. Filters (season/rim/brand/sort) are query-param driven and `computed`-filtered. Renders `app-mini-stage` on hover when a car is set (A6 "on your car" thumbnail).
- **Product detail** — `features/product/product.page.ts`. Input: `id` (route). Data: `data.getTire(id)` + `engine.selectedTrim()` → `evaluateTireForCar()` to render a pass/warn/fail compatibility checklist + advisories. Media slot: `app-tire-viewer` (3D) when `glbUrl` exists (`@defer on viewport`), else catalog `<img>`.
- **Season chooser** — `features/season/season.page.ts`. Three `app-season-frame` buttons → `climate.setSeason()` then navigate to `?next=` (default `/catalog`). No data fetch.
- **Configurator** (core) — `features/configurator/configurator.page.ts` composing `CarStage` + `TireRail` + `SpecHud` + `TireViewer`. Selection state (`selectedTireId`) is local signal; the fitted list comes from `engine.compatibleTires()` filtered by season. Supports `?look=` (restore exact {trim,tire}, hydrating the garage pre-auth) and `?tire=` (preselect). "Save look" serializes to `?look=` and copies the URL to clipboard. Add-to-cart fires a GSAP fly-to-cart ghost. 3D inspect overlay uses GSAP Flip.
- **CarStage** — `features/configurator/components/car-stage/car-stage.ts`. Inputs: `visual` (required), `tire`, `oemSidewallMm` (required), `vehicleLabel`. **2D compositing**: car side-profile image + a per-axle **sidewall "ring"** image whose box size is computed by `tireRingScale()` from the tire's aspect ratio. Tire-swap = animation A1 (double-buffered, decode-before-animate, interruptible, reduced-motion crossfade).
- **Garage** — `features/garage/garage.page.ts`. Make→Model→Trim, query-param-driven steps, search-as-you-type across makes+models, confirmation moment → auto-navigate to season/configurator. GSAP step transitions.

### Product images — **all programmatic placeholders today**

Per `docs/ASSET-MANIFEST.md` and the asset tree: **every visual asset is a generated placeholder** produced by `scripts/generate-placeholder-assets.mjs` (SVGs) and `generate-placeholder-glb.mjs` (procedural GLB):

- Each tire id has a folder `src/assets/tires/<id>/` with **`catalog.svg`** (hero), **`sidewall.svg`** (the on-car ring), **`tread.svg`**. Only **4 tires** also ship a **`model.glb`**.
- Cars: 8 hand/script-made side-profile **SVGs** under `assets/cars/`.
- Fixture `media.*Url` strings point at these `.svg`/`.glb` files verbatim. The manifest states real production should be AVIF/WebP and is "drop-in" (replace file or URL, no code change).
- Robustness: `CarStage`/`MiniStage` have an `(error)` fallback — if `sideProfileUrl` fails they draw a **procedural SVG silhouette** from the anchors; `TireViewer` shows "3D unavailable" on load error. So broken assets degrade gracefully rather than crash.
- **Brand/make logos** referenced by JSON (`/assets/brands/*.svg`, `/assets/makes/*.svg`) have **no files on disk — MISSING.**

---

## 8. Specs & docs

The repo contains **only two markdown docs**. The numbered specs (`01`…`08`, `MIGRATION.md`) are referenced **dozens of times in code comments** (e.g. "spec 04-data-model.md", "spec 07-design-animations.md") but **the files themselves are not in the repo — MISSING.** Treat those comment references as design intent without a backing document here.

| File | 2–3 line summary |
|---|---|
| `README.md` | Stock Angular-CLI generated readme (ng serve / build / test with Vitest / e2e). No project-specific content. |
| `docs/ASSET-MANIFEST.md` | The one substantive spec present. Authoritative list of every asset the app expects, derived from the fixtures + placeholder generators. Defines the stage coordinate contract (2400×1260), the `sidewallUrl` ring math, and lists all 44 tires / 12 trims / 3 brands with their expected file paths. States all shipped assets are placeholders and that production AVIF/WebP renders are drop-in. |
| `docs/r2-shots/*.png` | 8 reference screenshots (catalog & product per climate, season chooser, reduced-motion) — visual snapshots, not docs. |
| `01–08-*.md`, `MIGRATION.md` | **MISSING** — referenced throughout code comments but absent from the repository. |

---

## 9. Build, test, env, CI

- **Scripts:** `start`=`ng serve`, `build`=`ng build`, `watch`=dev build watch, `serve:ssr:wheelz`=`node dist/wheelz/server/server.mjs`, `test`=`ng test`, `lint`=`ng lint`. **No `e2e` script** despite README mentioning it.
- **Build target:** `@angular/build:application`, SSR, production budgets (initial 450 kB warn / 600 kB error; component style 12/20 kB), `outputHashing: all`. i18n locales `ka` (source) + `en` (→ missing xlf).
- **Environments:** **none — MISSING.** No `src/environments/`, no `environment.ts`. Config is hardcoded; the only runtime env read is `process.env.PORT` (default 4000) and `NODE_ENV` in `src/server.ts`/Dockerfile.
- **Test setup:** **Vitest** (`@angular/build:unit-test` builder + `vitest@^4`, `jsdom@^27`). **6 spec files, ~68 `it()` blocks:**
  - `app.spec.ts` (2), `fitment-engine.service.spec.ts` (32), `fitment-acceptance.spec.ts` (14), `mock-fitment-data.service.spec.ts` (9), `tire-ring-scale.spec.ts` (8), `look-url.spec.ts` (3).
  - Coverage is concentrated on the **pure fitment/geometry logic and the mock data join** — the genuinely valuable, well-tested core. **No component/template/DOM tests, no e2e.**
- **Lint:** flat ESLint (`eslint.config.js`) = js + ts-eslint recommended/stylistic + angular-eslint + prettier, with a custom rule banning direct `gsap` imports outside `MotionService`.
- **CI: none — MISSING.** No `.github/`, no `.gitlab-ci.yml`, no pipeline YAML anywhere.
- **Containerization:** `Dockerfile` (multi-stage, node:22, `npm ci` → `ng build` → run `dist/wheelz/server/server.mjs`, EXPOSE 4000) — clearly aimed at a single-container SSR deploy (comments mention Render).

---

## 10. Honest state assessment

### What actually works end-to-end (against static data)
- Browse → **garage** vehicle selection (make/model/trim, search, recents, localStorage persistence).
- **Season** selection retints the whole site (the "Three Climates" theme is real and wired).
- **Catalog** filtered to **only compatible tires** once a car is selected; season/size/brand/sort filters via query params; SSR-rendered.
- **Product** page with a real, rule-by-rule **fitment compatibility checklist** (rim diameter, overall diameter ±2/±3%, load index, nuanced speed rating with winter exception) — this logic is solid and unit-tested.
- **Configurator** composites the tire onto the car (2D ring math), swaps with animation, supports shareable `?look=` deep links and "add set to cart".
- **Cart badge** count works; the fly-to-cart animation works.
- SSR + i18n (ka) + reduced-motion handling are genuinely implemented.

### Stubbed / placeholder
- **Cart page, Checkout page, Order page** are explicit "Phase 5" stubs (no line items, no qty edit, no payment). `CartService` has **`add()` only** — no remove/update/clear-line.
- **Brand page** is a minimal data-backed stub (name/country/story only).
- **All imagery** is programmatic SVG/GLB placeholders; only 4 of 44 tires have a 3D model.
- **`en` locale** has no translation file; **brand/make logos** are referenced but absent.
- The numbered **spec docs are absent** — only ASSET-MANIFEST.md is real.

### Biggest structural weaknesses for going to "real app + admin + backend"
1. **Data is 100% static, compiled into the bundle.** All 4 JSON files are `import`ed into `MockFitmentDataService`; there is no runtime data source. Editing a price = rebuilding the app. An admin panel has nothing to write to.
2. **The API boundary is abstract-only.** `FitmentDataService` is a clean seam (good!), but **no `HttpFitmentDataService` exists and no backend exists.** Everything returns `of(staticArray)`. There is no server API surface (the Express server only does SSR + static files; the `/api` example is commented out).
3. **No auth, no users, no sessions — MISSING entirely.** "Garage" and "cart" are anonymous localStorage blobs. An admin panel needs an identity/role system that simply isn't here.
4. **No persistence layer of any kind** beyond `localStorage` (cart/garage/season). No DB, no ORM, no migrations.
5. **No environment configuration** — nothing to point at staging vs prod APIs; secrets/config story is absent.
6. **No CI/CD, no e2e tests, no component tests.** Only pure-logic unit tests. Refactoring the data flow to HTTP would be unguarded at the UI layer.
7. **Two identities ("wheelz" vs "AUREN")** and **fictional brands** — fine for a demo, but naming/seed data will need reconciling for production.
8. **Money/stock are plain numbers in JSON** (`priceGel`, `inStock`) with no transactional integrity — real commerce needs server-authoritative pricing/inventory, which changes the trust model the current components assume.

### Surprising / messy worth flagging
- **The fitment engine is genuinely good** — pure, well-factored, 46 of the ~68 tests target it. That's the asset to build the backend contract around (it can run server-side unchanged).
- **The whole codebase is modern and disciplined**: Angular 21 standalone + signals throughout, OnPush everywhere, a single enforced GSAP entry point, SSR-safe storage/motion, reduced-motion paths. This is well above typical "prototype" quality — the gap to production is **breadth (no backend/auth/admin/commerce)**, not code quality.
- **Dependency oddities:** `@fontsource-variable/archivo` and `@angular/forms` are installed but unused — forms especially matter because checkout/admin will need real form handling that isn't started yet.
- **Code comments cite specs that aren't in the repo.** Anyone onboarding will chase `04-data-model.md` etc. and find nothing — the design knowledge lives only in comments + ASSET-MANIFEST.md.
- The **abstraction seam was clearly designed for a future HTTP swap** (`app.config.ts` literally says "swap to HttpFitmentDataService later with zero component changes"). That intent is real and the seam is honored — it just hasn't been crossed.

---

## TL;DR — current state in 10 bullets

- **Angular 21**, standalone + signals throughout, OnPush everywhere, **SSR on** via the modern esbuild `@angular/build:application` builder + Express 5; TypeScript fully strict. High code quality.
- **No backend, no HTTP, no API, no database, no environment files** — all data is **4 static JSON fixtures** (`src/assets/data/`, 44 tires / 12 trims / 3 brands) imported into the bundle.
- The data layer is cleanly abstracted behind **`FitmentDataService`** (DI token), but the only implementation is **`MockFitmentDataService`** returning `of(staticData)`; the intended `HttpFitmentDataService` **does not exist**.
- **No authentication, no users, no admin, no roles** — garage/cart/season are anonymous **localStorage** state held in root services with **signals** (no store library).
- The **fitment engine** (rim/overall-diameter/load/speed rules, staggered sets, season filter) is **pure, well-factored, and the focus of ~46 of ~68 unit tests** — the strongest part of the codebase and a ready backend contract.
- **Design system is custom** (no Angular Material): a "**Three Climates**" token system in `tokens.scss` where the selected season retints the whole site; **FiraGO** self-hosted as **TTF placeholders**; Georgian-first i18n (source locale `ka`).
- **All product imagery is programmatic placeholder SVG/GLB** (4 of 44 tires have a 3D model); **brand/make logos and the `en` locale `.xlf` are referenced but MISSING**.
- **Working end-to-end (on static data):** garage selection, season theming, compatible-only catalog, product fitment checklist, the 2D configurator with shareable `?look=` links and add-to-cart. **Cart/checkout/order/brand pages are explicit stubs.**
- **No CI, no e2e, no component tests, no environments**; only Vitest unit tests on pure logic. A `Dockerfile` (node:22, SSR) is the sole deploy artifact.
- **The numbered spec docs (01–08, MIGRATION.md) are MISSING** — heavily cited in comments but absent; only `README.md` (stock) and `docs/ASSET-MANIFEST.md` (substantive) exist. Brand is "**AUREN**" in-app vs repo name "wheelz".
</content>
</invoke>
