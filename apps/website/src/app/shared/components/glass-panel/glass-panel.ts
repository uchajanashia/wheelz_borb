import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Minimal floating glass chrome (spec 07): a thin hairline border + soft backdrop
 * blur over the studio surface — NO heavy cards, NO drop-shadows (depth comes
 * from the photographic layers, not box-shadow). Wrap floating UI in this; it is
 * content-projected so any panel can adopt the language.
 */
@Component({
  selector: 'app-glass-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  styles: `
    :host {
      display: block;
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
    }
  `,
})
export class GlassPanel {}
