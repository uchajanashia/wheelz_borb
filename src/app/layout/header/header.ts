import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { Season } from '@core/models';
import { CartService } from '@core/services/cart.service';
import { ClimateService } from '@core/services/climate.service';
import { GarageService } from '@core/services/garage.service';

const SEASON_LABELS: Record<Season, string> = {
  summer: $localize`ზაფხული`,
  winter: $localize`ზამთარი`,
  'all-season': $localize`ყველა სეზონი`,
};

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="header">
      <a routerLink="/" class="header__brand" aria-label="AUREN">
        <span class="header__wordmark">AUREN</span>
      </a>

      <nav class="header__nav" i18n-aria-label aria-label="მთავარი ნავიგაცია">
        <a routerLink="/catalog" routerLinkActive="is-active" i18n>კატალოგი</a>
        <a routerLink="/configurator" routerLinkActive="is-active" i18n>კონფიგურატორი</a>
      </nav>

      <div class="header__actions">
        <a routerLink="/season" class="header__chip header__season" routerLinkActive="is-active">
          <span class="header__chip-cap eyebrow" i18n>სეზონი</span>
          <span class="header__chip-val">{{ seasonLabel() }}</span>
        </a>
        <a routerLink="/garage" class="header__chip" routerLinkActive="is-active">
          @if (garage.selectedVehicle(); as vehicle) {
            <span class="header__garage-label">{{ vehicle.label }}</span>
          } @else {
            <span class="header__garage-label" i18n>აარჩიე მანქანა</span>
          }
        </a>
        <a routerLink="/cart" class="header__cart" i18n-aria-label aria-label="კალათა">
          <span i18n>კალათა</span>
          @if (cart.setCount() > 0) {
            <span class="header__cart-badge num">{{ cart.setCount() }}</span>
          }
        </a>
      </div>
    </header>
  `,
  styles: `
    .header {
      position: sticky;
      top: 0;
      z-index: var(--z-header);
      display: flex;
      align-items: center;
      gap: var(--space-6);
      height: var(--header-height);
      padding: 0 var(--space-5);
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      border-bottom: 1px solid var(--line);
    }

    .header__brand {
      display: inline-flex;
      align-items: center;
    }

    .header__wordmark {
      font-family: var(--font-display);
      font-weight: var(--weight-display);
      font-size: var(--text-lg);
      letter-spacing: 0.22em;
    }

    .header__nav {
      display: flex;
      gap: var(--space-5);
      font-size: var(--text-sm);
      color: var(--ink-1);

      a {
        min-height: var(--touch-target);
        display: inline-flex;
        align-items: center;
        transition: color var(--dur-fast) var(--ease-out);

        &:hover,
        &.is-active {
          color: var(--ink-0);
        }
      }
    }

    .header__actions {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .header__chip {
      display: inline-flex;
      flex-direction: column;
      justify-content: center;
      gap: 1px;
      min-height: 38px;
      min-width: 0;
      padding: 0 var(--space-4);
      border: 1px solid var(--line);
      border-radius: var(--radius-full);
      font-size: var(--text-sm);
      color: var(--ink-1);
      transition:
        color var(--dur-fast) var(--ease-out),
        border-color var(--dur-fast) var(--ease-out);

      &:hover,
      &.is-active {
        color: var(--ink-0);
        border-color: var(--accent);
      }
    }

    .header__season .header__chip-val {
      color: var(--ink-0);
    }

    .header__chip-cap {
      line-height: 1;
    }

    .header__garage-label {
      max-width: 180px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .header__cart {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      min-height: var(--touch-target);
      font-size: var(--text-sm);
      color: var(--ink-1);
      transition: color var(--dur-fast) var(--ease-out);

      &:hover {
        color: var(--ink-0);
      }
    }

    .header__cart-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: var(--radius-full);
      background: var(--accent);
      color: var(--accent-ink);
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
    }

    @media (max-width: 768px) {
      .header__nav {
        display: none;
      }

      .header__garage-label {
        max-width: 110px;
      }
    }
  `,
})
export class Header {
  protected readonly garage = inject(GarageService);
  protected readonly cart = inject(CartService);
  protected readonly climate = inject(ClimateService);

  protected readonly seasonLabel = computed(() => {
    const s = this.climate.season();
    return s ? SEASON_LABELS[s] : $localize`ყველა`;
  });
}
