import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { Season } from '@core/models';
import { ClimateService } from '@core/services/climate.service';
import { SeasonFrame } from '@shared/components/season-frame/season-frame';

interface SeasonChoice {
  id: Season;
  label: string;
  caption: string;
}

/**
 * Season chooser (spec 06) — three cinematic climate "frames". Selecting one
 * sets the global climate (ClimateService) and continues the flow to `?next=`
 * (the garage routes here mid-flow). Reachable standalone and inline. R2: a calm
 * preview via the frame's own palette; the cinematic transition is R3.
 */
@Component({
  selector: 'app-season-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SeasonFrame],
  template: `
    <section class="season">
      <header class="season__head">
        <p class="eyebrow" i18n>ტემპერატურა, როგორც ინტერფეისი</p>
        <h1 class="display" i18n>აირჩიე სეზონი</h1>
        <p class="season__sub" i18n>
          სეზონი მართავს მთელ გამოცდილებას — განათებას, გზას და იმ საბურავებს, რომლებსაც
          ნახავ.
        </p>
      </header>

      <div class="season__frames">
        @for (choice of choices; track choice.id) {
          <button
            type="button"
            class="season__choice"
            [attr.aria-pressed]="climate.season() === choice.id"
            (click)="choose(choice.id)"
          >
            <app-season-frame
              [season]="choice.id"
              [label]="choice.label"
              [caption]="choice.caption"
              [active]="climate.season() === choice.id"
            />
          </button>
        }
      </div>

      <button type="button" class="season__skip" (click)="skip()" i18n>
        გამოტოვება — ნახე ყველა სეზონი →
      </button>
    </section>
  `,
  styles: `
    .season {
      max-width: var(--container-max);
      margin: 0 auto;
      padding: var(--space-8) var(--space-5);
      display: grid;
      gap: var(--space-6);
    }

    .season__head {
      display: grid;
      gap: var(--space-3);
      max-width: 60ch;
    }

    .season__head h1 {
      font-size: clamp(var(--text-2xl), 6vw, var(--text-4xl));
    }

    .season__sub {
      color: var(--ink-1);
    }

    .season__frames {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-4);
    }

    .season__choice {
      display: block;
      text-align: left;
      border-radius: var(--radius-lg);

      app-season-frame {
        display: block;
        transition: transform var(--dur-base) var(--ease-out);
      }

      &:hover app-season-frame {
        transform: translateY(-4px);
      }
    }

    .season__skip {
      justify-self: start;
      color: var(--ink-1);
      min-height: var(--touch-target);
      font-size: var(--text-sm);

      &:hover {
        color: var(--ink-0);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .season__choice:hover app-season-frame {
        transform: none;
      }
    }

    @media (max-width: 860px) {
      .season__frames {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class SeasonPage {
  protected readonly climate = inject(ClimateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly choices: SeasonChoice[] = [
    { id: 'summer', label: $localize`ზაფხული`, caption: $localize`ცხელი ასფალტი · მაქსიმალური გრიპი` },
    { id: 'all-season', label: $localize`ყველა სეზონი`, caption: $localize`სველი გზა · ბალანსი` },
    { id: 'winter', label: $localize`ზამთარი`, caption: $localize`თოვლი და ყინვა · უსაფრთხოება` },
  ];

  private next(): string {
    return this.params().get('next') || '/catalog';
  }

  protected choose(season: Season): void {
    this.climate.setSeason(season);
    void this.router.navigateByUrl(this.next());
  }

  protected skip(): void {
    void this.router.navigateByUrl(this.next());
  }
}
