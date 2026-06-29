/* eslint-disable no-restricted-imports -- the ONE allowed gsap import site (spec 07) */
import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, Signal, inject, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { gsap } from 'gsap';

/**
 * Central motion system (spec 07-design-animations.md). GSAP and its plugins
 * are registered ONLY here; components inject MotionService and never import
 * gsap directly (enforced by the no-restricted-imports lint rule).
 *
 * - `reduced` honors prefers-reduced-motion globally and reactively.
 * - `timeline()` is auto-killed with the calling component (DestroyRef).
 * - `scrollScene()` wraps ScrollTrigger (lazy-loaded, browser-only); every
 *   trigger is tracked and killed on route leave. Under reduced motion the
 *   scene is rendered as a static final layout instead of a scrub animation.
 */
@Injectable({ providedIn: 'root' })
export class MotionService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly reducedState = signal(false);
  /** prefers-reduced-motion, reactive (media query listener). Always false on the server. */
  readonly reduced: Signal<boolean> = this.reducedState.asReadonly();

  /** Shared durations in seconds — mirror --dur-* tokens in styles/tokens.scss. */
  readonly dur = { fast: 0.15, base: 0.3, slow: 0.6 } as const;
  /** Shared easings — mirror --ease-* tokens. */
  readonly ease = { out: 'power3.out', seat: 'back.out(1.4)', settle: 'elastic.out(1, 0.6)' } as const;

  private scrollTriggerPlugin: typeof import('gsap/ScrollTrigger').ScrollTrigger | null = null;
  private readonly liveScrollTriggers = new Set<{ kill(): void }>();

  constructor() {
    // matchMedia is also absent in jsdom test environments — degrade to "not reduced".
    if (this.isBrowser && typeof window.matchMedia === 'function') {
      const query = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedState.set(query.matches);
      query.addEventListener('change', (e) => this.reducedState.set(e.matches));
    }

    // Spec 07: all ScrollTriggers killed on route leave.
    inject(Router)
      .events.pipe(filter((e) => e instanceof NavigationStart))
      .subscribe(() => this.killScrollScenes());
  }

  /**
   * A gsap timeline bound to the caller's lifecycle: killed automatically when
   * the calling component is destroyed. When invoked outside an injection
   * context, pass the component's DestroyRef explicitly.
   */
  timeline(vars?: gsap.TimelineVars, destroyRef?: DestroyRef): gsap.core.Timeline {
    const tl = gsap.timeline(vars);
    (destroyRef ?? this.currentDestroyRef())?.onDestroy(() => tl.kill());
    return tl;
  }

  /** Imperative property set without importing gsap (cleanup, initial states). */
  set(targets: gsap.TweenTarget, vars: gsap.TweenVars): void {
    if (this.isBrowser) {
      gsap.set(targets, vars);
    }
  }

  /** One-off tween without importing gsap. No-op (paused) on the server. */
  to(targets: gsap.TweenTarget, vars: gsap.TweenVars): gsap.core.Tween {
    return this.isBrowser ? gsap.to(targets, vars) : gsap.to(targets, { ...vars, paused: true });
  }

  /**
   * A4 `reveal-on-scroll` (spec 07): 24 px rise + fade, once-only, optional
   * stagger delay within a group. Under reduced motion the element simply
   * stays visible — the SSR markup is already in its final state.
   */
  reveal(el: Element, opts?: { delay?: number }, destroyRef?: DestroyRef): void {
    if (!this.isBrowser || this.reducedState()) {
      return;
    }
    const ref = destroyRef ?? this.currentDestroyRef();
    void this.loadScrollTrigger().then(() => {
      const tween = gsap.fromTo(
        el,
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: this.dur.base,
          ease: this.ease.out,
          delay: opts?.delay ?? 0,
          clearProps: 'transform,opacity',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        },
      );
      const st = tween.scrollTrigger as unknown as { kill(): void } | undefined;
      if (st) {
        this.liveScrollTriggers.add(st);
        ref?.onDestroy(() => {
          st.kill();
          this.liveScrollTriggers.delete(st);
        });
      }
    });
  }

  /**
   * ScrollTrigger wrapper, SSR-safe (no-op on the server). The plugin is
   * dynamically imported and registered once on first use, keeping it out of
   * the initial bundle. Reduced motion → the scene jumps to its final state.
   */
  scrollScene(
    trigger: Element,
    build: (tl: gsap.core.Timeline) => void,
    opts?: ScrollTrigger.Vars,
    destroyRef?: DestroyRef,
  ): void {
    if (!this.isBrowser) {
      return;
    }
    const ref = destroyRef ?? this.currentDestroyRef();
    void this.loadScrollTrigger().then((ScrollTrigger) => {
      if (this.reducedState()) {
        const tl = gsap.timeline({ paused: true });
        build(tl);
        tl.progress(1); // static final layout (spec 07 reduced-motion rule)
        return;
      }
      const tl = gsap.timeline({ scrollTrigger: { trigger, ...opts } });
      build(tl);
      const st = tl.scrollTrigger as unknown as { kill(): void } | undefined;
      if (st) {
        this.liveScrollTriggers.add(st);
        ref?.onDestroy(() => {
          st.kill();
          this.liveScrollTriggers.delete(st);
        });
      }
      void ScrollTrigger; // registered; refresh handled by the plugin itself
    });
  }

  /**
   * Flip helpers for A8 (3D viewer shared-element open/close). `flipSnapTo`
   * instantly transforms `el` to cover `source` (then animate to identity with
   * `to()`); `flipTo` animates `el` back onto `source` and resolves on finish.
   */
  async flipSnapTo(el: Element, source: Element): Promise<void> {
    const Flip = await this.loadFlip();
    Flip?.fit(el, source);
  }

  async flipTo(el: Element, source: Element, vars?: { duration?: number }): Promise<void> {
    const Flip = await this.loadFlip();
    if (!Flip) {
      return;
    }
    await new Promise<void>((resolve) => {
      Flip.fit(el, source, {
        duration: vars?.duration ?? this.dur.base,
        ease: this.ease.out,
        onComplete: resolve,
      });
    });
  }

  private flipPlugin: typeof import('gsap/Flip').Flip | null = null;

  private async loadFlip() {
    if (!this.isBrowser) {
      return null;
    }
    if (!this.flipPlugin) {
      const { Flip } = await import('gsap/Flip');
      gsap.registerPlugin(Flip);
      this.flipPlugin = Flip;
    }
    return this.flipPlugin;
  }

  private async loadScrollTrigger() {
    if (!this.scrollTriggerPlugin) {
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);
      this.scrollTriggerPlugin = ScrollTrigger;
    }
    return this.scrollTriggerPlugin;
  }

  private killScrollScenes(): void {
    for (const st of this.liveScrollTriggers) {
      st.kill();
    }
    this.liveScrollTriggers.clear();
  }

  /** inject() is only legal in an injection context — degrade gracefully outside one. */
  private currentDestroyRef(): DestroyRef | null {
    try {
      return inject(DestroyRef);
    } catch {
      return null;
    }
  }
}
