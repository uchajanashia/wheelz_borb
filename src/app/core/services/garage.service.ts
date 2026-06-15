import { Injectable, computed, inject, signal } from '@angular/core';

import { StorageService } from './storage.service';

/**
 * Lightweight reference persisted to localStorage. Full VehicleTrim objects are
 * re-hydrated from FitmentDataService on demand (Phase 2) — fixtures stay the
 * single source of truth for fitment data.
 */
export interface GarageVehicleRef {
  makeId: string;
  modelId: string;
  trimId: string;
  /** display label, e.g. "BMW 3 Series G20 330i" — for chips before hydration */
  label: string;
}

const SELECTED_KEY = 'wheelz.garage.selected';
const RECENT_KEY = 'wheelz.garage.recent';
const RECENT_MAX = 5;

/**
 * "My Garage" state (spec 03): selected vehicle survives reloads via
 * localStorage, no auth in v1. The fitment-filtered pipeline (Phase 2) hangs off
 * `selectedVehicle`.
 */
@Injectable({ providedIn: 'root' })
export class GarageService {
  private readonly storage = inject(StorageService);

  private readonly selectedVehicleState = signal<GarageVehicleRef | null>(
    this.storage.get<GarageVehicleRef>(SELECTED_KEY),
  );
  private readonly recentVehiclesState = signal<GarageVehicleRef[]>(
    this.storage.get<GarageVehicleRef[]>(RECENT_KEY) ?? [],
  );

  readonly selectedVehicle = this.selectedVehicleState.asReadonly();
  readonly recentVehicles = this.recentVehiclesState.asReadonly();
  readonly hasVehicle = computed(() => this.selectedVehicleState() !== null);

  selectVehicle(vehicle: GarageVehicleRef): void {
    this.selectedVehicleState.set(vehicle);
    this.storage.set(SELECTED_KEY, vehicle);

    const recent = [
      vehicle,
      ...this.recentVehiclesState().filter((v) => v.trimId !== vehicle.trimId),
    ].slice(0, RECENT_MAX);
    this.recentVehiclesState.set(recent);
    this.storage.set(RECENT_KEY, recent);
  }

  clear(): void {
    this.selectedVehicleState.set(null);
    this.storage.remove(SELECTED_KEY);
  }
}
