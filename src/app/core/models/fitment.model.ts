/** Tire-fitment domain contracts — spec 04-data-model.md. */

/** Section width / aspect ratio / rim diameter → display "225/45 R18". */
export interface TireSize {
  /** section width in mm, e.g. 225 */
  widthMm: number;
  /** aspect ratio %, sidewall height as % of width, e.g. 45 */
  aspect: number;
  /** the rim diameter it mounts on, in inches, e.g. 18 */
  rimDiameterInch: number;
}

/** Speed rating symbols in ascending max-speed order (spec 04). */
export type SpeedRating = 'Q' | 'R' | 'S' | 'T' | 'H' | 'V' | 'W' | 'Y';

/** OEM tire spec for one rim diameter the car ships with. */
export interface OemTireByRim {
  rimDiameterInch: number; // 18
  front: TireSize; // OEM front size at this rim diameter
  rear?: TireSize; // present only if the car is staggered
}

/**
 * The contract that decides which tires fit a trim (replaces the rim
 * FitmentSpec — no PCD / offset / center bore: the customer already has rims).
 */
export interface VehicleTireFitment {
  /** OEM rim diameters the car ships with, e.g. [17, 18] */
  rimDiametersInch: number[];
  /** OEM tire spec per rim diameter */
  oemBySize: OemTireByRim[];
  /** front/rear different sizes (some RWD / sports cars) */
  staggered: boolean;
  /** safety floor — a tire's load index must meet or exceed this */
  minLoadIndex: number;
  /** OEM speed rating, the speed-rating comparison baseline */
  oemSpeedRating: SpeedRating;
}
