/** Configurator asset contract — spec 05-configurator.md. */

export interface WheelAnchor {
  /** rim center x in stage space */
  cx: number;
  /** rim center y in stage space */
  cy: number;
  /** rendered rim (bead seat) radius at this anchor — the inner edge of the tire ring */
  rimRadiusPx: number;
  /** rendered px sidewall height of the OEM tire here (calibration reference for tireRingScale) */
  oemSidewallPx: number;
  /** optional PNG/SVG that re-overlays fender lip / arch above the tire */
  occlusionMaskUrl?: string;
}

export interface VehicleVisual {
  /**
   * car in side profile WITH rims (tires removed / low-profile placeholder),
   * transparent bg, AVIF/WebP, 2400px wide.
   */
  sideProfileUrl: string;
  /** normative coordinate space — all anchor positions are in this space */
  stageWidthPx: 2400;
  /** y of the contact line in stage space (where tires meet ground — anchors effects/shadow) */
  groundY: number;
  frontWheel: WheelAnchor;
  rearWheel: WheelAnchor;
  /** optional per-color renders, phase 4+ */
  bodyColorVariants?: { name: string; hex: string; url: string }[];
}
