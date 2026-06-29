import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CartService } from '@core/services/cart.service';

/** Cart (spec 06). Line items, qty steppers, and warnings arrive in Phase 5. */
@Component({
  selector: 'app-cart-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="page">
      <h1 i18n>კალათა</h1>
      @if (cart.isEmpty()) {
        <p class="page__hint" i18n>კალათა ცარიელია — დაიწყე კატალოგიდან.</p>
        <a routerLink="/catalog" class="page__link" i18n>კატალოგის ნახვა</a>
      } @else {
        <p class="page__hint" i18n>კალათის სრული გვერდი მზადდება — ფაზა 5.</p>
      }
    </section>
  `,
  styles: `
    .page {
      max-width: var(--container-max);
      margin: 0 auto;
      padding: var(--space-8) var(--space-5);
      display: grid;
      gap: var(--space-4);
      justify-items: start;
    }

    .page__hint {
      color: var(--ink-1);
    }

    .page__link {
      color: var(--accent);
    }
  `,
})
export class CartPage {
  protected readonly cart = inject(CartService);
}
