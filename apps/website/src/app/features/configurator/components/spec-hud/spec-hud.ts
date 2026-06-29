import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { FitmentRule } from '@core/models';
import { FittedTire } from '@core/services/fitment-engine.service';
import { EuLabel } from '@shared/components/eu-label/eu-label';
import { LoadIndexPipe } from '@shared/pipes/load-index.pipe';
import { SpeedRatingPipe } from '@shared/pipes/speed-rating.pipe';
import { TireSizePipe } from '@shared/pipes/tire-size.pipe';

const RULE_LABELS: Record<FitmentRule, string> = {
  'rim-diameter': $localize`დისკის დიამეტრი`,
  'overall-diameter': $localize`საერთო დიამეტრი`,
  'load-index': $localize`დატვირთვის ინდექსი`,
  'speed-rating': $localize`სიჩქარის ინდექსი`,
};

/**
 * Spec HUD (spec 05): tire identity, full spec chips (size, load index, speed
 * rating), the compatibility checklist rendered from CompatibilityResult.reasons
 * + advisories, the EU label block, set price, and the add-set CTA. The
 * single-item @for keyed by tire id recreates the panel per tire, driving the
 * crossfade in pure CSS.
 */
@Component({
  selector: 'app-spec-hud',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, TireSizePipe, LoadIndexPipe, SpeedRatingPipe, EuLabel],
  template: `
    @for (item of fittedAsList(); track item.tire.id) {
      <div class="hud">
        <header class="hud__head">
          <h2 class="hud__name">{{ brandName() }} {{ item.tire.model }}</h2>
          <p class="hud__season">{{ seasonLabel(item.tire.season) }}</p>
        </header>

        <div class="hud__chips" i18n-aria-label aria-label="საბურავის სპეციფიკაცია">
          <span class="hud__chip num">{{ item.tire.size | tireSize }}</span>
          <span class="hud__chip num">{{ item.tire.loadIndex | loadIndex }}</span>
          <span class="hud__chip num">{{ item.tire.speedRating | speedRating }}</span>
          @if (item.axle === 'rear') {
            <span class="hud__chip" i18n>უკანა ღერძი</span>
          }
        </div>

        <app-eu-label [label]="item.tire.euLabel" />

        <ul class="hud__checklist" role="list" i18n-aria-label aria-label="თავსებადობის შემოწმება">
          @for (check of item.compatibility.reasons; track check.rule) {
            <li class="hud__check" [class.is-warning]="check.status === 'warning'">
              <span class="hud__check-mark" aria-hidden="true">
                {{ check.status === 'pass' ? '✓' : check.status === 'warning' ? '!' : '✕' }}
              </span>
              <span>{{ ruleLabel(check.rule) }}</span>
            </li>
          }
        </ul>

        @for (adv of item.compatibility.advisories; track adv.kind) {
          <p class="hud__advisory" [class.is-info]="adv.kind === 'winter-speed-rating'">
            {{ adv.text }}
          </p>
        }

        @if (item.compatibility.level === 'alternative') {
          <p class="hud__alt" i18n>ალტერნატიული ზომა — არა OEM</p>
        }

        <div class="hud__price">
          <span class="hud__price-set num">{{ item.tire.priceGel * 4 | currency: 'GEL' : 'symbol' : '1.0-0' }}</span>
          <span class="hud__price-note">
            <ng-container i18n>კომპლექტი (4 ცალი)</ng-container>
            · <span class="num">{{ item.tire.priceGel | currency: 'GEL' : 'symbol' : '1.0-0' }}</span>
            <ng-container i18n>/ ცალი</ng-container>
          </span>
        </div>

        <button
          type="button"
          class="hud__cta"
          [disabled]="item.tire.inStock < 4"
          (click)="onAdd($event)"
        >
          @if (item.tire.inStock >= 4) {
            <ng-container i18n>კომპლექტის დამატება კალათაში</ng-container>
          } @else {
            <ng-container i18n>მარაგში არ არის</ng-container>
          }
        </button>

        @if (item.tire.media.glbUrl) {
          <button type="button" class="hud__inspect" (click)="inspect.emit()" i18n>
            ⟳ 3D დათვალიერება
          </button>
        }
      </div>
    } @empty {
      <div class="hud hud--empty">
        <p i18n>აირჩიე საბურავი ქვემოთ — ნახავ ფასს და თავსებადობას.</p>
      </div>
    }
  `,
  styles: `
    .hud {
      display: grid;
      gap: var(--space-4);
      padding: var(--space-5);
      background: var(--bg-1);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      animation: hud-in var(--dur-base) var(--ease-out);
    }

    @keyframes hud-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .hud {
        animation: none;
      }
    }

    .hud--empty {
      color: var(--ink-1);
    }

    .hud__name {
      font-family: var(--font-display);
      font-size: var(--text-lg);
    }

    .hud__season {
      color: var(--ink-1);
      font-size: var(--text-sm);
      text-transform: capitalize;
    }

    .hud__chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .hud__chip {
      padding: 2px var(--space-2);
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      font-size: var(--text-xs);
      color: var(--ink-1);
    }

    .hud__checklist {
      display: grid;
      gap: var(--space-1);
      font-size: var(--text-sm);
    }

    .hud__check {
      display: flex;
      align-items: baseline;
      gap: var(--space-2);
    }

    .hud__check-mark {
      color: var(--success);
      font-weight: var(--weight-medium);
      width: 1em;
    }

    .hud__check.is-warning .hud__check-mark,
    .hud__check.is-warning {
      color: var(--warning);
    }

    .hud__advisory {
      color: var(--warning);
      font-size: var(--text-xs);
    }

    .hud__advisory.is-info {
      color: var(--ink-1);
    }

    .hud__alt {
      color: var(--accent);
      font-size: var(--text-xs);
    }

    .hud__price {
      display: grid;
      gap: var(--space-1);
    }

    .hud__price-set {
      font-family: var(--font-display);
      font-size: var(--text-2xl);
      font-weight: var(--weight-display);
    }

    .hud__price-note {
      color: var(--ink-1);
      font-size: var(--text-xs);
    }

    .hud__inspect {
      min-height: 36px;
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      color: var(--ink-1);
      font-size: var(--text-sm);
      transition: color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);

      &:hover {
        color: var(--ink-0);
        border-color: var(--accent);
      }
    }

    .hud__cta {
      min-height: var(--touch-target);
      border-radius: var(--radius-md);
      background: var(--accent);
      color: var(--accent-ink);
      font-weight: var(--weight-medium);
      transition: opacity var(--dur-fast) var(--ease-out);

      &:hover:not(:disabled) {
        opacity: 0.88;
      }

      &:disabled {
        background: var(--bg-2);
        color: var(--ink-1);
        cursor: default;
      }
    }
  `,
})
export class SpecHud {
  readonly fitted = input.required<FittedTire | null>();
  readonly brandName = input('');
  /** Emits the CTA's viewport center — the fly-to-cart launch point. */
  readonly addToCart = output<{ x: number; y: number }>();
  /** A8: open the 3D viewer (only rendered for tires with a glbUrl). */
  readonly inspect = output<void>();

  /** Single-item list keyed by tire id → panel recreation → CSS crossfade. */
  protected readonly fittedAsList = computed(() => {
    const f = this.fitted();
    return f ? [f] : [];
  });

  protected ruleLabel(rule: FitmentRule): string {
    return RULE_LABELS[rule];
  }

  protected seasonLabel(season: string): string {
    return season;
  }

  protected onAdd(event: Event): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.addToCart.emit({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }
}
