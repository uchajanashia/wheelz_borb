/**
 * Tire-fitment algorithm output — spec 04-data-model.md.
 * Produced by FitmentEngineService: (VehicleTireFitment, Tire, opts) → CompatibilityResult.
 * Pure, fully unit-tested; components consume computed signals, never compute fitment.
 */

/** The hard/nuanced rules evaluated for every tire (drives the checklist UI). */
export type FitmentRule = 'rim-diameter' | 'overall-diameter' | 'load-index' | 'speed-rating';

/** OEM-exact size, legal substitute size, or does not fit. */
export type FitLevel = 'oem' | 'alternative' | 'no-fit';

export interface FitmentCheck {
  rule: FitmentRule;
  status: 'pass' | 'warning' | 'fail';
  /** human-readable explanation for the checklist row */
  detail: string;
}

/** Non-blocking guidance shown as info, never as an error. */
export interface Advisory {
  kind: 'winter-speed-rating' | 'season-use' | 'aggressive-sizing';
  text: string;
}

export interface CompatibilityResult {
  fits: boolean;
  level: FitLevel;
  /** every rule evaluated → drives the checklist UI */
  reasons: FitmentCheck[];
  /** non-blocking guidance (winter speed rating, aggressive sizing, season use) */
  advisories: Advisory[];
  /** signed % overall diameter vs OEM (for the "illustrative" sizing readout) */
  overallDiameterDeltaPct: number;
}
