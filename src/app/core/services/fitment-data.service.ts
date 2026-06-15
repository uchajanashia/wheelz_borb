import { Observable } from 'rxjs';

import { Brand, Make, Tire, VehicleModel, VehicleTrim } from '../models';

/**
 * Data-access abstraction (spec 02-tech-stack.md).
 *
 * The abstract class itself is the DI token: app.config provides
 * `{ provide: FitmentDataService, useClass: MockFitmentDataService }`, so a real
 * `HttpFitmentDataService` can replace the mock later with zero component changes.
 * Observable returns keep the contract identical for the future HTTP implementation.
 */
export abstract class FitmentDataService {
  abstract getMakes(): Observable<Make[]>;
  abstract getModels(makeId: string): Observable<VehicleModel[]>;
  abstract getModel(modelId: string): Observable<VehicleModel | undefined>;
  abstract getTrims(modelId: string): Observable<VehicleTrim[]>;
  abstract getTrim(trimId: string): Observable<VehicleTrim | undefined>;
  abstract getBrands(): Observable<Brand[]>;
  abstract getTires(): Observable<Tire[]>;
  abstract getTire(tireId: string): Observable<Tire | undefined>;
}
