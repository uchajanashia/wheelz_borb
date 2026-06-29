import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Checkout (spec 06): contact, delivery OR installation booking, stubbed payment —
 * all Phase 5. Route is guarded by `cartNotEmptyGuard`.
 */
@Component({
  selector: 'app-checkout-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <h1 i18n>შეკვეთის გაფორმება</h1>
      <p class="page__hint" i18n>გაფორმების გვერდი მზადდება — ფაზა 5.</p>
    </section>
  `,
  styles: `
    .page {
      max-width: var(--container-max);
      margin: 0 auto;
      padding: var(--space-8) var(--space-5);
      display: grid;
      gap: var(--space-4);
    }

    .page__hint {
      color: var(--ink-1);
    }
  `,
})
export class CheckoutPage {}
