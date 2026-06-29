import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="footer">
      <p class="footer__tagline" i18n>საბურავები, რომლებიც ზუსტად მოერგება შენს მანქანას.</p>
      <p class="footer__legal num">© 2026 AUREN</p>
    </footer>
  `,
  styles: `
    .footer {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4);
      justify-content: space-between;
      padding: var(--space-7) var(--space-5);
      border-top: 1px solid var(--line);
      color: var(--ink-1);
      font-size: var(--text-sm);
    }

    .footer__tagline,
    .footer__legal {
      margin: 0;
    }
  `,
})
export class Footer {}
