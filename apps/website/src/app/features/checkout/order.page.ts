import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Order confirmation (spec 06). Summary + celebratory animation arrive in Phase 5. */
@Component({
  selector: 'app-order-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <h1 i18n>შეკვეთა მიღებულია</h1>
      <p class="page__hint">
        <span i18n>შეკვეთის ნომერი:</span>
        <span class="num">{{ id() }}</span>
      </p>
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
      display: flex;
      gap: var(--space-2);
    }
  `,
})
export class OrderPage {
  /** route param via withComponentInputBinding */
  readonly id = input.required<string>();
}
