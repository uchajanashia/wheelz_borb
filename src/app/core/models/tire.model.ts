/** Tire (product) — spec 04-data-model.md. Replaces the old Wheel model. */

import { SpeedRating, TireSize } from './fitment.model';

export type Season = 'summer' | 'winter' | 'all-season';

/** EU tyre label — a premium spec surface (05/06). */
export interface EuTireLabel {
  /** rolling resistance / fuel efficiency */
  fuelEfficiency: 'A' | 'B' | 'C' | 'D' | 'E';
  wetGrip: 'A' | 'B' | 'C' | 'D' | 'E';
  /** exterior noise in dB */
  noiseDb: number;
  noiseClass: 'A' | 'B' | 'C';
}

export interface TireAttributes {
  runFlat: boolean;
  /** winter — accepts studs */
  studdable?: boolean;
  /** 3-Peak Mountain Snowflake — severe-snow cert (winter / some all-season) */
  threePMSF?: boolean;
  /** M+S marking */
  mudSnow?: boolean;
  treadDepthMm?: number;
}

export interface TireMedia {
  /** hero studio shot, 3/4 */
  catalogUrl: string;
  /** sidewall/contour view used to composite the on-car tire ring (05 contract) */
  sidewallUrl: string;
  /** top-down tread pattern (detail inset + 3D normal hint) */
  treadUrl?: string;
  /** 3D model (optional) */
  glbUrl?: string;
  gallery: string[];
}

export interface Tire {
  id: string;
  brandId: string;
  model: string; // "PrimaContact 7"
  season: Season;
  size: TireSize;
  /** load index, table-mapped to kg (91 → 615 kg) */
  loadIndex: number;
  speedRating: SpeedRating;
  /** per tire; UI leads with set-of-4 price */
  priceGel: number;
  inStock: number;
  euLabel: EuTireLabel;
  attributes: TireAttributes;
  media: TireMedia;
  /** 'flagship','touring','sport','eco','run-flat'... */
  tags: string[];
}
