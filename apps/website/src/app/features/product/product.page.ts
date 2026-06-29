import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import { FitmentRule, Season } from '@core/models';
import { FitmentDataService } from '@core/services/fitment-data.service';
import { FitmentEngineService, evaluateTireForCar } from '@core/services/fitment-engine.service';
import { GarageService } from '@core/services/garage.service';
import { EuLabel } from '@shared/components/eu-label/eu-label';
import { TireViewer } from '@shared/components/tire-viewer/tire-viewer';
import { LoadIndexPipe } from '@shared/pipes/load-index.pipe';
import { SpeedRatingPipe } from '@shared/pipes/speed-rating.pipe';
import { TireSizePipe } from '@shared/pipes/tire-size.pipe';

const RULE_LABELS: Record<FitmentRule, string> = {
  'rim-diameter': $localize`დისკის დიამეტრი`,
  'overall-diameter': $localize`საერთო დიამეტრი`,
  'load-index': $localize`დატვირთვის ინდექსი`,
  'speed-rating': $localize`სიჩქარის ინდექსი`,
};

const SEASON_LABELS: Record<Season, string> = {
  summer: $localize`ზაფხული`,
  winter: $localize`ზამთარი`,
  'all-season': $localize`ყველა სეზონი`,
};

/**
 * Product detail (spec 06). Compatibility block: checklist rendered from
 * CompatibilityResult.reasons + advisories when a car is selected (warnings
 * amber, winter speed-rating as info); otherwise an inline car-select prompt.
 */
@Component({
  selector: 'app-product-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CurrencyPipe, TireSizePipe, LoadIndexPipe, SpeedRatingPipe, EuLabel, TireViewer],
  template: `
    <section class="product">
      @if (tire(); as t) {
        <!-- Gallery slot: 3D viewer for tires with a GLB (A8), studio shot otherwise -->
        <div class="product__media">
          @if (t.media.glbUrl; as glbUrl) {
            @defer (on viewport) {
              <app-tire-viewer [glbUrl]="glbUrl" />
            } @placeholder {
              <img [src]="t.media.catalogUrl" [alt]="t.model" width="800" height="800" />
            }
          } @else {
            <img [src]="t.media.catalogUrl" [alt]="t.model" width="800" height="800" />
          }
        </div>

        <h1>{{ brandName() }} {{ t.model }}</h1>
        <p class="product__season">
          <span class="product__season-badge" [class]="'climate-' + t.season">{{
            seasonLabel(t.season)
          }}</span>
          <span class="num">{{ t.size | tireSize }}</span>
        </p>
        <p class="product__price">
          <span class="num">{{ t.priceGel * 4 | currency: 'GEL' : 'symbol' : '1.0-0' }}</span>
          <span class="product__price-note" i18n>კომპლექტი (4 ცალი)</span>
          ·
          <span class="num">{{ t.priceGel | currency: 'GEL' : 'symbol' : '1.0-0' }}</span>
          <span class="product__price-note" i18n>ერთი საბურავი</span>
        </p>

        @if (garage.selectedVehicle(); as vehicle) {
          @if (compatibility(); as c) {
            <div
              class="product__fit"
              [class.product__fit--ok]="c.fits"
              [class.product__fit--no]="!c.fits"
            >
              <p class="product__fit-head">
                @if (c.fits) {
                  <ng-container i18n>✓ ერგება შენს მანქანას:</ng-container>
                } @else {
                  <ng-container i18n>✗ არ ერგება შენს მანქანას:</ng-container>
                }
                {{ vehicle.label }}
                @if (c.level === 'alternative') {
                  <span class="product__fit-badge" i18n>alt ზომა</span>
                }
              </p>
              <ul class="product__checklist">
                @for (check of c.reasons; track check.rule) {
                  <li
                    class="product__check"
                    [class.product__check--warn]="check.status === 'warning'"
                    [class.product__check--fail]="check.status === 'fail'"
                  >
                    <span class="product__check-mark">{{
                      check.status === 'pass' ? '✓' : check.status === 'warning' ? '!' : '✗'
                    }}</span>
                    {{ ruleLabel(check.rule) }}
                    <span class="product__check-detail num">{{ check.detail }}</span>
                  </li>
                }
              </ul>
              @for (adv of c.advisories; track adv.kind) {
                <p class="product__advisory" [class.is-info]="adv.kind === 'winter-speed-rating'">
                  {{ adv.text }}
                </p>
              }
            </div>
          }
        } @else {
          <a routerLink="/garage" class="product__select-car" i18n>
            აარჩიე შენი მანქანა და ნახე, ერგება თუ არა →
          </a>
        }

        <app-eu-label [label]="t.euLabel" />

        <table class="product__specs">
          <tbody>
            <tr>
              <th i18n>ზომა</th>
              <td class="num">{{ t.size | tireSize }}</td>
            </tr>
            <tr>
              <th i18n>დატვირთვის ინდექსი</th>
              <td class="num">{{ t.loadIndex | loadIndex }}</td>
            </tr>
            <tr>
              <th i18n>სიჩქარის ინდექსი</th>
              <td class="num">{{ t.speedRating | speedRating }}</td>
            </tr>
            <tr>
              <th i18n>სეზონი</th>
              <td>{{ t.season }}</td>
            </tr>
            @if (t.attributes.runFlat) {
              <tr>
                <th i18n>Run-flat</th>
                <td i18n>კი</td>
              </tr>
            }
            @if (t.attributes.threePMSF) {
              <tr>
                <th>3PMSF</th>
                <td i18n>კი (მძიმე თოვლი)</td>
              </tr>
            }
            @if (t.attributes.treadDepthMm) {
              <tr>
                <th i18n>პროტექტორის სიღრმე</th>
                <td class="num">{{ t.attributes.treadDepthMm }} მმ</td>
              </tr>
            }
            <tr>
              <th i18n>მარაგში</th>
              <td class="num">{{ t.inStock }}</td>
            </tr>
          </tbody>
        </table>
      } @else {
        <h1 i18n>საბურავი ვერ მოიძებნა</h1>
        <a routerLink="/catalog" i18n>← კატალოგში დაბრუნება</a>
      }
    </section>
  `,
  styles: `
    .product {
      max-width: 720px;
      margin: 0 auto;
      padding: var(--space-8) var(--space-5);
      display: grid;
      gap: var(--space-5);
    }

    .product__media {
      aspect-ratio: 4 / 3;
      background: var(--bg-1);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      overflow: hidden;

      img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        padding: var(--space-5);
      }

      app-tire-viewer {
        height: 100%;
      }
    }

    .product__season {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      color: var(--ink-1);
    }

    .product__season-badge {
      padding: 2px var(--space-3);
      border: 1px solid var(--clime-key);
      border-radius: var(--radius-full);
      color: var(--clime-key);
      font-size: var(--text-sm);
    }

    .product__price {
      display: flex;
      align-items: baseline;
      gap: var(--space-2);
      font-size: var(--text-lg);
      font-weight: var(--weight-medium);
    }

    .product__price-note {
      color: var(--ink-1);
      font-size: var(--text-sm);
      font-weight: var(--weight-regular);
    }

    .product__fit {
      display: grid;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-5);
      border-radius: var(--radius-md);
      border: 1px solid var(--line);
      background: var(--bg-1);
    }

    .product__fit--ok {
      border-color: color-mix(in srgb, var(--success) 50%, transparent);
    }

    .product__fit--no {
      border-color: color-mix(in srgb, var(--danger) 50%, transparent);
    }

    .product__fit-head {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
      font-weight: var(--weight-medium);
    }

    .product__fit-badge {
      padding: 1px var(--space-2);
      border: 1px solid var(--accent);
      border-radius: var(--radius-sm);
      color: var(--accent);
      font-size: var(--text-xs);
      font-weight: var(--weight-regular);
    }

    .product__checklist {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: var(--space-1);
      font-size: var(--text-sm);
      color: var(--ink-1);
    }

    .product__check {
      display: flex;
      align-items: baseline;
      gap: var(--space-2);
    }

    .product__check-mark {
      display: inline-block;
      width: 1.2em;
      color: var(--success);
    }

    .product__check-detail {
      color: var(--ink-1);
      font-size: var(--text-xs);
      margin-left: auto;
    }

    .product__check--warn .product__check-mark,
    .product__check--warn {
      color: var(--warning);
    }

    .product__check--fail .product__check-mark,
    .product__check--fail {
      color: var(--danger);
    }

    .product__advisory {
      color: var(--warning);
      font-size: var(--text-sm);
    }

    .product__advisory.is-info {
      color: var(--ink-1);
    }

    .product__select-car {
      color: var(--accent);
    }

    .product__specs {
      border-collapse: collapse;

      th,
      td {
        padding: var(--space-3) var(--space-4);
        border-bottom: 1px solid var(--line);
        text-align: left;
      }

      th {
        color: var(--ink-1);
        font-weight: var(--weight-regular);
        font-size: var(--text-sm);
      }
    }
  `,
})
export class ProductPage {
  private readonly data = inject(FitmentDataService);
  private readonly engine = inject(FitmentEngineService);
  protected readonly garage = inject(GarageService);

  /** route param via withComponentInputBinding */
  readonly id = input.required<string>();

  protected readonly tire = toSignal(
    toObservable(this.id).pipe(switchMap((id) => this.data.getTire(id))),
  );

  protected readonly brands = toSignal(this.data.getBrands(), { initialValue: [] });
  protected readonly brandName = computed(() => {
    const t = this.tire();
    if (!t) {
      return '';
    }
    return this.brands().find((b) => b.id === t.brandId)?.name ?? t.brandId;
  });

  protected readonly compatibility = computed(() => {
    const trim = this.engine.selectedTrim();
    const tire = this.tire();
    return trim && tire ? evaluateTireForCar(trim.fitment, tire) : null;
  });

  protected ruleLabel(rule: FitmentRule): string {
    return RULE_LABELS[rule];
  }

  protected seasonLabel(season: Season): string {
    return SEASON_LABELS[season];
  }
}
