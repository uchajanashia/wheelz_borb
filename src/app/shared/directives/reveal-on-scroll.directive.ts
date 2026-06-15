import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';

import { MotionService } from '@core/services/motion.service';

/**
 * A4 — the default entrance for all sections/cards (spec 07): 24 px rise +
 * fade, once-only. Pass a group index to stagger siblings by 60 ms:
 *
 *   <article appReveal />            — immediate on enter
 *   <article [appReveal]="i" />      — i × 60 ms within its group
 *
 * Reduced motion / SSR: the element just renders in place.
 */
@Directive({ selector: '[appReveal]' })
export class RevealOnScroll {
  /** Stagger order within a group (spec 07: 60 ms steps). */
  readonly appReveal = input(0, {
    transform: (value: number | string) => (value === '' || value == null ? 0 : +value),
  });

  private readonly motion = inject(MotionService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      this.motion.reveal(
        this.el.nativeElement,
        { delay: this.appReveal() * 0.06 },
        this.destroyRef,
      );
    });
  }
}
