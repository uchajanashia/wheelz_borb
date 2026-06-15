# AUREN — Asset Manifest

Authoritative list of **every real asset the app expects**, read from the actual fixtures
(`src/assets/data/{tires,vehicles,brands}.json`), the placeholder generators
(`scripts/generate-placeholder-assets.mjs`, `scripts/generate-placeholder-glb.mjs`), and the
components that consume them. Generated at the R2 milestone (44 tires, 12 trims, 3 brands).

> **Format note.** Every visual asset shipped today is a **programmatic placeholder** (`.svg`
> for cars/tires/showcase, procedural `.glb` for 3D, `.ttf` for fonts). The fixture URLs point
> at these placeholder files **verbatim** — they are listed below exactly as the code references
> them. Real production renders are intended as **AVIF/WebP + fallback** per `02-tech-stack.md`
> and are drop-in: replace the file (or update the fixture URL) — zero code changes. Paths below
> are root-relative (`/assets/...`); on disk they live under `src/assets/...` (copied to
> `/assets` by the `angular.json` assets glob).

---

## 0. Geometric & compositing contracts (how the code consumes the assets)

**Stage coordinate space** (`core/services/tire-ring-scale.ts`): every car render is normalized to
**`STAGE_WIDTH_PX = 2400` × `STAGE_HEIGHT_PX = 1260`** (aspect **40 : 21**, ≈1.905:1). All anchor
coordinates (`cx, cy, rimRadiusPx, oemSidewallPx, groundY`) are expressed in this space and consumed
as **ratios**, so the stage is pixel-correct from 320 px to 4K with no JS on resize.

**`sideProfileUrl` (car)** — `CarStage` / `MiniStage` draw it at 100% of a container locked to the
2400×1260 aspect. The car is shown **with its rims, tires removed**; the tire ring is composited on
top of each rim. Transparent background **required** (the climate sky/ground show behind it).

**`sidewallUrl` (tire ring)** — the signature contract. `CarStage.bufferRect()` / `MiniStage.rect()`
size a **square** box per axle:

```
sidewallMm(tire)      = widthMm * aspect / 100
oemSidewallMm         = sidewall of the car's FRONT OEM tire at its LARGEST OEM rim
                        (core/services/fitment-engine.service.ts → oemReferenceSidewallMm)
ring = tireRingScale(anchor, sidewallMm(tire), oemSidewallMm):
   sidewallPx       = anchor.oemSidewallPx * (sidewallMm(tire) / oemSidewallMm)
   innerRadiusPx    = anchor.rimRadiusPx                    // fixed by the car's rim
   outerRadiusPx    = anchor.rimRadiusPx + sidewallPx       // grows with aspect ratio
   outerDiameterPx  = 2 * outerRadiusPx                     // == the square box side
box = anchorRectPct(anchor, ring.outerDiameterPx)           // centered on (cx, cy), in % of 2400×1260
```

Therefore the `sidewallUrl` image must be a **square, dead-on (axial) view** in which:
- the **tire OD touches all four edges** of the square,
- the **center is a transparent hole** whose radius = `(rimDiameterMm / overallDiameterMm) × (side/2)`
  (`overallDiameterMm = rim*25.4 + 2*sidewallMm`). At the box size above this hole lands exactly on
  `rimRadiusPx`, so the car's own rim shows through it.
- **Alpha is required** (transparent hole + transparent outside the OD circle).
Only the **sidewall thickness (ring) scales** between tires — the rim radius is fixed by the car, so a
35-profile and a 55-profile read visibly different on the same car. The placeholder generator encodes
the hole ratio per SKU (`holeRatio = rimMm/overallMm`) on an 800×800 canvas (`Ro = 396`).

**`catalogUrl`** — flat hero/studio image shown in `<img width="800" height="800">` (catalog card &
product hero, `object-fit: contain`). Square; alpha optional (placeholder bakes a floor shadow).

**`treadUrl`** — square top-down tread image. **Generated but not yet rendered by any component**
(the configurator detail inset that consumes it is R3). Slot reserved + populated.

**`glbUrl`** — draco-compressible glTF binary; loaded only via `@defer` in `TireViewer`
(`shared/components/tire-viewer`), which sets the DRACO decoder path to `/assets/draco/`.

---

## 1. Tire assets — per SKU (4 media slots)

Slot contracts (path pattern `<id>` = the tire `id`):

| Slot (fixture field) | Path | Consumed by (component → element) | Dimensions shipped | Real format | Alpha | Shape / contract |
|---|---|---|---|---|---|---|
| `catalogUrl` | `/assets/tires/<id>/catalog.svg` | `catalog.page` card `<img 800×800>`; `product.page` hero `<img 800×800>` (+ `@placeholder` while GLB defers) | 800×800 (placeholder, single) | AVIF/WebP, real ≥1024² recommended | optional | square, 3/4 studio |
| `sidewallUrl` | `/assets/tires/<id>/sidewall.svg` | `car-stage` ring (×4 buffers); `mini-stage` (catalog hover + home featured); `tire-rail` chip `<img 104×104>`; configurator fly-to-cart ghost (56×56) | 800×800 (placeholder, single) | AVIF/WebP/PNG, real ≥1024² recommended | **required** | **square, dead-on, tire OD touches edges, transparent center hole = `rim/overall` ratio** (see §0) |
| `treadUrl` | `/assets/tires/<id>/tread.svg` | *(declared + generated; not yet rendered — R3 detail inset)* | 800×800 (placeholder) | AVIF/WebP | optional | square, top-down tread |
| `glbUrl` | `/assets/tires/<id>/model.glb` | `tire-viewer` (product `@defer (on viewport)`; configurator A8 inspect) — **only 4 SKUs declare it** | procedural glb (~202 kB) | glTF-binary + Draco | n/a | tread + sidewall geometry; constrained OrbitControls |
| `gallery` | *(array)* | *(unused — empty `[]` on every SKU; product gallery is R4/R5)* | — | — | — | — |

**Full SKU enumeration (44).** Each row implies four files under `/assets/tires/<id>/`:
`catalog.svg`, `sidewall.svg`, `tread.svg`, and `model.glb` only where **GLB = ✓**.

| # | tire id | season | brand · model | size | GLB |
|---|---|---|---|---|---|
| 1 | aurelia-sportcontact-7-22545r18 | summer | aurelia · SportContact 7 | 225/45 R18 | ✓ |
| 2 | aurelia-sportcontact-7-24540r19 | summer | aurelia · SportContact 7 | 245/40 R19 | ✓ |
| 3 | aurelia-sportcontact-7-27535r19 | summer | aurelia · SportContact 7 | 275/35 R19 | — |
| 4 | aurelia-sportcontact-7-28535r19 | summer | aurelia · SportContact 7 | 285/35 R19 | — |
| 5 | aurelia-grandtour-24545r18 | summer | aurelia · GranTour | 245/45 R18 | — |
| 6 | aurelia-grandtour-27545r20 | summer | aurelia · GranTour | 275/45 R20 | ✓ |
| 7 | kinetik-trackattack-21540r18 | summer | kinetik · TrackAttack | 215/40 R18 | — |
| 8 | kinetik-trackattack-22540r18 | summer | kinetik · TrackAttack | 225/40 R18 | — |
| 9 | kinetik-apex-23540r18 | summer | kinetik · Apex | 235/40 R18 | — |
| 10 | kinetik-apex-24535r18 | summer | kinetik · Apex | 245/35 R18 | — |
| 11 | kinetik-trackattack-28535r19 | summer | kinetik · TrackAttack | 285/35 R19 | — |
| 12 | kinetik-trackattack-24535r21 | summer | kinetik · TrackAttack | 245/35 R21 | — |
| 13 | vektor-ecodrive-20555r16 | summer | vektor · EcoDrive | 205/55 R16 | — |
| 14 | vektor-ecodrive-20550r17 | summer | vektor · EcoDrive | 205/50 R17 | — |
| 15 | aurelia-wintercontact-22545r18 | winter | aurelia · WinterContact | 225/45 R18 | — |
| 16 | aurelia-wintercontact-22550r17 | winter | aurelia · WinterContact | 225/50 R17 | — |
| 17 | kinetik-snowtrack-21545r17 | winter | kinetik · SnowTrack | 215/45 R17 | — |
| 18 | vektor-iceguard-20555r16 | winter | vektor · IceGuard | 205/55 R16 | — |
| 19 | vektor-iceguard-20550r17 | winter | vektor · IceGuard | 205/50 R17 | — |
| 20 | aurelia-wintercontact-suv-26560r18 | winter | aurelia · WinterContact SUV | 265/60 R18 | — |
| 21 | vektor-iceguard-suv-26565r17 | winter | vektor · IceGuard SUV | 265/65 R17 | — |
| 22 | aurelia-wintercontact-24540r19 | winter | aurelia · WinterContact | 245/40 R19 | — |
| 23 | aurelia-wintercontact-27535r19 | winter | aurelia · WinterContact | 275/35 R19 | — |
| 24 | vektor-iceguard-19565r15 | winter | vektor · IceGuard | 195/65 R15 | — |
| 25 | aurelia-allseasoncontact-22545r18 | all-season | aurelia · AllSeasonContact | 225/45 R18 | ✓ |
| 26 | aurelia-allseasoncontact-22540r19 | all-season | aurelia · AllSeasonContact | 225/40 R19 | — |
| 27 | kinetik-allroad-21540r18 | all-season | kinetik · AllRoad | 215/40 R18 | — |
| 28 | kinetik-allroad-22540r18 | all-season | kinetik · AllRoad | 225/40 R18 | — |
| 29 | vektor-quattro-20555r16 | all-season | vektor · Quattro | 205/55 R16 | — |
| 30 | vektor-quattro-20550r17 | all-season | vektor · Quattro | 205/50 R17 | — |
| 31 | aurelia-allseasoncontact-23545r18 | all-season | aurelia · AllSeasonContact | 235/45 R18 | — |
| 32 | aurelia-allseasoncontact-suv-26550r19 | all-season | aurelia · AllSeasonContact SUV | 265/50 R19 | — |
| 33 | aurelia-allseasoncontact-suv-26560r18 | all-season | aurelia · AllSeasonContact SUV | 265/60 R18 | — |
| 34 | kinetik-allroad-24540r19 | all-season | kinetik · AllRoad | 245/40 R19 | — |
| 35 | kinetik-allroad-27535r19 | all-season | kinetik · AllRoad | 275/35 R19 | — |
| 36 | aurelia-grandtour-26550r19 | summer | aurelia · GranTour SUV | 265/50 R19 | — |
| 37 | aurelia-wintercontact-suv-26550r19 | winter | aurelia · WinterContact SUV | 265/50 R19 | — |
| 38 | aurelia-wintercontact-suv-27545r20 | winter | aurelia · WinterContact SUV | 275/45 R20 | — |
| 39 | aurelia-allseasoncontact-suv-27545r20 | all-season | aurelia · AllSeasonContact SUV | 275/45 R20 | — |
| 40 | aurelia-grandtour-26560r18 | summer | aurelia · GranTour SUV | 265/60 R18 | — |
| 41 | aurelia-grandtour-26565r17 | summer | aurelia · GranTour SUV | 265/65 R17 | — |
| 42 | aurelia-wintercontact-suv-26565r17 | winter | aurelia · WinterContact SUV | 265/65 R17 | — |
| 43 | aurelia-allseasoncontact-suv-26565r17 | all-season | aurelia · AllSeasonContact SUV | 265/65 R17 | — |
| 44 | aurelia-allseasoncontact-22545r17 | all-season | aurelia · AllSeasonContact | 225/45 R17 | — |

GLB-bearing SKUs (4): #1, #2, #6, #25 → `/assets/tires/<id>/model.glb`.

Tire-asset file count today: **44 × 3 SVG (132) + 4 GLB = 136 files.**

---

## 2. Car / stage assets — `sideProfileUrl` + per-trim `WheelAnchor`s

**Image files** (one per model, shared across that model's trims). Contract: 2400×1260 canvas,
transparent background, car **with rims / tires removed**, AVIF/WebP + `800/1600/2400` responsive
widths per `02`/`08`.

| Car image | Used by trims | On disk? |
|---|---|---|
| `/assets/cars/bmw-3-series-g20.svg` | bmw-3-series-g20-320i, -m340i | ✓ placeholder |
| `/assets/cars/bmw-x5-g05.svg` | bmw-x5-g05-40i | ✓ placeholder |
| `/assets/cars/mercedes-c-class-w206.svg` | -c200, -c300 | ✓ placeholder |
| `/assets/cars/vw-golf-8.svg` | vw-golf-8-15tsi, -gti | ✓ placeholder |
| `/assets/cars/toyota-gr86.svg` | toyota-gr86-premium | ✓ placeholder |
| `/assets/cars/toyota-land-cruiser-prado-150.svg` | toyota-land-cruiser-prado-150-vx | ✓ placeholder |
| `/assets/cars/toyota-camry-xv70.svg` | toyota-camry-xv70-35 | ✓ placeholder |
| `/assets/cars/nissan-370z-z34.svg` | nissan-370z-z34-sport | ✓ placeholder |
| `/assets/cars/nissan-370z-z34-nismo.webp` | nissan-370z-z34-nismo | **✗ MISSING — intentional** (exercises the `CarStage` silhouette-fallback path per `03`; not emitted by the generator) |

**Per-trim stage contract** (`vehicles.json` → `visual`). Anchors are in 2400×1260 space; front/rear
share `rimRadiusPx`/`oemSidewallPx` per trim. `occlusionMaskUrl` is **not set on any anchor**
(optional slot — see §3).

| Trim id | sideProfileUrl (model) | groundY | front cx,cy | rear cx,cy | rimRadiusPx | oemSidewallPx |
|---|---|---|---|---|---|---|
| bmw-3-series-g20-320i | bmw-3-series-g20 | 1212.5 | 1815, 985 | 585, 985 | 157.7 | 69.8 |
| bmw-3-series-g20-m340i | bmw-3-series-g20 | 1217.5 | 1815, 985 | 585, 985 | 169.3 | 63.2 |
| bmw-x5-g05-40i | bmw-x5-g05 | 1212.5 | 1790, 950 | 600, 950 | 176.5 | 86.0 |
| mercedes-c-class-w206-c200 | mercedes-c-class-w206 | 1215 | 1820, 990 | 575, 990 | 163.9 | 61.1 |
| mercedes-c-class-w206-c300 | mercedes-c-class-w206 | 1220 | 1820, 990 | 575, 990 | 167.5 | 62.5 |
| vw-golf-8-15tsi | vw-golf-8 | 1215 | 1770, 1000 | 645, 1000 | 145.8 | 69.2 |
| vw-golf-8-gti | vw-golf-8 | 1220 | 1770, 1000 | 645, 1000 | 157.9 | 62.1 |
| toyota-gr86-premium | toyota-gr86 | 1230 | 1845, 1005 | 560, 1005 | 163.5 | 61.5 |
| toyota-land-cruiser-prado-150-vx | toyota-land-cruiser-prado-150 | 1212.5 | 1760, 940 | 615, 940 | 160.7 | 111.8 |
| toyota-camry-xv70-35 | toyota-camry-xv70 | 1215 | 1810, 990 | 590, 990 | 153.8 | 71.2 |
| nissan-370z-z34-sport | nissan-370z-z34 | 1240 | 1850, 1010 | 555, 1010 | 163.6 | 66.4 |
| nissan-370z-z34-nismo | nissan-370z-z34-nismo (**.webp, missing**) | 1245 | 1850, 1010 | 555, 1010 | 167.1 | 67.9 |

A real car render must place rims so the rendered **rim (bead-seat) radius = `rimRadiusPx`** and the
OEM tire's sidewall = `oemSidewallPx` at each `(cx, cy)`; `groundY` is the contact line (shadow /
ground / future climate-effect anchor). The placeholder generator derives the body silhouette and a
metallic rim disc from these same anchors.

---

## 3. `occlusionMaskUrl` (optional, per-axle)

| Slot | Path | Status | Contract |
|---|---|---|---|
| `WheelAnchor.occlusionMaskUrl` | *(none defined)* | unused on all 12 trims | If supplied: full 2400×1260 transparent overlay re-drawing the fender lip/arch **above** the tire ring (`CarStage` renders it last). AVIF/WebP/PNG, alpha required. |

---

## 4. 3D & decoder

| Asset | Path | Source | Notes |
|---|---|---|---|
| Tire GLB ×4 | `/assets/tires/<id>/model.glb` (#1,#2,#6,#25) | `scripts/generate-placeholder-glb.mjs` (procedural three.js) | Replace with Draco-compressed scans at same URL. |
| Draco decoder | `/assets/draco/*` | copied from `node_modules/three/examples/jsm/libs/draco` via `angular.json` | **Library asset, not content** — no art needed. |

---

## 5. Logo slots (declared in fixtures, **not rendered**, **not generated**)

These fields exist in the data but **no template binds them to an `<img>`**, and the directories do
not exist on disk. Provide when a logo UI lands; until then they are inert.

| Slot | Paths (referenced) | Status |
|---|---|---|
| `Make.logoUrl` (5) | `/assets/makes/{bmw,mercedes,vw,toyota,nissan}.svg` | declared only; `src/assets/makes/` absent; garage renders `make.name` text |
| `Brand.logoUrl` (3) | `/assets/brands/{aurelia,kinetik,vektor}.svg` | declared only; `src/assets/brands/` absent; brand UI renders `brand.name` text |

---

## 6. Showcase (home page) & fonts

**Home showcase** — referenced by `home.page` (hero turntable + pinned anatomy scene):

| Path | Used as | Status |
|---|---|---|
| `/assets/showcase/tire-full.svg` | hero turntable + anatomy layers 1 & 4 | ✓ placeholder (800×800) |
| `/assets/showcase/tire-tread.svg` | anatomy layer 2 | ✓ placeholder |
| `/assets/showcase/tire-catalog.svg` | anatomy layer 3 | ✓ placeholder |
| `/assets/showcase/wheel-{tire,barrel,face,bolts,full}.svg` | **none (orphaned R1 leftovers)** | present on disk, **unreferenced** — safe to delete in a future cleanup |

**Fonts** — self-hosted FiraGO (full Georgian + Latin), wired via `src/styles/fonts.scss`:

| Path | Weight | Format | Notes |
|---|---|---|---|
| `/assets/fonts/firago-400.ttf` | 400 | TTF (~805 kB) | `font-display: swap` |
| `/assets/fonts/firago-500.ttf` | 500 | TTF (~806 kB) | |
| `/assets/fonts/firago-600.ttf` | 600 (display) | TTF (~807 kB) | |
| Noto Sans Georgian 400/500 | — | from `node_modules` via `angular.json` | swap-period / ultimate Georgian fallback |

> Real-asset follow-up (perf, `08`): subset FiraGO to **woff2** (Georgian+Latin) at the same family
> name — drop-in, no code change. Currently ~2.4 MB of TTF behind `font-display: swap`.

---

## 7. REUSE map — distinct visual families (generate N, not 1-per-SKU)

The molded look of a tire is its **brand + model line + season** (tread pattern + sidewall design).
Within a family, SKUs differ only in **molded size text and dimensions**, which the renderer/generator
re-letters and re-scales from one master. So **15 families cover all 44 SKUs** — produce 15 sets of
{sidewall, tread, catalog (+ optional GLB)}, not 44.

| Family (brand · model · season) | SKUs | Members (size) |
|---|---|---|
| aurelia · SportContact 7 · summer | 4 | 225/45R18, 245/40R19, 275/35R19, 285/35R19 |
| aurelia · GranTour · summer | 2 | 245/45R18, 275/45R20 |
| aurelia · GranTour SUV · summer | 3 | 265/50R19, 265/60R18, 265/65R17 |
| aurelia · WinterContact · winter | 4 | 225/45R18, 225/50R17, 245/40R19, 275/35R19 |
| aurelia · WinterContact SUV · winter | 4 | 265/60R18, 265/50R19, 275/45R20, 265/65R17 |
| aurelia · AllSeasonContact · all-season | 4 | 225/45R18, 225/40R19, 235/45R18, 225/45R17 |
| aurelia · AllSeasonContact SUV · all-season | 4 | 265/50R19, 265/60R18, 275/45R20, 265/65R17 |
| kinetik · TrackAttack · summer | 4 | 215/40R18, 225/40R18, 285/35R19, 245/35R21 |
| kinetik · Apex · summer | 2 | 235/40R18, 245/35R18 |
| kinetik · AllRoad · all-season | 4 | 215/40R18, 225/40R18, 245/40R19, 275/35R19 |
| kinetik · SnowTrack · winter | 1 | 215/45R17 |
| vektor · EcoDrive · summer | 2 | 205/55R16, 205/50R17 |
| vektor · IceGuard · winter | 3 | 205/55R16, 205/50R17, 195/65R15 |
| vektor · IceGuard SUV · winter | 1 | 265/65R17 |
| vektor · Quattro · all-season | 2 | 205/55R16, 205/50R17 |

**15 families → 15 sidewall masters + 15 tread masters + 15 catalog (3/4) shots.** GLB: 4 today
(all `aurelia`); for real, 1 GLB per family (or per hero family) suffices since sidewall/tread are the
visible differentiators. Minimal real-asset target: **~15 sidewall + ~15 tread + ~15 catalog + ≤15
GLB**, vs 136 placeholder files today.

> The current placeholder generator already shares more aggressively than this: **tread** has only 3
> distinct patterns (one per season) and **sidewall/catalog** are procedural per brand+size. The
> 15-family grouping is the target for **real, model-specific** art.

---

## 8. COVERAGE — tires per car × season + asset status

Counts are the live engine output over the 44 fixtures
(`fitment-acceptance.spec.ts` matrix; total = OEM-exact + alternative, all `fits`). Every car has
≥1 tire in **every** season. **Asset status is uniform: all tire & car visuals are placeholders**
(SVG / procedural GLB) — no real renders exist yet.

| Car (trim) | OEM rims | staggered | Summer | Winter | All-season | Total | Assets |
|---|---|---|---|---|---|---|---|
| bmw-3-series-g20-320i | 17, 18 | no | 3 | 2 | 2 | 7 | all placeholder |
| bmw-3-series-g20-m340i | 18, 19 | no | 7 | 3 | 4 | 14 | all placeholder |
| bmw-x5-g05-40i | 19, 20 | no | 2 | 2 | 2 | 6 | all placeholder |
| mercedes-c-class-w206-c200 | 17, 18, 19 | no | 7 | 4 | 5 | 16 | all placeholder |
| mercedes-c-class-w206-c300 | 17, 18, 19 | no | 7 | 4 | 5 | 16 | all placeholder |
| vw-golf-8-15tsi | 16, 17 | no | 2 | 3 | 3 | 8 | all placeholder |
| vw-golf-8-gti | 17, 18 | no | 3 | 2 | 2 | 7 | all placeholder |
| toyota-gr86-premium | 17, 18 | no | 5 | 2 | 4 | 11 | all placeholder |
| toyota-land-cruiser-prado-150-vx | 17, 18 | no | 2 | 2 | 2 | 6 | all placeholder |
| toyota-camry-xv70-35 | 17, 18 | no | 2 | 2 | 2 | 6 | all placeholder |
| nissan-370z-z34-sport | 18, 19 | **yes** (3 sets) | 5 | 2 | 3 | 10 | all placeholder |
| nissan-370z-z34-nismo | 19 | **yes** (3 sets) | 4 | 2 | 3 | 9 | **car render MISSING** (`.webp`, silhouette fallback) + tire placeholders |

Asset-status summary:
- **Tires:** 100% placeholder — 132 SVG (catalog/sidewall/tread × 44) + 4 procedural GLB.
- **Cars:** 8/9 placeholder SVG present; **`nissan-370z-z34-nismo.webp` deliberately absent** (fallback test).
- **Logos:** 0/8 present (slots declared, not rendered).
- **Climate textures (§9):** 0 present (R3).
- **Real (non-placeholder) binaries today:** FiraGO TTF fonts + the Three.js Draco decoder.

---

## 9. R3 climate / atmosphere textures (effect layer — to be created under `/assets/climate/`)

Required by the `shared/climate/*` effect components named in `07-design-animations.md`
(`SkyAtmosphere`, `GroundPlane`, `WeatherParticles`, `SidewallClimateFx`, `GradeVignetteGrain`).
**None exist yet** (`src/assets/climate/` is absent). Sky gradients, vignette, and the color grade are
CSS/token-driven (no texture); heat-shimmer is an SVG `feTurbulence`/`feDisplacementMap` filter (needs a
noise map, no sprite). Sizes are placeholders-to-spec; all overlays drawn only on `transform`/`opacity`.

| Asset | Path | Used by | Climate | Size (px) | Format | Alpha | Tiling | Notes |
|---|---|---|---|---|---|---|---|---|
| Ground plate — sun-baked asphalt | `/assets/climate/ground-summer.webp` | GroundPlane | summer | ~2400×480 | AVIF/WebP | edge alpha | horiz. | matte, low reflection |
| Ground plate — snow | `/assets/climate/ground-winter.webp` | GroundPlane | winter | ~2400×480 | AVIF/WebP | edge alpha | horiz. | bright, soft |
| Ground plate — wet asphalt | `/assets/climate/ground-allseason.webp` | GroundPlane | all-season | ~2400×480 | AVIF/WebP | edge alpha | horiz. | high reflection (mirror strip) |
| Sky noise | `/assets/climate/sky-noise.png` | SkyAtmosphere | all | 512×512 | PNG | yes | seamless | subtle animated grain over the CSS gradient sky |
| Snowflake sprite(s) | `/assets/climate/snowflake.png` | WeatherParticles | winter | 64×64 (2–3 variants or sheet) | PNG | yes | no | depth-layered snowfall |
| Rain streak sprite | `/assets/climate/rain-streak.png` | WeatherParticles | all-season | 16×128 | PNG | yes | no | light rain + ground splash |
| Shimmer displacement map | `/assets/climate/shimmer-noise.png` | WeatherParticles / SVG filter | summer | 256×256 | PNG (grayscale) | n/a | seamless | drives `feDisplacementMap` heat-shimmer (no DOM particles) |
| Sidewall frost overlay | `/assets/climate/frost.png` | SidewallClimateFx | winter | 800×800 (matches sidewall box) | PNG | yes | no | square, dead-on; mask-revealed onto the mounted tire ring (same geometry as `sidewallUrl`) |
| Sidewall water-bead overlay | `/assets/climate/water-bead.png` | SidewallClimateFx | all-season | 800×800 | PNG | yes | no | square; beads/streaks on tread+sidewall |
| Sidewall heat-radiate | *(CSS radial + shimmer-noise)* | SidewallClimateFx | summer | — | — | — | — | no dedicated texture (faint radial glow + the shimmer map) |
| Film grain | `/assets/climate/grain.png` | GradeVignetteGrain | all | 256×256 | PNG | yes | seamless | **static tiled** texture (never per-frame random, `07`/`08`) |
| Vignette / color grade | *(CSS overlay, token-driven)* | GradeVignetteGrain | all | — | — | — | — | no texture; `--clime-grade` + radial vignette |

Optional (can be pure CSS if budget-tight): per-climate horizon-haze strips
(`/assets/climate/haze-{summer,winter,allseason}.webp`, ~2400×300, edge alpha).

---

### Provenance
Read from: `src/assets/data/tires.json` (44), `src/assets/data/vehicles.json` (12 trims / 8 car
files), `src/assets/data/brands.json` (3), `scripts/generate-placeholder-assets.mjs`,
`scripts/generate-placeholder-glb.mjs`, `src/styles/fonts.scss`, `angular.json` (asset globs),
and the consuming components (`car-stage`, `mini-stage`, `tire-rail`, `tire-viewer`, `catalog.page`,
`product.page`, `home.page`). Geometric contract from `core/services/tire-ring-scale.ts` +
`core/services/fitment-engine.service.ts`. Coverage counts from the `fitment-acceptance.spec.ts`
matrix over the current fixtures.
