import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin, map } from 'rxjs';

import { Brand, Tire, VehicleTrim } from '@core/models';
import { FitmentDataService } from '@core/services/fitment-data.service';
import { oemReferenceSidewallMm } from '@core/services/fitment-engine.service';
import { serializeLook } from '@core/services/look-url';
import { MotionService } from '@core/services/motion.service';
import { ContactLine } from '@shared/components/contact-line/contact-line';
import { MiniStage } from '@shared/components/mini-stage/mini-stage';
import { RevealOnScroll } from '@shared/directives/reveal-on-scroll.directive';

/** Curated car+tire combos for the featured-looks rail — all verified fits. */
const FEATURED_LOOKS = [
  { trimId: 'bmw-3-series-g20-m340i', tireId: 'aurelia-sportcontact-7-22545r18' },
  { trimId: 'toyota-gr86-premium', tireId: 'kinetik-trackattack-21540r18' },
  { trimId: 'toyota-land-cruiser-prado-150-vx', tireId: 'aurelia-allseasoncontact-suv-26560r18' },
  { trimId: 'vw-golf-8-gti', tireId: 'kinetik-trackattack-22540r18' },
] as const;

interface FeaturedBuild {
  trim: VehicleTrim;
  tire: Tire;
  look: string;
}

/**
 * Home (spec 06) — the wow layer. NOTE (R1): the cinematic seasonal hero +
 * "drive through the seasons" scroll scene (the signature) are R4; this is the
 * surviving home skeleton with the domain swapped to tires (hero image, a
 * pinned showcase scroll scene, the fitment promise, featured looks, brand wall).
 */
@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ContactLine, MiniStage, RevealOnScroll],
  template: `
    <section class="hero" #hero (pointermove)="onHeroPointer($event)">
      <div class="hero__bg" #heroWrap aria-hidden="true">
        <img
          class="hero__bg-img"
          src="/main_hero.png"
          alt=""
          width="2688"
          height="1536"
          fetchpriority="high"
        />
      </div>
      <div class="hero__content">
        <p class="hero__kicker" i18n>Fitment-first • პრემიუმ საბურავები</p>
        <h1 class="hero__title display" i18n>საბურავები, რომლებიც ზუსტად მოერგება შენს მანქანას</h1>
        <p class="hero__sub" i18n>
          აირჩიე მანქანა და სეზონი ერთხელ — და ნახე მხოლოდ ის საბურავები, რომლებიც ფიზიკურად
          ერგება მას, პირდაპირ შენს მანქანაზე დამონტაჟებული.
        </p>
        <a routerLink="/garage" class="hero__cta" i18n>აარჩიე შენი მანქანა</a>
      </div>
      <div class="hero__scroll" aria-hidden="true">
        <span class="hero__scroll-line"></span>
      </div>
    </section>

    <!-- Pinned showcase scroll scene (one pinned scene per page) -->
    <section class="anatomy" #anatomy i18n-aria-label aria-label="საბურავის ანატომია">
      <div class="anatomy__inner">
        <h2 class="anatomy__title display" i18n>რა ანიჭებს საბურავს ხასიათს</h2>
        <div class="anatomy__stage">
          <img #layer1 class="anatomy__layer" src="/assets/showcase/tire-full.svg" alt="" width="800" height="800" />
          <img #layer2 class="anatomy__layer" src="/assets/showcase/tire-tread.svg" alt="" width="800" height="800" />
          <img #layer3 class="anatomy__layer" src="/assets/showcase/tire-catalog.svg" alt="" width="800" height="800" />
          <img #layer4 class="anatomy__layer" src="/assets/showcase/tire-full.svg" alt="" width="800" height="800" />
        </div>
        <ul class="anatomy__captions" role="list">
          <li #cap1 class="anatomy__caption"><strong i18n>გვერდითი კედელი</strong> <span i18n>პროფილი და ზომა</span></li>
          <li #cap2 class="anatomy__caption"><strong i18n>პროტექტორი</strong> <span i18n>კონტაქტი გზასთან</span></li>
          <li #cap3 class="anatomy__caption"><strong i18n>EU ეტიკეტი</strong> <span i18n>სველი გზა, ხმა, საწვავი</span></li>
          <li #cap4 class="anatomy__caption"><strong i18n>სეზონი</strong> <span i18n>ზაფხული, ზამთარი, ყველა სეზონი</span></li>
        </ul>
      </div>
    </section>

    <section class="promise" appReveal i18n-aria-label aria-label="როგორ მუშაობს">
      <article class="promise__step" [appReveal]="0">
        <app-contact-line class="promise__mark" [glow]="true" />
        <span class="promise__num num">01</span>
        <h3 i18n>აარჩიე მანქანა</h3>
        <p i18n>მარკა, მოდელი, თაობა, კომპლექტაცია — ერთხელ და სამუდამოდ.</p>
      </article>
      <article class="promise__step" [appReveal]="1">
        <app-contact-line class="promise__mark" [glow]="true" />
        <span class="promise__num num">02</span>
        <h3 i18n>აირჩიე სეზონი</h3>
        <p i18n>ზაფხული, ზამთარი თუ ყველა სეზონი — სცენა შესაბამისად იცვლება.</p>
      </article>
      <article class="promise__step" [appReveal]="2">
        <app-contact-line class="promise__mark" [glow]="true" />
        <span class="promise__num num">03</span>
        <h3 i18n>გარანტირებული თავსებადობა</h3>
        <p i18n>დისკის დიამეტრი, საერთო დიამეტრი, დატვირთვა, სიჩქარე — სისტემა ამოწმებს ყველაფერს.</p>
      </article>
    </section>

    <!-- featured looks — each card deep-links the exact ?look= -->
    <section class="builds" appReveal>
      <h2 class="builds__title display" i18n>რჩეული აწყობები</h2>
      <div class="builds__rail">
        @for (build of featured(); track build.look; let i = $index) {
          <a
            class="builds__card"
            [appReveal]="i"
            routerLink="/configurator"
            [queryParams]="{ look: build.look }"
          >
            <app-mini-stage
              [visual]="build.trim.visual"
              [tire]="build.tire"
              [oemSidewallMm]="oemSidewall(build.trim)"
            />
            <span class="builds__name">{{ build.trim.name }} × {{ build.tire.model }}</span>
            <span class="builds__finish">{{ build.tire.season }}</span>
          </a>
        }
      </div>
    </section>

    <!-- brand wall -->
    <section class="brands" appReveal>
      <h2 class="brands__title display" i18n>ბრენდები</h2>
      <div class="brands__wall">
        @for (brand of brands(); track brand.id; let i = $index) {
          <a class="brands__item" [appReveal]="i" routerLink="/catalog" [queryParams]="{ brand: brand.id }">
            <span class="brands__name">{{ brand.name }}</span>
            <span class="brands__tier">{{ brand.tier }}</span>
          </a>
        }
      </div>
    </section>

    <section class="service" appReveal>
      <h2 class="display" i18n>მონტაჟი და ბალანსირება თბილისში</h2>
      <p i18n>შეკვეთასთან ერთად დაჯავშნე მონტაჟი — დეტალები შეკვეთის გაფორმებისას.</p>
      <a routerLink="/catalog" class="service__cta" i18n>კატალოგის ნახვა →</a>
    </section>
  `,
  styles: `
    .hero {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      min-height: calc(100dvh - var(--header-height));
      padding: var(--space-7) var(--space-5);
      overflow: hidden;
      isolation: isolate;
    }

    /* Full-bleed background photo. Slight inset overscan so the parallax
       shift never reveals a hard edge. */
    .hero__bg {
      position: absolute;
      inset: -16px;
      z-index: -2;
    }

    .hero__bg-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
    }

    /* Legibility scrim — darkens the photo behind the centered text. */
    .hero::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -1;
      background:
        radial-gradient(125% 95% at 50% 62%, transparent 0%, #000000a6 100%),
        linear-gradient(180deg, #00000059 0%, transparent 28%, #000000c4 100%);
    }

    .hero__content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-4);
      max-width: 62ch;
    }

    .hero__kicker {
      color: var(--accent);
      font-size: var(--text-sm);
      letter-spacing: 0.2em;
      text-transform: uppercase;
    }

    .hero__title {
      max-width: 20ch;
      font-size: clamp(var(--text-xl), 3.4vw, var(--text-3xl));
      text-shadow: 0 2px 24px #000000cc;
    }

    .hero__sub {
      max-width: 50ch;
      color: var(--ink-0);
      font-size: var(--text-sm);
      text-shadow: 0 1px 14px #000000cc;
    }

    .hero__cta {
      display: inline-flex;
      align-items: center;
      min-height: var(--touch-target);
      padding: 0 var(--space-6);
      border-radius: var(--radius-full);
      background: var(--accent);
      color: var(--accent-ink);
      font-weight: var(--weight-medium);
    }

    .hero__scroll {
      position: absolute;
      bottom: var(--space-4);
      left: 50%;
    }

    .hero__scroll-line {
      display: block;
      width: 1px;
      height: 36px;
      background: linear-gradient(var(--clime-key), transparent);
      animation: scroll-hint 2.2s var(--ease-out) infinite;
    }

    @keyframes scroll-hint {
      0% { transform: scaleY(0); transform-origin: top; }
      45% { transform: scaleY(1); transform-origin: top; }
      55% { transform: scaleY(1); transform-origin: bottom; }
      100% { transform: scaleY(0); transform-origin: bottom; }
    }

    @media (prefers-reduced-motion: reduce) {
      .hero__scroll-line { animation: none; }
    }

    .anatomy {
      border-top: 1px solid var(--line);
    }

    .anatomy__inner {
      display: grid;
      align-content: center;
      justify-items: center;
      gap: var(--space-5);
      min-height: 100vh;
      padding: var(--space-6) var(--space-5);
      overflow: hidden;
    }

    .anatomy__title {
      font-size: clamp(var(--text-xl), 3.5vw, var(--text-3xl));
    }

    .anatomy__stage {
      position: relative;
      width: min(52vh, 78vw, 520px);
      aspect-ratio: 1;
    }

    .anatomy__layer {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }

    .anatomy__captions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--space-3) var(--space-6);
      font-size: var(--text-sm);
      color: var(--ink-1);

      strong {
        color: var(--ink-0);
        font-weight: var(--weight-medium);
      }
    }

    .anatomy__caption {
      max-width: 22ch;

      strong {
        margin-right: var(--space-1);
      }
    }

    .promise {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-5);
      max-width: var(--container-max);
      margin: 0 auto;
      padding: var(--space-8) var(--space-5);
      border-top: 1px solid var(--line);
    }

    .promise__step {
      display: grid;
      gap: var(--space-3);
      padding: var(--space-5);
      background: var(--bg-1);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);

      p {
        color: var(--ink-1);
        font-size: var(--text-sm);
      }
    }

    .promise__mark {
      width: 48px;
    }

    .promise__num {
      color: var(--accent);
      font-family: var(--font-display);
      font-size: var(--text-lg);
    }

    .builds,
    .brands,
    .service {
      max-width: var(--container-max);
      margin: 0 auto;
      padding: var(--space-8) var(--space-5);
      border-top: 1px solid var(--line);
      display: grid;
      gap: var(--space-5);
    }

    .builds__title,
    .brands__title {
      font-size: clamp(var(--text-xl), 3.5vw, var(--text-3xl));
    }

    .builds__rail {
      display: flex;
      gap: var(--space-4);
      overflow-x: auto;
      scroll-snap-type: x proximity;
      padding-bottom: var(--space-3);
    }

    .builds__card {
      flex: 0 0 min(420px, 84vw);
      scroll-snap-align: start;
      display: grid;
      gap: var(--space-2);
      padding: var(--space-4);
      background: var(--bg-1);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      transition: border-color var(--dur-fast) var(--ease-out);

      &:hover {
        border-color: var(--accent);
      }
    }

    .builds__name {
      font-size: var(--text-sm);
    }

    .builds__finish {
      color: var(--ink-1);
      font-size: var(--text-xs);
      text-transform: capitalize;
    }

    .brands__wall {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: var(--space-4);
    }

    .brands__item {
      display: grid;
      gap: var(--space-1);
      justify-items: center;
      padding: var(--space-5);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      transition: border-color var(--dur-fast) var(--ease-out);

      &:hover {
        border-color: #ffffff33;
      }
    }

    .brands__name {
      font-family: var(--font-display);
      font-weight: var(--weight-display);
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .brands__tier {
      color: var(--ink-1);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .service {
      justify-items: start;

      p {
        color: var(--ink-1);
      }
    }

    .service__cta {
      color: var(--accent);
      min-height: var(--touch-target);
      display: inline-flex;
      align-items: center;
    }

    @media (max-width: 768px) {
      .promise {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class HomePage {
  private readonly data = inject(FitmentDataService);
  private readonly motion = inject(MotionService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly heroWrap = viewChild.required<ElementRef<HTMLDivElement>>('heroWrap');
  private readonly anatomy = viewChild.required<ElementRef<HTMLElement>>('anatomy');
  private readonly layer1 = viewChild.required<ElementRef<HTMLImageElement>>('layer1');
  private readonly layer2 = viewChild.required<ElementRef<HTMLImageElement>>('layer2');
  private readonly layer3 = viewChild.required<ElementRef<HTMLImageElement>>('layer3');
  private readonly layer4 = viewChild.required<ElementRef<HTMLImageElement>>('layer4');
  private readonly cap1 = viewChild.required<ElementRef<HTMLLIElement>>('cap1');
  private readonly cap2 = viewChild.required<ElementRef<HTMLLIElement>>('cap2');
  private readonly cap3 = viewChild.required<ElementRef<HTMLLIElement>>('cap3');
  private readonly cap4 = viewChild.required<ElementRef<HTMLLIElement>>('cap4');

  private parallaxEnabled = false;

  protected readonly brands = toSignal(this.data.getBrands(), { initialValue: [] as Brand[] });

  /** Featured looks joined from fixtures; combos are all verified fits. */
  protected readonly featured = toSignal(
    forkJoin(
      FEATURED_LOOKS.map((f) =>
        forkJoin([this.data.getTrim(f.trimId), this.data.getTire(f.tireId)]).pipe(
          map(([trim, tire]) =>
            trim && tire
              ? ({ trim, tire, look: serializeLook({ trimId: trim.id, tireId: tire.id }) } satisfies FeaturedBuild)
              : null,
          ),
        ),
      ),
    ).pipe(map((builds) => builds.filter((b): b is FeaturedBuild => b !== null))),
    { initialValue: [] as FeaturedBuild[] },
  );

  constructor() {
    afterNextRender(() => {
      this.parallaxEnabled = window.matchMedia('(hover: hover) and (min-width: 1024px)').matches;
      this.setUpAnatomyScene();
    });
  }

  /** A2 parallax — ±6 px on pointer move, desktop only. */
  protected onHeroPointer(event: PointerEvent): void {
    if (!this.parallaxEnabled || this.motion.reduced()) {
      return;
    }
    const hero = event.currentTarget as HTMLElement;
    const rect = hero.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    this.motion.to(this.heroWrap().nativeElement, {
      x: nx * 6,
      y: ny * 6,
      duration: 0.4,
      ease: this.motion.ease.out,
      overwrite: 'auto',
    });
  }

  /** Pinned, scrub-linked showcase drift. Reduced motion → static final layout. */
  private setUpAnatomyScene(): void {
    const captions = [this.cap1(), this.cap2(), this.cap3(), this.cap4()].map((c) => c.nativeElement);
    const layers = {
      a: this.layer1().nativeElement,
      b: this.layer2().nativeElement,
      c: this.layer3().nativeElement,
      d: this.layer4().nativeElement,
    };
    this.motion.scrollScene(
      this.anatomy().nativeElement,
      (tl) => {
        tl.to(layers.a, { xPercent: -30, ease: 'none' }, 0)
          .to(layers.b, { xPercent: -11, ease: 'none' }, 0)
          .to(layers.c, { xPercent: 12, ease: 'none' }, 0)
          .to(layers.d, { xPercent: 36, ease: 'none' }, 0);
        captions.forEach((cap, i) => {
          tl.fromTo(cap, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.12 }, 0.1 + i * 0.22);
        });
      },
      { pin: true, scrub: 1, start: 'top top', end: '+=160%' },
      this.destroyRef,
    );
  }

  protected oemSidewall(trim: VehicleTrim): number {
    return oemReferenceSidewallMm(trim.fitment);
  }
}
