/** Vehicle hierarchy — spec 04-data-model.md (shape unchanged, tire-oriented fitment). */

import { VehicleTireFitment } from './fitment.model';
import { VehicleVisual } from './visual.model';

export interface Make {
  id: string; // "bmw"
  name: string; // "BMW"
  logoUrl: string;
}

export type BodyType = 'sedan' | 'coupe' | 'suv' | 'hatchback' | 'wagon' | 'pickup';

export interface VehicleModel {
  id: string; // "bmw-3-series-g20"
  makeId: string;
  name: string; // "3 Series"
  generation: string; // "G20"
  yearFrom: number; // 2019
  yearTo: number | null; // null = current
  bodyType: BodyType;
}

export interface VehicleTrim {
  id: string; // "bmw-3-series-g20-320i"
  modelId: string;
  name: string; // "320i"
  /** decides which tires fit */
  fitment: VehicleTireFitment;
  /** configurator asset contract (05-configurator.md) */
  visual: VehicleVisual;
}
