import { CurrencyPipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';

import { Brand } from '@core/models';
import { FittedTire } from '@core/services/fitment-engine.service';
import { TireSizePipe } from '@shared/pipes/tire-size.pipe';

interface PriceBand {
  id: string;
  label: string;
  /** inclusive set-price (×4) bounds */
  min: number;
  max: number;
}

/** Eagerly decoded sidewall images when the rail renders (spec 05 preload). */
const EAGER_PRELOAD_COUNT = 8;

/**
 * Horizontal scroll-snap rail of compatible tires (spec 05 §3). The list comes
 * from FitmentEngineService's computed signal via the page; inline filters only
 * re-query that in-memory list — never refetch. Sidewall images for the first N
 * chips are decoded eagerly, the rest prefetch on hover/focus so the swap
 * animation never waits on the network.
 */
@Component({
  selector: 'app-tire-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, TireSizePipe],
  template: `
    <div class="rail">
      <div class="rail__filters" i18n-aria-label aria-label="საბურავების ფილტრები">
        <div class="rail__group">
          @for (d of sizeOptions(); track d) {
            <button type="button" class="rail__pill num" [class.is-active]="rim() === d"
              (click)="toggle(rim, d)">{{ d }}″</button>
          }
        </div>
        <div class="rail__group">
          @for (b of brandOptions(); track b.id) {
            <button type="button" class="rail__pill" [class.is-active]="brandId() === b.id"
              (click)="toggle(brandId, b.id)">{{ b.name }}</button>
          }
        </div>
        <div class="rail__group">
          @for (band of priceBands; track band.id) {
            <button type="button" class="rail__pill num" [class.is-active]="priceBand() === band.id"
              (click)="toggle(priceBand, band.id)">{{ band.label }}</button>
          }
        </div>
      </div>

      <ul class="rail__track" role="list" i18n-aria-label aria-label="თავსებადი საბურავები">
        @for (item of filtered(); track item.tire.id; let i = $index) {
          <li class="rail__item">
            <button
              #chip
              type="button"
              class="rail__chip"
              [class.is-selected]="item.tire.id === selectedId()"
              [attr.aria-pressed]="item.tire.id === selectedId()"
              [tabindex]="i === focusIndex() ? 0 : -1"
              (click)="pick.emit(item)"
              (focus)="focusIndex.set(i)"
              (keydown)="onKeydown($event, i)"
              (pointerenter)="prefetch(item)"
            >
              <img class="rail__face" [src]="item.tire.media.sidewallUrl" alt="" width="104" height="104" loading="lazy" draggable="false" />
              <span class="rail__badges" aria-hidden="true">
                @if (item.compatibility.level === 'alternative') {
                  <span class="rail__badge rail__badge--alt" i18n>alt ზომა</span>
                }
                @if (item.tire.attributes.runFlat) {
                  <span class="rail__badge">RF</span>
                }
                @if (item.tire.attributes.threePMSF) {
                  <span class="rail__badge">3PMSF</span>
                }
              </span>
              <span class="rail__name">{{ brandName(item.tire.brandId) }} {{ item.tire.model }}</span>
              <span class="rail__spec num">{{ item.tire.size | tireSize }} · {{ item.tire.euLabel.wetGrip }}</span>
              <span class="rail__price num">{{ item.tire.priceGel * 4 | currency: 'GEL' : 'symbol' : '1.0-0' }}</span>
            </button>
          </li>
        } @empty {
          <li class="rail__empty">
            @if (items().length === 0) {
              <p i18n>ამ მანქანისთვის თავსებადი საბურავები ამჟამად მარაგში არ არის.</p>
              <button type="button" class="rail__reset" disabled i18n>შემატყობინე როცა გამოჩნდება (მალე)</button>
            } @else {
              <p i18n>ფილტრს არცერთი თავსებადი საბურავი არ შეესაბამება.</p>
              <button type="button" class="rail__reset" (click)="resetFilters()" i18n>ფილტრების გასუფთავება</button>
            }
          </li>
        }
      </ul>
    </div>
  `,
  styles: `
    .rail {
      display: grid;
      gap: var(--space-3);
      min-width: 0;
    }

    .rail__filters {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2) var(--space-4);
    }

    .rail__group {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .rail__pill {
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

    .rail__track {
      display: flex;
      gap: var(--space-3);
      overflow-x: auto;
      padding: var(--space-1) var(--space-1) var(--space-3);
      scroll-snap-type: x mandatory;
      scrollbar-width: thin;
      /* horizontal pan only — never fight vertical page scroll (spec 08) */
      touch-action: pan-x pan-y;
    }

    .rail__item {
      scroll-snap-align: start;
      flex: 0 0 auto;
    }

    .rail__chip {
      display: grid;
      justify-items: center;
      gap: var(--space-1);
      width: 148px;
      padding: var(--space-3);
      background: var(--bg-1);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      transition: border-color var(--dur-fast) var(--ease-out);

      &:hover {
        border-color: #ffffff33;
      }

      &.is-selected {
        border-color: var(--accent);
      }
    }

    .rail__face {
      width: 104px;
      height: 104px;
    }

    .rail__badges {
      display: flex;
      gap: var(--space-1);
      min-height: 18px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .rail__badge {
      padding: 0 var(--space-2);
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      color: var(--ink-1);
      font-size: var(--text-xs);
    }

    .rail__badge--alt {
      color: var(--accent);
      border-color: var(--accent);
    }

    .rail__name {
      font-size: var(--text-sm);
      text-align: center;
    }

    .rail__spec {
      color: var(--ink-1);
      font-size: var(--text-xs);
    }

    .rail__price {
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
    }

    .rail__empty {
      display: grid;
      gap: var(--space-3);
      justify-items: start;
      padding: var(--space-5);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      color: var(--ink-1);
    }

    .rail__reset {
      color: var(--accent);
      min-height: var(--touch-target);

      &:disabled {
        color: var(--ink-1);
        cursor: default;
      }
    }
  `,
})
export class TireRail {
  /** Compatible tires from the fitment engine (already vehicle-scoped). */
  readonly items = input.required<FittedTire[]>();
  readonly selectedId = input<string | null>(null);
  readonly brands = input<Brand[]>([]);
  readonly pick = output<FittedTire>();

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly rim = signal<number | null>(null);
  protected readonly brandId = signal<string | null>(null);
  protected readonly priceBand = signal<string | null>(null);
  protected readonly focusIndex = signal(0);

  protected readonly priceBands: PriceBand[] = [
    { id: 'low', label: '≤ ₾1600', min: 0, max: 1600 },
    { id: 'mid', label: '₾1600–2400', min: 1600, max: 2400 },
    { id: 'high', label: '₾2400+', min: 2400, max: Infinity },
  ];

  private readonly chips = viewChildren<ElementRef<HTMLButtonElement>>('chip');
  private readonly prefetched = new Set<string>();

  /** Filters re-query the computed list in memory — never refetch (spec 05). */
  protected readonly filtered = computed(() => {
    const rim = this.rim();
    const brand = this.brandId();
    const band = this.priceBands.find((b) => b.id === this.priceBand());
    const list = this.items().filter((item) => {
      const setPrice = item.tire.priceGel * 4;
      return (
        (rim === null || item.tire.size.rimDiameterInch === rim) &&
        (brand === null || item.tire.brandId === brand) &&
        (!band || (setPrice >= band.min && setPrice < band.max))
      );
    });
    // OEM-first, then alternative sizes, then by set price (spec R2).
    const levelRank = (i: FittedTire) => (i.compatibility.level === 'alternative' ? 1 : 0);
    return [...list].sort(
      (a, b) => levelRank(a) - levelRank(b) || a.tire.priceGel - b.tire.priceGel,
    );
  });

  protected readonly sizeOptions = computed(() =>
    [...new Set(this.items().map((i) => i.tire.size.rimDiameterInch))].sort((a, b) => a - b),
  );
  protected readonly brandOptions = computed(() => {
    const present = new Set(this.items().map((i) => i.tire.brandId));
    return this.brands().filter((b) => present.has(b.id));
  });

  private readonly brandNames = computed(() => new Map(this.brands().map((b) => [b.id, b.name])));

  constructor() {
    // Preload: eagerly decode the first N visible faces whenever the list changes.
    effect(() => {
      const visible = this.filtered().slice(0, EAGER_PRELOAD_COUNT);
      if (this.isBrowser) {
        for (const item of visible) {
          this.prefetch(item);
        }
      }
    });
  }

  protected brandName(brandId: string): string {
    return this.brandNames().get(brandId) ?? brandId;
  }

  protected toggle<T>(state: { (): T | null; set(v: T | null): void }, value: T): void {
    state.set(state() === value ? null : value);
  }

  protected resetFilters(): void {
    this.rim.set(null);
    this.brandId.set(null);
    this.priceBand.set(null);
  }

  /** Hover/focus prefetch so a tap never waits on the network (spec 05). */
  protected prefetch(item: FittedTire): void {
    const url = item.tire.media.sidewallUrl;
    if (!this.isBrowser || this.prefetched.has(url)) {
      return;
    }
    this.prefetched.add(url);
    const img = new Image();
    img.src = url;
    void img.decode().catch(() => this.prefetched.delete(url));
  }

  /** Arrow-key navigation with roving tabindex (spec 08 a11y). */
  protected onKeydown(event: KeyboardEvent, index: number): void {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (delta === 0) {
      return;
    }
    event.preventDefault();
    const chips = this.chips();
    const next = Math.min(Math.max(index + delta, 0), chips.length - 1);
    this.focusIndex.set(next);
    chips[next]?.nativeElement.focus();
  }
}
