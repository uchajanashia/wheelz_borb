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
  untracked,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, map, of, switchMap } from 'rxjs';

import { Make, TireSize, VehicleModel, VehicleTrim } from '@core/models';
import { ClimateService } from '@core/services/climate.service';
import { FitmentDataService } from '@core/services/fitment-data.service';
import { GarageService, GarageVehicleRef } from '@core/services/garage.service';
import { MotionService } from '@core/services/motion.service';
import { ContactLine } from '@shared/components/contact-line/contact-line';
import { TireSizePipe } from '@shared/pipes/tire-size.pipe';

type GarageStep = 'make' | 'model' | 'trim';

interface SearchHit {
  makeName: string;
  model: VehicleModel;
}

/** Delay before auto-navigating to the configurator after the confirmation moment. */
const CONFIRM_NAVIGATE_MS = 1300;

/**
 * Garage — vehicle selection step flow (spec 06): Make → Model → Trim with the
 * state reflected in query params (`/garage?make=bmw&model=...`) so browser
 * back-navigation walks the steps. Search-as-you-type filters across make+model
 * in one query. Trim select → confirmation moment → auto-navigate /configurator.
 * GSAP step transitions (A5) layer on in Phase 4 — flow works without animation.
 */
@Component({
  selector: 'app-garage-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ContactLine, TireSizePipe],
  template: `
    <section class="garage">
      <h1 i18n>ვისი საბურავები იცვლება დღეს?</h1>

      <input
        class="garage__search"
        type="search"
        [value]="query()"
        (input)="onSearch($event)"
        i18n-placeholder
        placeholder="მოძებნე მარკა ან მოდელი…"
        i18n-aria-label
        aria-label="მარკის ან მოდელის ძებნა"
      />

      @if (query().length > 0) {
        <ul class="garage__results" role="list">
          @for (hit of searchResults(); track hit.model.id) {
            <li>
              <button type="button" class="garage__result" (click)="openModel(hit.model)">
                <span>{{ hit.makeName }} {{ hit.model.name }}</span>
                <span class="garage__result-meta num">
                  {{ hit.model.generation }} · {{ hit.model.yearFrom }}–{{
                    hit.model.yearTo ?? '…'
                  }}
                </span>
              </button>
            </li>
          } @empty {
            <li class="garage__none" i18n>ვერაფერი მოიძებნა</li>
          }
        </ul>
      } @else {
        <nav class="garage__stepper" i18n-aria-label aria-label="არჩევის ნაბიჯები">
          <button
            type="button"
            class="garage__step"
            [class.is-active]="step() === 'make'"
            (click)="goToStep('make')"
          >
            <span class="garage__step-label" i18n>1 · მარკა</span>
            <span class="garage__step-value">{{ selectedMake()?.name ?? '—' }}</span>
          </button>
          <button
            type="button"
            class="garage__step"
            [class.is-active]="step() === 'model'"
            [disabled]="!makeId()"
            (click)="goToStep('model')"
          >
            <span class="garage__step-label" i18n>2 · მოდელი</span>
            <span class="garage__step-value">{{ selectedModel()?.name ?? '—' }}</span>
          </button>
          <button
            type="button"
            class="garage__step"
            [class.is-active]="step() === 'trim'"
            [disabled]="!modelId()"
          >
            <span class="garage__step-label" i18n>3 · კომპლექტაცია</span>
            <span class="garage__step-value">—</span>
          </button>
        </nav>

        <div class="garage__pane-wrap">
          <div class="garage__pane" #stepPane>
            @switch (step()) {
              @case ('make') {
            <div class="garage__grid" role="list">
              @for (make of makes(); track make.id) {
                <button type="button" class="garage__make" role="listitem" (click)="openMake(make)">
                  <span class="garage__make-name">{{ make.name }}</span>
                </button>
              }
            </div>

            @if (garage.recentVehicles().length > 0) {
              <h2 class="garage__subtitle" i18n>ბოლოს არჩეული</h2>
              <div class="garage__recent">
                @for (vehicle of garage.recentVehicles(); track vehicle.trimId) {
                  <button type="button" class="garage__chip" (click)="selectRecent(vehicle)">
                    {{ vehicle.label }}
                  </button>
                }
              </div>
            }
          }
          @case ('model') {
            <div class="garage__grid" role="list">
              @for (model of models(); track model.id) {
                <button
                  type="button"
                  class="garage__model"
                  role="listitem"
                  (click)="openModel(model)"
                >
                  <span class="garage__make-name">{{ model.name }}</span>
                  <span class="garage__meta num">
                    {{ model.generation }} · {{ model.yearFrom }}–{{ model.yearTo ?? '…' }}
                  </span>
                  <span class="garage__meta">{{ model.bodyType }}</span>
                </button>
              }
            </div>
          }
              @case ('trim') {
                <ul class="garage__trims" role="list">
              @for (trim of trims(); track trim.id) {
                <li>
                  <button type="button" class="garage__trim" (click)="selectTrim(trim)">
                    <span class="garage__trim-name">{{ trim.name }}</span>
                    <span class="garage__trim-chips">
                      <span class="garage__chip-spec num"
                        >{{ trim.fitment.rimDiametersInch.join('″/') }}″</span
                      >
                      <span class="garage__chip-spec num">{{ oemSize(trim) | tireSize }}</span>
                      @if (trim.fitment.staggered) {
                        <span class="garage__chip-spec" i18n>staggered</span>
                      }
                      <span class="garage__chip-spec num">{{ trim.fitment.oemSpeedRating }}</span>
                    </span>
                  </button>
                </li>
              }
            </ul>
              }
            }
          </div>
        </div>
      }

      @if (confirming(); as vehicle) {
        <div class="garage__confirm" role="status">
          <app-contact-line class="garage__confirm-loader" [animated]="true" />
          <p class="garage__confirm-label">{{ vehicle.label }}</p>
          <p class="garage__confirm-hint" i18n>თავსებადი საბურავები შეირჩევა…</p>
          <button type="button" class="garage__confirm-skip" (click)="goNow()" i18n>
            კონფიგურატორზე გადასვლა →
          </button>
        </div>
      }
    </section>
  `,
  styles: `
    .garage {
      max-width: var(--container-max);
      margin: 0 auto;
      padding: var(--space-8) var(--space-5);
      display: grid;
      gap: var(--space-5);
    }

    .garage__search {
      width: min(480px, 100%);
      min-height: var(--touch-target);
      padding: 0 var(--space-4);
      background: var(--bg-1);
      border: 1px solid var(--line);
      border-radius: var(--radius-full);
      color: var(--ink-0);
      font: inherit;

      &::placeholder {
        color: var(--ink-1);
      }
    }

    .garage__results {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: var(--space-2);
      max-width: 480px;
    }

    .garage__result {
      width: 100%;
      display: flex;
      justify-content: space-between;
      gap: var(--space-4);
      align-items: baseline;
      min-height: var(--touch-target);
      padding: var(--space-2) var(--space-4);
      background: var(--bg-1);
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      text-align: left;
      transition: border-color var(--dur-fast) var(--ease-out);

      &:hover {
        border-color: var(--accent);
      }
    }

    .garage__result-meta,
    .garage__meta {
      color: var(--ink-1);
      font-size: var(--text-sm);
    }

    .garage__none {
      color: var(--ink-1);
    }

    .garage__stepper {
      display: flex;
      gap: var(--space-3);
      flex-wrap: wrap;
    }

    .garage__step {
      display: grid;
      gap: 2px;
      padding: var(--space-2) var(--space-4);
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      text-align: left;
      color: var(--ink-1);

      &.is-active {
        border-color: var(--accent);
        color: var(--ink-0);
      }

      &:disabled {
        opacity: 0.45;
        cursor: default;
      }
    }

    .garage__step-label {
      font-size: var(--text-xs);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .garage__step-value {
      font-weight: var(--weight-medium);
    }

    .garage__pane-wrap {
      position: relative;
    }

    .garage__pane {
      display: grid;
      gap: var(--space-5);
    }

    .garage__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
      gap: var(--space-4);
    }

    .garage__make,
    .garage__model {
      display: grid;
      gap: var(--space-1);
      align-content: center;
      justify-items: center;
      min-height: 96px;
      background: var(--bg-1);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      padding: var(--space-4);
      transition: border-color var(--dur-fast) var(--ease-out);

      &:hover {
        border-color: var(--accent);
      }
    }

    .garage__make-name {
      font-family: var(--font-display);
      font-weight: var(--weight-medium);
      font-size: var(--text-lg);
    }

    .garage__subtitle {
      font-size: var(--text-lg);
      margin-top: var(--space-4);
    }

    .garage__recent {
      display: flex;
      gap: var(--space-3);
      flex-wrap: wrap;
    }

    .garage__chip {
      min-height: 36px;
      padding: 0 var(--space-4);
      border: 1px solid var(--line);
      border-radius: var(--radius-full);
      color: var(--ink-1);
      font-size: var(--text-sm);
      transition:
        color var(--dur-fast) var(--ease-out),
        border-color var(--dur-fast) var(--ease-out);

      &:hover {
        color: var(--ink-0);
        border-color: var(--accent);
      }
    }

    .garage__trims {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: var(--space-3);
      max-width: 640px;
    }

    .garage__trim {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-4);
      flex-wrap: wrap;
      min-height: var(--touch-target);
      padding: var(--space-3) var(--space-4);
      background: var(--bg-1);
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      text-align: left;
      transition: border-color var(--dur-fast) var(--ease-out);

      &:hover {
        border-color: var(--accent);
      }
    }

    .garage__trim-name {
      font-weight: var(--weight-medium);
    }

    .garage__trim-chips {
      display: flex;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .garage__chip-spec {
      padding: 2px var(--space-2);
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      font-size: var(--text-xs);
      color: var(--ink-1);
    }

    .garage__confirm {
      position: fixed;
      inset: 0;
      z-index: var(--z-overlay);
      display: grid;
      place-content: center;
      justify-items: center;
      gap: var(--space-4);
      text-align: center;
      padding: var(--space-5);
      background: color-mix(in srgb, var(--bg-0) 94%, transparent);
      backdrop-filter: blur(6px);
      animation: confirm-in var(--dur-base) var(--ease-out);
    }

    .garage__confirm-loader {
      width: min(280px, 70vw);
    }

    .garage__confirm-label {
      font-family: var(--font-display);
      font-size: var(--text-xl);
    }

    .garage__confirm-hint {
      color: var(--ink-1);
    }

    .garage__confirm-skip {
      margin-top: var(--space-2);
      color: var(--accent);
      min-height: var(--touch-target);
    }

    @keyframes confirm-in {
      from {
        opacity: 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .garage__confirm {
        animation: none;
      }
    }
  `,
})
export class GaragePage {
  private readonly data = inject(FitmentDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly climate = inject(ClimateService);
  protected readonly garage = inject(GarageService);

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly makeId = computed(() => this.params().get('make'));
  protected readonly modelId = computed(() => this.params().get('model'));
  protected readonly step = computed<GarageStep>(() =>
    this.modelId() ? 'trim' : this.makeId() ? 'model' : 'make',
  );

  protected readonly makes = toSignal(this.data.getMakes(), { initialValue: [] as Make[] });

  protected readonly models = toSignal(
    toObservable(this.makeId).pipe(
      switchMap((id) => (id ? this.data.getModels(id) : of([] as VehicleModel[]))),
    ),
    { initialValue: [] as VehicleModel[] },
  );

  protected readonly trims = toSignal(
    toObservable(this.modelId).pipe(
      switchMap((id) => (id ? this.data.getTrims(id) : of([] as VehicleTrim[]))),
    ),
    { initialValue: [] as VehicleTrim[] },
  );

  /** All models across makes — feeds the one-query make+model search (spec 06). */
  private readonly allModels = toSignal(
    this.data
      .getMakes()
      .pipe(
        switchMap((makes) =>
          makes.length
            ? forkJoin(makes.map((m) => this.data.getModels(m.id))).pipe(map((r) => r.flat()))
            : of([] as VehicleModel[]),
        ),
      ),
    { initialValue: [] as VehicleModel[] },
  );

  protected readonly query = signal('');

  protected readonly searchResults = computed<SearchHit[]>(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) {
      return [];
    }
    const makeName = new Map(this.makes().map((m) => [m.id, m.name]));
    return this.allModels()
      .map((model) => ({ makeName: makeName.get(model.makeId) ?? model.makeId, model }))
      .filter((hit) =>
        `${hit.makeName} ${hit.model.name} ${hit.model.generation}`.toLowerCase().includes(q),
      )
      .slice(0, 8);
  });

  protected readonly selectedMake = computed(
    () => this.makes().find((m) => m.id === this.makeId()) ?? null,
  );
  protected readonly selectedModel = computed(
    () => this.models().find((m) => m.id === this.modelId()) ?? null,
  );

  protected readonly confirming = signal<GarageVehicleRef | null>(null);
  private confirmTimer: ReturnType<typeof setTimeout> | null = null;

  // --- A5 step transitions (spec 07): outgoing snapshot slides/fades out,
  // --- incoming pane slides in from the opposite side; mirrors on back-nav.
  private readonly motion = inject(MotionService);
  private readonly injector = inject(Injector);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly stepPane = viewChild<ElementRef<HTMLDivElement>>('stepPane');
  private static readonly STEP_ORDER: Record<GarageStep, number> = { make: 0, model: 1, trim: 2 };
  private lastStepIdx = -1;
  private paneSnapshot: HTMLElement | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.confirmTimer !== null) {
        clearTimeout(this.confirmTimer);
      }
    });

    effect(() => {
      const step = this.step();
      untracked(() => this.animateStep(step));
    });
  }

  private animateStep(step: GarageStep): void {
    if (!this.isBrowser) {
      return;
    }
    afterNextRender(
      () => {
        const pane = this.stepPane()?.nativeElement;
        if (!pane) {
          return;
        }
        const idx = GaragePage.STEP_ORDER[step];
        const direction = idx >= this.lastStepIdx ? 1 : -1;
        const isFirst = this.lastStepIdx === -1;
        this.lastStepIdx = idx;
        if (isFirst || this.motion.reduced()) {
          this.snapshotPane(pane);
          return;
        }
        if (this.paneSnapshot) {
          const ghost = this.paneSnapshot;
          Object.assign(ghost.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
          pane.parentElement?.appendChild(ghost);
          this.motion.to(ghost, {
            x: -32 * direction,
            opacity: 0,
            duration: 0.2,
            ease: this.motion.ease.out,
            onComplete: () => ghost.remove(),
          });
        }
        this.motion.set(pane, { x: 32 * direction, opacity: 0 });
        this.motion.to(pane, {
          x: 0,
          opacity: 1,
          duration: this.motion.dur.base,
          ease: this.motion.ease.out,
          clearProps: 'transform,opacity',
          onComplete: () => this.snapshotPane(pane),
        });
      },
      { injector: this.injector },
    );
  }

  private snapshotPane(pane: HTMLElement): void {
    this.paneSnapshot = pane.cloneNode(true) as HTMLElement;
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected openMake(make: Make): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { make: make.id } });
  }

  protected openModel(model: VehicleModel): void {
    this.query.set('');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { make: model.makeId, model: model.id },
    });
  }

  protected goToStep(step: GarageStep): void {
    const queryParams =
      step === 'make'
        ? {}
        : step === 'model'
          ? { make: this.makeId() }
          : { make: this.makeId(), model: this.modelId() };
    void this.router.navigate([], { relativeTo: this.route, queryParams });
  }

  protected selectTrim(trim: VehicleTrim): void {
    const make = this.selectedMake();
    const model = this.selectedModel();
    if (!make || !model) {
      return;
    }
    this.confirmSelection({
      makeId: make.id,
      modelId: model.id,
      trimId: trim.id,
      label: `${make.name} ${model.name} ${model.generation} ${trim.name}`,
    });
  }

  protected selectRecent(vehicle: GarageVehicleRef): void {
    this.confirmSelection(vehicle);
  }

  /** OEM front tire at the trim's largest rim — for the trim spec chip. */
  protected oemSize(trim: VehicleTrim): TireSize {
    const maxRim = Math.max(...trim.fitment.rimDiametersInch);
    const entry =
      trim.fitment.oemBySize.find((o) => o.rimDiameterInch === maxRim) ?? trim.fitment.oemBySize[0]!;
    return entry.front;
  }

  protected goNow(): void {
    if (this.confirmTimer !== null) {
      clearTimeout(this.confirmTimer);
      this.confirmTimer = null;
    }
    void this.router.navigateByUrl(this.nextDestination());
  }

  /** Season first if not yet chosen (spec 06), then the configurator. */
  private nextDestination(): string {
    return this.climate.hasSeason() ? '/configurator' : '/season?next=/configurator';
  }

  /** The confirmation moment (spec 06) — brief pause, then continue the flow. */
  private confirmSelection(vehicle: GarageVehicleRef): void {
    this.garage.selectVehicle(vehicle);
    this.confirming.set(vehicle);
    this.confirmTimer = setTimeout(
      () => void this.router.navigateByUrl(this.nextDestination()),
      CONFIRM_NAVIGATE_MS,
    );
  }
}
