import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Season } from '@core/models';
import { ContactLine } from '@shared/components/contact-line/contact-line';

/**
 * Seasonal entry "frame" (spec 06 §4 / 07) — a large, atmospheric tile for one
 * climate. The host carries that season's `climate-<season>` class so the sky,
 * ground, key light, and glow render in the season's palette regardless of the
 * globally selected climate. Used on /season, the home season frames, and as the
 * styling cue in catalog/product. Calm by default (R2); the cinematic transition
 * is R3.
 */
@Component({
  selector: 'app-season-frame',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'climateClass()' },
  imports: [ContactLine],
  template: `
    <div class="frame" [class.is-active]="active()">
      <div class="frame__sky" aria-hidden="true"></div>
      <div class="frame__ground" aria-hidden="true"></div>
      <div class="frame__glow" aria-hidden="true"></div>
      <div class="frame__body">
        <span class="frame__word display">{{ label() }}</span>
        <app-contact-line [glow]="true" />
        <span class="frame__caption eyebrow">{{ caption() }}</span>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .frame {
      position: relative;
      overflow: hidden;
      min-height: 220px;
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      isolation: isolate;
      transition: border-color var(--dur-base) var(--ease-out);
    }

    .frame.is-active {
      border-color: var(--clime-key);
    }

    .frame__sky {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, var(--clime-sky-top), var(--clime-sky-low));
      opacity: 0.5;
      z-index: -2;
    }

    .frame__ground {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 32%;
      background: linear-gradient(180deg, transparent, var(--clime-ground));
      opacity: 0.75;
      z-index: -2;
    }

    .frame__glow {
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse 60% 50% at 50% 78%, var(--clime-glow), transparent 70%);
      z-index: -1;
    }

    .frame__body {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      gap: var(--space-3);
      padding: var(--space-5);
    }

    .frame__word {
      font-size: clamp(var(--text-2xl), 7vw, var(--text-4xl));
      line-height: 0.95;
      color: var(--ink-0);
      text-shadow: 0 2px 24px #00000055;
    }

    .frame__caption {
      color: var(--ink-0);
      opacity: 0.85;
    }
  `,
})
export class SeasonFrame {
  readonly season = input.required<Season>();
  readonly label = input.required<string>();
  readonly caption = input('');
  readonly active = input(false);

  protected readonly climateClass = computed(() => `climate-${this.season()}`);
}
