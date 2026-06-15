import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { EuTireLabel } from '@core/models';

/**
 * EU tyre label block (spec 04/06) — fuel efficiency, wet grip, and exterior
 * noise as a compact premium spec surface. `compact` renders just the two
 * grade chips (catalog cards / rail); the full form adds the noise readout.
 */
@Component({
  selector: 'app-eu-label',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="eu" [class.eu--compact]="compact()">
      <span class="eu__cell" [attr.data-grade]="label().fuelEfficiency">
        <span class="eu__cap" i18n>საწვავი</span>
        <span class="eu__grade">{{ label().fuelEfficiency }}</span>
      </span>
      <span class="eu__cell" [attr.data-grade]="label().wetGrip">
        <span class="eu__cap" i18n>სველი</span>
        <span class="eu__grade">{{ label().wetGrip }}</span>
      </span>
      @if (!compact()) {
        <span class="eu__cell eu__cell--noise">
          <span class="eu__cap" i18n>ხმა</span>
          <span class="eu__grade num">{{ label().noiseDb }} dB · {{ label().noiseClass }}</span>
        </span>
      }
    </div>
  `,
  styles: `
    .eu {
      display: inline-flex;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .eu__cell {
      display: inline-grid;
      gap: 2px;
      justify-items: center;
      padding: var(--space-1) var(--space-2);
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      min-width: 44px;
    }

    .eu__cell--noise {
      min-width: auto;
    }

    .eu__cap {
      font-size: var(--text-xs);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--ink-1);
    }

    .eu__grade {
      font-weight: var(--weight-medium);
    }

    /* Grade A reads best; D/E muted — communicated with weight + the success tint. */
    .eu__cell[data-grade='A'] .eu__grade {
      color: var(--success);
    }

    .eu__cell[data-grade='D'] .eu__grade,
    .eu__cell[data-grade='E'] .eu__grade {
      color: var(--ink-1);
    }
  `,
})
export class EuLabel {
  readonly label = input.required<EuTireLabel>();
  readonly compact = input(false);
}
