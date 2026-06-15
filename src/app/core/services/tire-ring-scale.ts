import { WheelAnchor } from '../models';

/**
 * Visual constants + pure math for the configurator tire stage (spec 05). ALL
 * tunable rendering numbers live here — the components, the placeholder-asset
 * generator (scripts/generate-placeholder-assets.mjs), and the unit tests share
 * them. Replaces the rim-era wheel-render-scale.ts.
 */

/** Normative stage coordinate space (spec 05 fixes width at 2400). */
export const STAGE_WIDTH_PX = 2400;
/**
 * Stage height is not in the spec's VehicleVisual contract; we normalize it as
 * part of OUR asset contract: every side-profile render is 2400×1260. Real
 * renders must ship in the same canvas to be drop-in replacements.
 */
export const STAGE_HEIGHT_PX = 1260;

export interface TireRing {
  /** inner edge of the tire ring (the rendered rim bead seat) */
  innerRadiusPx: number;
  /** scaled sidewall thickness in stage px */
  sidewallPx: number;
  /** outer edge of the tire (the visual OD radius) */
  outerRadiusPx: number;
  /** outer diameter — the size of the square composite box for the sidewall image */
  outerDiameterPx: number;
}

/**
 * Spec 05: the on-car tire is a ring of inner radius `rimRadiusPx` and outer
 * radius `rimRadiusPx + sidewallPx`, where
 * `sidewallPx = oemSidewallPx × (tireSidewallMm / oemSidewallMm)`. So mounting
 * the OEM tire reproduces `oemSidewallPx` exactly. A 35-profile and a 55-profile
 * are visibly different on the car because only the sidewall (ring thickness)
 * scales — the rim radius is fixed by the car. (Replaces `wheelRenderScale()`.)
 *
 * Pure function: stage-space ring geometry for a tire mounted at an anchor.
 */
export function tireRingScale(
  anchor: Pick<WheelAnchor, 'rimRadiusPx' | 'oemSidewallPx'>,
  tireSidewallMm: number,
  oemSidewallMm: number,
): TireRing {
  if (
    anchor.rimRadiusPx <= 0 ||
    anchor.oemSidewallPx <= 0 ||
    tireSidewallMm <= 0 ||
    oemSidewallMm <= 0
  ) {
    throw new RangeError('tireRingScale: all inputs must be positive');
  }
  const sidewallPx = anchor.oemSidewallPx * (tireSidewallMm / oemSidewallMm);
  const outerRadiusPx = anchor.rimRadiusPx + sidewallPx;
  return {
    innerRadiusPx: anchor.rimRadiusPx,
    sidewallPx,
    outerRadiusPx,
    outerDiameterPx: outerRadiusPx * 2,
  };
}

/** A layer box in percentages of the stage container — resize-safe (spec 05). */
export interface StageRectPct {
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
}

/**
 * Pure ratio-based anchor math: converts an anchor + rendered diameter into
 * percentage offsets of the responsive stage container. Because everything is
 * a ratio of the 2400×1260 space, the result is pixel-correct at any container
 * width (320 px → 4K) with zero JS recalculation on resize.
 */
export function anchorRectPct(
  anchor: Pick<WheelAnchor, 'cx' | 'cy'>,
  renderedDiameterPx: number,
): StageRectPct {
  return {
    leftPct: ((anchor.cx - renderedDiameterPx / 2) / STAGE_WIDTH_PX) * 100,
    topPct: ((anchor.cy - renderedDiameterPx / 2) / STAGE_HEIGHT_PX) * 100,
    widthPct: (renderedDiameterPx / STAGE_WIDTH_PX) * 100,
    heightPct: (renderedDiameterPx / STAGE_HEIGHT_PX) * 100,
  };
}
