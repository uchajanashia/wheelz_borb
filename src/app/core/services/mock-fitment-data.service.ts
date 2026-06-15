import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

import brandsJson from '@data/brands.json';
import fitmentsJson from '@data/fitments.json';
import tiresJson from '@data/tires.json';
import vehiclesJson from '@data/vehicles.json';

import { Brand, Make, Tire, VehicleModel, VehicleTireFitment, VehicleTrim } from '../models';
import { FitmentDataService } from './fitment-data.service';

/**
 * JSON-fixture implementation. Fixtures are bundled at build time (SSR-safe — no
 * HTTP round-trip on the server). `vehicles.json` trims reference fitments.json
 * by `fitmentId`; this service joins them into the `VehicleTrim` domain shape so
 * components only ever see the spec-04 interfaces.
 */
@Injectable()
export class MockFitmentDataService extends FitmentDataService {
  private readonly makes = vehiclesJson.makes as Make[];
  private readonly models = vehiclesJson.models as VehicleModel[];
  private readonly brands = brandsJson as Brand[];
  private readonly tires = tiresJson as Tire[];

  private readonly trims: VehicleTrim[] = vehiclesJson.trims.map((trim) => {
    const fitment = (fitmentsJson as Record<string, VehicleTireFitment | undefined>)[trim.fitmentId];
    if (!fitment) {
      throw new Error(`Fixture error: trim "${trim.id}" references unknown fitment "${trim.fitmentId}"`);
    }
    return {
      id: trim.id,
      modelId: trim.modelId,
      name: trim.name,
      fitment,
      visual: trim.visual as VehicleTrim['visual'],
    };
  });

  getMakes(): Observable<Make[]> {
    return of(this.makes);
  }

  getModels(makeId: string): Observable<VehicleModel[]> {
    return of(this.models.filter((m) => m.makeId === makeId));
  }

  getModel(modelId: string): Observable<VehicleModel | undefined> {
    return of(this.models.find((m) => m.id === modelId));
  }

  getTrims(modelId: string): Observable<VehicleTrim[]> {
    return of(this.trims.filter((t) => t.modelId === modelId));
  }

  getTrim(trimId: string): Observable<VehicleTrim | undefined> {
    return of(this.trims.find((t) => t.id === trimId));
  }

  getBrands(): Observable<Brand[]> {
    return of(this.brands);
  }

  getTires(): Observable<Tire[]> {
    return of(this.tires);
  }

  getTire(tireId: string): Observable<Tire | undefined> {
    return of(this.tires.find((t) => t.id === tireId));
  }
}
