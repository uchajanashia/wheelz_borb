import { ChangeDetectionStrategy, Component, Signal, computed, input, signal } from '@angular/core';

import { Tire, VehicleVisual } from '@core/models';
import { sidewallMm } from '@core/services/fitment-engine.service';
import {
  STAGE_HEIGHT_PX,
  STAGE_WIDTH_PX,
  anchorRectPct,
  tireRingScale,
} from '@core/services/tire-ring-scale';

/**
 * MiniStageComponent (spec 06): the configurator's compositing math at card
 * scale — car side profile + the tire ring mounted on both anchors. Pure ratio
 * positioning, zero animation, lazy images. Used for catalog hover crossfades
 * (A6) and featured-look thumbnails on the home page.
 */
@Component({
  selector: 'app-mini-stage',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mini" [style.aspect-ratio]="aspect">
      @if (!carFailed()) {
        <img
          class="mini__car"
          [src]="visual().sideProfileUrl"
          alt=""
          loading="lazy"
          draggable="false"
          (error)="carFailed.set(true)"
        />
      }
      @if (rearRect(); as r) {
        <img class="mini__tire" [src]="tire().media.sidewallUrl" alt="" loading="lazy" draggable="false"
          [style.left.%]="r.leftPct" [style.top.%]="r.topPct" [style.width.%]="r.widthPct" [style.height.%]="r.heightPct" />
      }
      @if (frontRect(); as r) {
        <img class="mini__tire" [src]="tire().media.sidewallUrl" alt="" loading="lazy" draggable="false"
          [style.left.%]="r.leftPct" [style.top.%]="r.topPct" [style.width.%]="r.widthPct" [style.height.%]="r.heightPct" />
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .mini {
      position: relative;
      width: 100%;
    }

    .mini__car {
      display: block;
      width: 100%;
      height: 100%;
    }

    .mini__tire {
      position: absolute;
    }
  `,
})
export class MiniStage {
  readonly visual = input.required<VehicleVisual>();
  readonly tire = input.required<Tire>();
  /** OEM tire sidewall (mm) the anchors were calibrated with (oemReferenceSidewallMm). */
  readonly oemSidewallMm = input.required<number>();

  protected readonly aspect = `${STAGE_WIDTH_PX} / ${STAGE_HEIGHT_PX}`;
  protected readonly carFailed = signal(false);

  protected readonly frontRect = this.rect('frontWheel');
  protected readonly rearRect = this.rect('rearWheel');

  private rect(axle: 'frontWheel' | 'rearWheel'): Signal<ReturnType<typeof anchorRectPct>> {
    return computed(() => {
      const anchor = this.visual()[axle];
      const ring = tireRingScale(anchor, sidewallMm(this.tire().size), this.oemSidewallMm());
      return anchorRectPct(anchor, ring.outerDiameterPx);
    });
  }
}
