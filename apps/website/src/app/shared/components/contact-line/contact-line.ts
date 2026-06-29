import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The contact-line motif (spec 07) — a precise horizontal hairline marking where
 * tire meets ground ("rubber meets road"). The brand's recurring device: section
 * dividers, the baseline under the giant season word, and (animated) a calm
 * loading indicator. Replaces the rim-era PCD bolt-circle.
 *
 * - `glow` adds a faint pool of the active climate key light at center.
 * - `animated` sweeps a highlight along the line (loaders); reduced-motion off.
 */
@Component({
  selector: 'app-contact-line',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="cl" [class.cl--glow]="glow()" [class.cl--animated]="animated()" aria-hidden="true"></span>`,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .cl {
      position: relative;
      display: block;
      height: 1px;
      width: 100%;
      background: var(--line);
      overflow: hidden;
    }

    /* a soft pool of the season's key light, centered on the line */
    .cl--glow::before {
      content: '';
      position: absolute;
      inset: -10px 0;
      background: radial-gradient(ellipse 40% 100% at 50% 50%, var(--clime-glow), transparent 70%);
    }

    /* loading sweep: a thin highlight of the key light travels the line */
    .cl--animated::after {
      content: '';
      position: absolute;
      top: 0;
      left: -40%;
      width: 40%;
      height: 100%;
      background: linear-gradient(90deg, transparent, var(--clime-key), transparent);
      animation: cl-sweep 1.4s var(--ease-out) infinite;
    }

    @keyframes cl-sweep {
      to {
        transform: translateX(350%);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .cl--animated::after {
        animation: none;
        left: 30%;
        opacity: 0.6;
      }
    }
  `,
})
export class ContactLine {
  readonly glow = input(true);
  readonly animated = input(false);
}
