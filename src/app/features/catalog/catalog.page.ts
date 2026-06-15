import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { Brand, CompatibilityResult, Season, Tire } from '@core/models';
import { ClimateService } from '@core/services/climate.service';
import { FitmentDataService } from '@core/services/fitment-data.service';
import { FitmentEngineService, oemReferenceSidewallMm } from '@core/services/fitment-engine.service';
import { GarageService } from '@core/services/garage.service';
import { EuLabel } from '@shared/components/eu-label/eu-label';
import { MiniStage } from '@shared/components/mini-stage/mini-stage';
import { RevealOnScroll } from '@shared/directives/reveal-on-scroll.directive';
import { SpeedRatingPipe } from '@shared/pipes/speed-rating.pipe';
import { TireSizePipe } from '@shared/pipes/tire-size.pipe';

interface CatalogItem {
  tire: Tire;
  /** null when no car is selected (full catalog mode) */
  compatibility: CompatibilityResult | null;
}

type SortKey = 'price-asc' | 'price-desc';

const SEASONS: { id: Season; label: string }[] = [
  { id: 'summer', label: $localize`ზაფხული` },
  { id: 'winter', label: $localize`ზამთარი` },
  { id: 'all-season', label: $localize`ყველა სეზონი` },
];

/**
 * Catalog (spec 06): with a car selected it renders ONLY the engine's compatible
 * list (no-fit tires never appear); without a car it shows the full catalog plus
 * the persistent "select your car" banner. The season filter works without a car
 * (all-seasons view + invitation). Filters are signal-driven and reflected in
 * query params (shareable, SSR-renderable).
 *
 * NOTE (R1): the cinematic seasonal "frame" styling is R2; this is the
 * functional, fitment- and season-filtered listing.
 */
@Component({
  selector: 'app-catalog-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CurrencyPipe, TireSizePipe, SpeedRatingPipe, EuLabel, MiniStage, RevealOnScroll],
  template: `
    <section class="catalog">
      <div class="catalog__heading">
        @if (activeSeasonLabel(); as word) {
          <span class="season-word catalog__seasonword" aria-hidden="true">{{ word }}</span>
        }
        <h1 i18n>კატალოგი</h1>
      </div>

      @if (garage.selectedVehicle(); as vehicle) {
        <div class="catalog__fit-banner">
          <span class="catalog__fit-check">✓</span>
          <span>
            {{ vehicle.label }} —
            <ng-container i18n>ნაჩვენებია მხოლოდ თავსებადი საბურავები</ng-container>
            <span class="num">({{ filtered().length }})</span>
          </span>
          <a routerLink="/garage" class="catalog__change" i18n>შეცვლა</a>
        </div>
      } @else {
        <a routerLink="/garage" class="catalog__banner">
          <span i18n>აარჩიე შენი მანქანა — დაინახავ მხოლოდ თავსებად საბურავებს</span>
        </a>
      }

      <div class="catalog__filters" i18n-aria-label aria-label="ფილტრები">
        <div class="catalog__filter-group">
          <span class="catalog__filter-label" i18n>სეზონი</span>
          @for (s of seasons; track s.id) {
            <button
              type="button"
              class="catalog__pill"
              [class.is-active]="seasonParam() === s.id"
              (click)="toggleParam('season', s.id)"
            >
              {{ s.label }}
            </button>
          }
        </div>
        <div class="catalog__filter-group">
          <span class="catalog__filter-label" i18n>ზომა</span>
          @for (d of sizeOptions(); track d) {
            <button
              type="button"
              class="catalog__pill num"
              [class.is-active]="sizeParam() === '' + d"
              (click)="toggleParam('rim', '' + d)"
            >
              R{{ d }}
            </button>
          }
        </div>
        <div class="catalog__filter-group">
          <span class="catalog__filter-label" i18n>ბრენდი</span>
          @for (b of brands(); track b.id) {
            <button
              type="button"
              class="catalog__pill"
              [class.is-active]="brandParam() === b.id"
              (click)="toggleParam('brand', b.id)"
            >
              {{ b.name }}
            </button>
          }
        </div>
        <div class="catalog__filter-group">
          <span class="catalog__filter-label" i18n>დალაგება</span>
          <button
            type="button"
            class="catalog__pill"
            [class.is-active]="sortParam() === 'price-asc'"
            (click)="toggleParam('sort', 'price-asc')"
            i18n
          >
            ფასი ↑
          </button>
          <button
            type="button"
            class="catalog__pill"
            [class.is-active]="sortParam() === 'price-desc'"
            (click)="toggleParam('sort', 'price-desc')"
            i18n
          >
            ფასი ↓
          </button>
        </div>
      </div>

      <div class="catalog__grid">
        @for (item of filtered(); track item.tire.id; let i = $index) {
          <a [routerLink]="['/tire', item.tire.id]" class="card" [appReveal]="i % 4">
            <div class="card__media" aria-hidden="true">
              <img
                class="card__catalog"
                [src]="item.tire.media.catalogUrl"
                alt=""
                loading="lazy"
                width="800"
                height="800"
              />
              <!-- A6: hover crossfades to the mounted-on-your-car thumbnail -->
              @if (selectedTrim(); as t) {
                <div class="card__mini">
                  <app-mini-stage
                    [visual]="t.visual"
                    [tire]="item.tire"
                    [oemSidewallMm]="oemSidewallMm()"
                  />
                </div>
              }
            </div>
            <div class="card__badges">
              @if (item.compatibility; as c) {
                @if (c.level === 'alternative') {
                  <span class="badge badge--alt" i18n>alt ზომა</span>
                }
              }
              @if (item.tire.attributes.runFlat) {
                <span class="badge">RF</span>
              }
              @if (item.tire.attributes.threePMSF) {
                <span class="badge">3PMSF</span>
              }
            </div>
            <h3 class="card__title">{{ brandName(item.tire.brandId) }} {{ item.tire.model }}</h3>
            <p class="card__spec num">
              {{ item.tire.size | tireSize }} · {{ item.tire.speedRating | speedRating }}
            </p>
            <app-eu-label [label]="item.tire.euLabel" [compact]="true" />
            <p class="card__price">
              <span class="num">{{
                item.tire.priceGel * 4 | currency: 'GEL' : 'symbol' : '1.0-0'
              }}</span>
              <span class="card__price-note" i18n>კომპლექტი (4 ცალი)</span>
            </p>
          </a>
        } @empty {
          @if (hasActiveFilters()) {
            <div class="catalog__empty">
              <p i18n>ფილტრს არცერთი საბურავი არ შეესაბამება.</p>
              <button type="button" class="catalog__reset" (click)="resetFilters()" i18n>
                ფილტრების გასუფთავება
              </button>
            </div>
          } @else {
            <div class="catalog__empty">
              <p i18n>შენი მანქანისთვის თავსებადი საბურავები ამჟამად მარაგში არ არის.</p>
              <button type="button" class="catalog__reset" disabled i18n>
                შემატყობინე როცა გამოჩნდება (მალე)
              </button>
            </div>
          }
        }
      </div>
    </section>
  `,
  styles: `
    .catalog {
      max-width: var(--container-max);
      margin: 0 auto;
      padding: var(--space-8) var(--space-5);
      display: grid;
      gap: var(--space-5);
    }

    .catalog__heading {
      position: relative;
      min-height: 1.2em;
    }

    /* atmospheric season word — the catalog's calm "frame" cue (spec 06/07) */
    .catalog__seasonword {
      position: absolute;
      right: 0;
      bottom: -0.1em;
      font-size: clamp(var(--text-3xl), 18vw, 16rem);
      z-index: 0;
    }

    .catalog__heading h1 {
      position: relative;
      z-index: 1;
    }

    .catalog__banner {
      display: flex;
      align-items: center;
      min-height: var(--touch-target);
      padding: var(--space-3) var(--space-5);
      border: 1px solid var(--accent);
      border-radius: var(--radius-md);
      color: var(--accent);
      font-size: var(--text-sm);
    }

    .catalog__fit-banner {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      flex-wrap: wrap;
      min-height: var(--touch-target);
      padding: var(--space-3) var(--space-5);
      border: 1px solid var(--line);
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
    }

    .catalog__fit-check {
      color: var(--success);
      font-weight: var(--weight-medium);
    }

    .catalog__change {
      margin-left: auto;
      color: var(--accent);
    }

    .catalog__filters {
      display: grid;
      gap: var(--space-3);
    }

    .catalog__filter-group {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .catalog__filter-label {
      color: var(--ink-1);
      font-size: var(--text-xs);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      min-width: 84px;
    }

    .catalog__pill {
      min-height: 32px;
      padding: 0 var(--space-3);
      border: 1px solid var(--line);
      border-radius: var(--radius-full);
      color: var(--ink-1);
      font-size: var(--text-sm);
      transition:
        color var(--dur-fast) var(--ease-out),
        border-color var(--dur-fast) var(--ease-out);

      &:hover {
        color: var(--ink-0);
      }

      &.is-active {
        color: var(--accent-ink);
        background: var(--accent);
        border-color: var(--accent);
      }
    }

    .catalog__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: var(--space-4);
    }

    .card {
      display: grid;
      gap: var(--space-2);
      padding: var(--space-4);
      background: var(--bg-1);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      transition: border-color var(--dur-fast) var(--ease-out);

      &:hover {
        border-color: #ffffff33;
      }
    }

    .card__media {
      position: relative;
      aspect-ratio: 1;
      border-radius: var(--radius-md);
      background: var(--bg-2);
      overflow: hidden;
    }

    .card__catalog {
      width: 100%;
      height: 100%;
      object-fit: contain;
      padding: var(--space-3);
      transition: opacity var(--dur-fast) var(--ease-out);
    }

    .card__mini {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      padding: var(--space-2);
      opacity: 0;
      transition: opacity var(--dur-fast) var(--ease-out);

      app-mini-stage {
        width: 100%;
      }
    }

    .card:hover .card__mini {
      opacity: 1;
    }

    .card:hover .card__media:has(.card__mini) .card__catalog {
      opacity: 0;
    }

    @media (prefers-reduced-motion: reduce) {
      .card__catalog,
      .card__mini {
        transition: none;
      }
    }

    .card__badges {
      display: flex;
      gap: var(--space-2);
      flex-wrap: wrap;
      min-height: 22px;
    }

    .badge {
      padding: 1px var(--space-2);
      border-radius: var(--radius-sm);
      font-size: var(--text-xs);
      border: 1px solid var(--line);
      color: var(--ink-1);
    }

    .badge--alt {
      color: var(--accent);
      border-color: var(--accent);
    }

    .card__title {
      font-size: var(--text-base);
    }

    .card__spec {
      color: var(--ink-1);
      font-size: var(--text-sm);
    }

    .card__price {
      display: flex;
      align-items: baseline;
      gap: var(--space-2);
      font-weight: var(--weight-medium);
    }

    .card__price-note {
      color: var(--ink-1);
      font-size: var(--text-xs);
      font-weight: var(--weight-regular);
    }

    .catalog__empty {
      grid-column: 1 / -1;
      display: grid;
      gap: var(--space-3);
      justify-items: start;
      padding: var(--space-6);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      color: var(--ink-1);
    }

    .catalog__reset {
      color: var(--accent);
      min-height: var(--touch-target);

      &:disabled {
        color: var(--ink-1);
        cursor: default;
      }
    }
  `,
})
export class CatalogPage {
  private readonly data = inject(FitmentDataService);
  private readonly engine = inject(FitmentEngineService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly garage = inject(GarageService);
  private readonly climate = inject(ClimateService);

  protected readonly seasons = SEASONS;

  private readonly allTires = toSignal(this.data.getTires(), { initialValue: [] as Tire[] });
  protected readonly brands = toSignal(this.data.getBrands(), { initialValue: [] as Brand[] });

  /** A6 mounted-thumbnail context (null without a car — cards stay studio-only). */
  protected readonly selectedTrim = this.engine.selectedTrim;
  protected readonly oemSidewallMm = computed(() => {
    const t = this.selectedTrim();
    return t ? oemReferenceSidewallMm(t.fitment) : 0;
  });

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  /** Explicit ?season= wins; otherwise fall back to the global climate (spec 06). */
  protected readonly seasonParam = computed(() => this.params().get('season') ?? this.climate.season() ?? '');
  protected readonly activeSeasonLabel = computed(
    () => SEASONS.find((s) => s.id === this.seasonParam())?.label ?? '',
  );
  protected readonly sizeParam = computed(() => this.params().get('rim') ?? '');
  protected readonly brandParam = computed(() => this.params().get('brand') ?? '');
  protected readonly sortParam = computed(() => (this.params().get('sort') ?? '') as SortKey | '');

  /** Compatible-only when a car is selected; full catalog otherwise (spec 06). */
  private readonly items = computed<CatalogItem[]>(() => {
    const fitted = this.engine.compatibleTires();
    if (fitted !== null) {
      return fitted.map((f) => ({ tire: f.tire, compatibility: f.compatibility }));
    }
    return this.allTires().map((tire) => ({ tire, compatibility: null }));
  });

  protected readonly filtered = computed<CatalogItem[]>(() => {
    const season = this.seasonParam();
    const rim = this.sizeParam();
    const brand = this.brandParam();
    const sort = this.sortParam();

    const list = this.items().filter(
      (item) =>
        (!season || item.tire.season === season) &&
        (!rim || `${item.tire.size.rimDiameterInch}` === rim) &&
        (!brand || item.tire.brandId === brand),
    );
    // OEM-first, then alternative sizes (spec); price (direction per sort) within a level.
    const levelRank = (i: CatalogItem) => (i.compatibility?.level === 'alternative' ? 1 : 0);
    return [...list].sort((a, b) => {
      const byLevel = levelRank(a) - levelRank(b);
      if (byLevel !== 0) {
        return byLevel;
      }
      return sort === 'price-desc'
        ? b.tire.priceGel - a.tire.priceGel
        : a.tire.priceGel - b.tire.priceGel;
    });
  });

  /** Options derive from the current (fitment-scoped) item set, not the full catalog. */
  protected readonly sizeOptions = computed(() =>
    [...new Set(this.items().map((i) => i.tire.size.rimDiameterInch))].sort((a, b) => a - b),
  );

  protected readonly hasActiveFilters = computed(
    () => !!(this.seasonParam() || this.sizeParam() || this.brandParam()),
  );

  private readonly brandNames = computed(() => new Map(this.brands().map((b) => [b.id, b.name])));

  protected brandName(brandId: string): string {
    return this.brandNames().get(brandId) ?? brandId;
  }

  protected toggleParam(key: string, value: string): void {
    const current = this.params().get(key);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [key]: current === value ? null : value },
      queryParamsHandling: 'merge',
    });
  }

  protected resetFilters(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { season: null, rim: null, brand: null },
      queryParamsHandling: 'merge',
    });
  }
}
