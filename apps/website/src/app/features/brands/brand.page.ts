import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';

import { FitmentDataService } from '@core/services/fitment-data.service';

/** Brand storytelling page (spec 06, phase 5+). Phase 1: minimal data-backed stub. */
@Component({
  selector: 'app-brand-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      @if (brand(); as b) {
        <h1>{{ b.name }}</h1>
        <p class="page__meta">{{ b.country }} · {{ b.tier }}</p>
        @if (b.story) {
          <p class="page__story">{{ b.story }}</p>
        }
      } @else {
        <h1 i18n>ბრენდი ვერ მოიძებნა</h1>
      }
    </section>
  `,
  styles: `
    .page {
      max-width: 720px;
      margin: 0 auto;
      padding: var(--space-8) var(--space-5);
      display: grid;
      gap: var(--space-4);
    }

    .page__meta {
      color: var(--accent);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .page__story {
      color: var(--ink-1);
    }
  `,
})
export class BrandPage {
  private readonly data = inject(FitmentDataService);

  /** route param via withComponentInputBinding */
  readonly id = input.required<string>();

  protected readonly brand = toSignal(
    toObservable(this.id).pipe(
      switchMap((id) => this.data.getBrands().pipe(map((brands) => brands.find((b) => b.id === id)))),
    ),
  );
}
