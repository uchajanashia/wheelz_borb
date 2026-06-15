import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  PLATFORM_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Brand } from '@core/models';
import { CartService } from '@core/services/cart.service';
import { ClimateService } from '@core/services/climate.service';
import { FitmentDataService } from '@core/services/fitment-data.service';
import {
  FitmentEngineService,
  FittedTire,
  oemReferenceSidewallMm,
} from '@core/services/fitment-engine.service';
import { GarageService } from '@core/services/garage.service';
import { Look, parseLook, serializeLook } from '@core/services/look-url';
import { MotionService } from '@core/services/motion.service';
import { ContactLine } from '@shared/components/contact-line/contact-line';
import { TireViewer } from '@shared/components/tire-viewer/tire-viewer';
import { CarStage } from './components/car-stage/car-stage';
import { SpecHud } from './components/spec-hud/spec-hud';
import { TireRail } from './components/tire-rail/tire-rail';

/**
 * Tire configurator — THE core feature (spec 05). Composition: CarStage (2D
 * compositing + A1 sidewall-height swap) · TireRail (scroll-snap picker) ·
 * SpecHud (desktop right column / mobile bottom sheet). Selection state lives
 * here; compatibility comes exclusively from FitmentEngineService signals.
 *
 * Deep links: `?look=` restores an exact {trim, tire} configuration (spec 05
 * §7, works with an empty garage), `?tire=` preselects a tire ("see on my car"
 * from the catalog).
 *
 * NOTE (R1): the season selector + climate transformation (the cinematic
 * signature) and the tread/sidewall detail inset are R2/R3; this is the
 * functional configurator on the surviving stage skeleton.
 */
@Component({
  selector: 'app-configurator-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ContactLine, CarStage, SpecHud, TireRail, TireViewer],
  template: `
    <section class="cfg">
      <header class="cfg__bar">
        <div class="cfg__title">
          <h1 i18n>კონფიგურატორი</h1>
          @if (vehicleLabel(); as label) {
            <p class="cfg__vehicle">
              {{ label }}
              @if (fitted(); as list) {
                · <span class="num">{{ list.length }}</span>
                <ng-container i18n>თავსებადი საბურავი</ng-container>
              }
            </p>
          }
        </div>
        <div class="cfg__actions">
          <a routerLink="/garage" class="cfg__change" i18n>მანქანის შეცვლა</a>
          <button
            type="button"
            class="cfg__save"
            [disabled]="!selectedFitted()"
            (click)="saveLook()"
          >
            @if (lookSaved()) {
              <ng-container i18n>ბმული დაკოპირდა ✓</ng-container>
            } @else {
              <ng-container i18n>შეინახე ლუკი</ng-container>
            }
          </button>
        </div>
      </header>

      @if (trim(); as t) {
        <div class="cfg__layout">
          <div class="cfg__stage-col">
            <app-car-stage
              class="cfg__stage"
              [visual]="t.visual"
              [tire]="selectedFitted()?.tire ?? null"
              [oemSidewallMm]="oemSidewallMm()"
              [vehicleLabel]="vehicleLabel()"
            />
          </div>

          <aside class="cfg__hud" [class.is-open]="sheetOpen()">
            <button
              type="button"
              class="cfg__sheet-handle"
              (click)="sheetOpen.set(!sheetOpen())"
              [attr.aria-expanded]="sheetOpen()"
              i18n-aria-label
              aria-label="სპეციფიკაციის პანელი"
            >
              <span class="cfg__sheet-grip" aria-hidden="true"></span>
              <span class="cfg__sheet-summary">
                @if (selectedFitted(); as f) {
                  {{ selectedBrandName() }} {{ f.tire.model }} ·
                  <span class="num">₾{{ f.tire.priceGel * 4 }}</span>
                } @else {
                  <ng-container i18n>დეტალები</ng-container>
                }
              </span>
            </button>
            <div class="cfg__hud-body">
              <app-spec-hud
                [fitted]="selectedFitted()"
                [brandName]="selectedBrandName()"
                (addToCart)="onAddToCart($event)"
                (inspect)="openViewer()"
              />
            </div>
          </aside>

          <app-tire-rail
            class="cfg__rail"
            [items]="fitted() ?? []"
            [selectedId]="selectedTireId()"
            [brands]="brands()"
            (pick)="onPick($event)"
          />
        </div>
      } @else {
        <div class="cfg__loading">
          <app-contact-line class="cfg__loader" [animated]="true" />
          <p i18n>კონფიგურაცია იტვირთება…</p>
        </div>
      }

      <!-- A8: @defer-loaded 3D viewer, Flip open/close from the mounted tire -->
      @if (viewerGlbUrl(); as glbUrl) {
        <div
          class="cfg__inspect-backdrop"
          role="presentation"
          tabindex="-1"
          (click)="closeViewer()"
          (keydown.escape)="closeViewer()"
        >
          <div
            class="cfg__inspect"
            #viewerBox
            role="dialog"
            aria-modal="true"
            i18n-aria-label
            aria-label="საბურავის 3D დათვალიერება"
            (click)="$event.stopPropagation()"
            (keydown.escape)="closeViewer()"
          >
            @defer (when viewerOpen()) {
              <app-tire-viewer [glbUrl]="glbUrl" />
            } @placeholder {
              <div class="cfg__inspect-loading">
                <app-contact-line class="cfg__loader" [animated]="true" />
              </div>
            }
            <button
              type="button"
              class="cfg__inspect-close"
              (click)="closeViewer()"
              i18n-aria-label
              aria-label="დახურვა"
            >
              ✕
            </button>
          </div>
        </div>
      }

      <p class="visually-hidden" role="status" aria-live="polite">
        @if (selectedFitted(); as f) {
          <ng-container i18n>დამონტაჟებულია:</ng-container>
          {{ selectedBrandName() }} {{ f.tire.model }} {{ f.tire.season }} —
          <ng-container i18n>ერგება შენს მანქანას:</ng-container>
          {{ vehicleLabel() }}
        }
      </p>
    </section>
  `,
  styles: `
    .cfg {
      max-width: var(--container-max);
      margin: 0 auto;
      padding: var(--space-6) var(--space-5);
      display: grid;
      gap: var(--space-5);
    }

    .cfg__bar {
      display: flex;
      align-items: baseline;
      gap: var(--space-4);
      flex-wrap: wrap;
    }

    .cfg__title h1 {
      font-size: clamp(var(--text-xl), 7vw, var(--text-3xl));
    }

    .cfg__vehicle {
      color: var(--accent);
      font-size: var(--text-sm);
    }

    .cfg__actions {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }

    .cfg__change {
      color: var(--ink-1);
      font-size: var(--text-sm);

      &:hover {
        color: var(--ink-0);
      }
    }

    .cfg__save {
      min-height: 36px;
      padding: 0 var(--space-4);
      border: 1px solid var(--accent);
      border-radius: var(--radius-full);
      color: var(--accent);
      font-size: var(--text-sm);

      &:disabled {
        border-color: var(--line);
        color: var(--ink-1);
      }
    }

    .cfg__layout {
      display: grid;
      gap: var(--space-5);
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas: 'stage' 'rail' 'hud';
    }

    .cfg__stage-col {
      grid-area: stage;
      display: grid;
      gap: var(--space-3);
      min-width: 0;
      align-content: start;
    }

    .cfg__stage {
      background: var(--bg-1);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }

    .cfg__hud {
      grid-area: hud;
      min-width: 0;
    }

    .cfg__rail {
      grid-area: rail;
      min-width: 0;
    }

    .cfg__sheet-handle {
      display: none;
    }

    /* Desktop: stage ~70% + HUD right column, rail along the bottom (spec 05) */
    @media (min-width: 1024px) {
      .cfg__layout {
        grid-template-columns: minmax(0, 7fr) minmax(300px, 3fr);
        grid-template-areas:
          'stage hud'
          'rail rail';
        align-items: start;
      }
    }

    /* Mobile: HUD collapses into a bottom sheet with a drag handle (spec 05) */
    @media (max-width: 767px) {
      .cfg {
        padding-bottom: calc(var(--space-9) + var(--space-6));
      }

      .cfg__hud {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: var(--z-sheet);
        display: flex;
        flex-direction: column;
        max-height: 72dvh;
        background: var(--glass-bg);
        backdrop-filter: blur(var(--glass-blur));
        -webkit-backdrop-filter: blur(var(--glass-blur));
        border-top: 1px solid var(--line);
        border-radius: var(--radius-lg) var(--radius-lg) 0 0;
        transform: translateY(calc(100% - 56px));
        transition: transform var(--dur-base) var(--ease-out);
      }

      .cfg__hud.is-open {
        transform: translateY(0);
      }

      .cfg__sheet-handle {
        display: grid;
        justify-items: center;
        gap: var(--space-1);
        min-height: 56px;
        padding: var(--space-2) var(--space-4);
        color: var(--ink-0);
        font-size: var(--text-sm);
      }

      .cfg__sheet-grip {
        width: 40px;
        height: 4px;
        border-radius: var(--radius-full);
        background: var(--ink-1);
        opacity: 0.5;
      }

      .cfg__hud-body {
        overflow-y: auto;
        padding: 0 var(--space-3) var(--space-3);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .cfg__hud {
        transition: none;
      }
    }

    .cfg__loading {
      display: grid;
      justify-items: center;
      gap: var(--space-4);
      padding: var(--space-9) var(--space-5);
      color: var(--ink-1);
    }

    .cfg__loader {
      width: min(220px, 60%);
    }

    .cfg__inspect-backdrop {
      position: fixed;
      inset: 0;
      z-index: var(--z-overlay);
      display: grid;
      place-items: center;
      background: #0e0e10cc;
      backdrop-filter: blur(5px);
    }

    .cfg__inspect {
      position: relative;
      width: min(720px, 92vw);
      height: min(540px, 72vh);
      background: var(--bg-1);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      overflow: hidden;
      will-change: transform;
    }

    .cfg__inspect-loading {
      display: grid;
      place-items: center;
      height: 100%;
    }

    .cfg__inspect-close {
      position: absolute;
      top: var(--space-2);
      right: var(--space-2);
      width: 36px;
      height: 36px;
      display: grid;
      place-items: center;
      border: 1px solid var(--line);
      border-radius: var(--radius-full);
      background: var(--bg-2);
      color: var(--ink-0);
    }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }
  `,
})
export class ConfiguratorPage {
  private readonly data = inject(FitmentDataService);
  private readonly engine = inject(FitmentEngineService);
  private readonly garage = inject(GarageService);
  private readonly cart = inject(CartService);
  private readonly climate = inject(ClimateService);
  private readonly motion = inject(MotionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly trim = this.engine.selectedTrim;
  /** All fitting tires for the car (season-blind, from the engine spine). */
  private readonly allFitted = this.engine.compatibleTires;
  /** The rail = fitting tires for {car × season} (spec 05); calm filter in R2. */
  protected readonly fitted = computed<FittedTire[] | null>(() => {
    const list = this.allFitted();
    if (!list) {
      return null;
    }
    const season = this.climate.season();
    return season ? list.filter((f) => f.tire.season === season) : list;
  });
  protected readonly brands = toSignal(this.data.getBrands(), { initialValue: [] as Brand[] });

  protected readonly selectedTireId = signal<string | null>(null);
  protected readonly sheetOpen = signal(false);
  protected readonly lookSaved = signal(false);

  /** A8 3D viewer overlay state. */
  protected readonly viewerOpen = signal(false);
  protected readonly viewerGlbUrl = computed(() =>
    this.viewerOpen() ? (this.selectedFitted()?.tire.media.glbUrl ?? null) : null,
  );
  private readonly viewerBox = viewChild<ElementRef<HTMLDivElement>>('viewerBox');

  /** A `?look=` restore in flight — the default-selection effect must wait for it. */
  private pendingLook: Look | null = null;
  private lookSavedTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly selectedFitted = computed<FittedTire | null>(
    () => this.fitted()?.find((f) => f.tire.id === this.selectedTireId()) ?? null,
  );

  /** The OEM tire sidewall (mm) the visual anchors were calibrated with. */
  protected readonly oemSidewallMm = computed(() => {
    const t = this.trim();
    return t ? oemReferenceSidewallMm(t.fitment) : 0;
  });

  protected readonly vehicleLabel = computed(() => this.garage.selectedVehicle()?.label ?? '');

  protected readonly selectedBrandName = computed(() => {
    const f = this.selectedFitted();
    if (!f) {
      return '';
    }
    return this.brands().find((b) => b.id === f.tire.brandId)?.name ?? f.tire.brandId;
  });

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    const look = parseLook(params.get('look'));
    if (look) {
      this.pendingLook = look;
      this.selectedTireId.set(look.tireId);
      void this.restoreLookVehicle(look.trimId);
    } else if (params.get('tire')) {
      this.selectedTireId.set(params.get('tire'));
    }

    // Default selection: first compatible tire when nothing valid is selected.
    effect(() => {
      const list = this.fitted();
      const t = this.trim();
      if (this.pendingLook) {
        if (t?.id !== this.pendingLook.trimId) {
          return; // restore still in flight — don't clobber the look's tire
        }
        this.pendingLook = null;
      }
      if (!list?.length) {
        return;
      }
      const id = this.selectedTireId();
      if (!id || !list.some((f) => f.tire.id === id)) {
        this.selectedTireId.set(list[0]!.tire.id);
      }
    });
  }

  protected onPick(item: FittedTire): void {
    this.selectedTireId.set(item.tire.id);
  }

  /** Spec 05: add the selected tire as a set, then the fly-to-cart micro-interaction. */
  protected onAddToCart(origin: { x: number; y: number }): void {
    const t = this.trim();
    const f = this.selectedFitted();
    if (!t || !f) {
      return;
    }
    this.cart.add({
      tireId: f.tire.id,
      unitPriceGel: f.tire.priceGel,
      vehicleTrimId: t.id,
    });
    this.flyToCart(origin, f.tire.media.sidewallUrl);
  }

  /** Spec 05 §7: serialize {trim, tire} into ?look= and copy the share URL. */
  protected saveLook(): void {
    const t = this.trim();
    const f = this.selectedFitted();
    if (!t || !f) {
      return;
    }
    const look = serializeLook({ trimId: t.id, tireId: f.tire.id });
    const tree = this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams: { look },
      queryParamsHandling: 'merge',
    });
    void this.router.navigateByUrl(tree, { replaceUrl: true });
    if (this.isBrowser && navigator.clipboard) {
      void navigator.clipboard
        .writeText(location.origin + this.router.serializeUrl(tree))
        .catch(() => undefined);
    }
    this.lookSaved.set(true);
    if (this.lookSavedTimer) {
      clearTimeout(this.lookSavedTimer);
    }
    this.lookSavedTimer = setTimeout(() => this.lookSaved.set(false), 2500);
  }

  /** Hydrate the garage from a shared look link (pre-auth restore, spec 05 §7). */
  private async restoreLookVehicle(trimId: string): Promise<void> {
    if (this.garage.selectedVehicle()?.trimId === trimId) {
      return;
    }
    const trim = await firstValueFrom(this.data.getTrim(trimId));
    const model = trim ? await firstValueFrom(this.data.getModel(trim.modelId)) : undefined;
    if (!trim || !model) {
      this.pendingLook = null; // unknown look — fall back to default selection
      return;
    }
    const makes = await firstValueFrom(this.data.getMakes());
    const make = makes.find((m) => m.id === model.makeId);
    this.garage.selectVehicle({
      makeId: model.makeId,
      modelId: model.id,
      trimId: trim.id,
      label: `${make?.name ?? model.makeId} ${model.name} ${model.generation} ${trim.name}`,
    });
  }

  /** A8: viewer opens with a Flip shared-element feel from the mounted tire. */
  protected async openViewer(): Promise<void> {
    this.viewerOpen.set(true);
    await this.nextRender();
    const box = this.viewerBox()?.nativeElement;
    if (!box) {
      return;
    }
    box.querySelector<HTMLElement>('.cfg__inspect-close')?.focus();
    const source = this.stageTireEl();
    if (source && !this.motion.reduced()) {
      await this.motion.flipSnapTo(box, source);
      this.motion.to(box, {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        duration: 0.45,
        ease: this.motion.ease.out,
      });
    }
  }

  protected async closeViewer(): Promise<void> {
    const box = this.viewerBox()?.nativeElement;
    const source = this.stageTireEl();
    if (box && source && !this.motion.reduced()) {
      await this.motion.flipTo(box, source, { duration: 0.3 });
    }
    this.viewerOpen.set(false);
  }

  private stageTireEl(): Element | null {
    return this.host.nativeElement.querySelector('app-car-stage img.stage__tire.is-active');
  }

  private nextRender(): Promise<void> {
    return new Promise((resolve) => afterNextRender(() => resolve(), { injector: this.injector }));
  }

  /** A7-style micro-interaction: ghost thumbnail arcs from the CTA to the header cart. */
  private flyToCart(origin: { x: number; y: number }, imageUrl: string): void {
    if (!this.isBrowser || this.motion.reduced()) {
      return;
    }
    const target = document.querySelector('.header__cart');
    if (!target) {
      return;
    }
    const t = target.getBoundingClientRect();
    const ghost = document.createElement('img');
    ghost.src = imageUrl;
    ghost.alt = '';
    Object.assign(ghost.style, {
      position: 'fixed',
      left: `${origin.x - 28}px`,
      top: `${origin.y - 28}px`,
      width: '56px',
      height: '56px',
      zIndex: 'var(--z-toast)',
      pointerEvents: 'none',
    });
    document.body.appendChild(ghost);
    const tl = this.motion.timeline({ onComplete: () => ghost.remove() }, this.destroyRef);
    tl.to(ghost, { x: t.left + t.width / 2 - origin.x, duration: 0.55, ease: 'power1.inOut' }, 0)
      .to(ghost, { y: t.top + t.height / 2 - origin.y, duration: 0.55, ease: 'power3.in' }, 0)
      .to(ghost, { scale: 0.2, opacity: 0.3, duration: 0.55, ease: 'power2.in' }, 0);
  }
}
