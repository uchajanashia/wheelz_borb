import { Injectable, computed, inject, signal } from '@angular/core';

import { StorageService } from './storage.service';

/**
 * Cart line — items are SETS of tires (spec 06): 4× for a standard fit, or a
 * 2 front + 2 rear pairing for a staggered car (`rearTireId` set). Price and
 * vehicle context are snapshotted at add-time (spec 03) so the cart survives
 * garage changes; the UI warns when the snapshot no longer matches the current
 * garage car. Full cart flows arrive later — this skeleton exists for the header
 * badge and the checkout guard.
 */
export interface CartLine {
  /** the (front) tire for the set */
  tireId: string;
  /** present only for a staggered set — the rear tire */
  rearTireId?: string;
  /** number of sets */
  setQty: number;
  /** per-tire price snapshot at add-time, GEL (front tire) */
  unitPriceGel: number;
  /** per-tire price snapshot for the rear tire of a staggered set, GEL */
  rearUnitPriceGel?: number;
  /** garage trim at add-time, for the mismatch warning */
  vehicleTrimId: string | null;
}

const CART_KEY = 'wheelz.cart';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly storage = inject(StorageService);

  private readonly itemsState = signal<CartLine[]>(this.storage.get<CartLine[]>(CART_KEY) ?? []);

  readonly items = this.itemsState.asReadonly();
  readonly isEmpty = computed(() => this.itemsState().length === 0);
  readonly setCount = computed(() => this.itemsState().reduce((sum, l) => sum + l.setQty, 0));

  /**
   * Add one tire set (spec 05/06). The same tire(s) for the same vehicle context
   * merge into one line with a higher set qty.
   */
  add(line: Omit<CartLine, 'setQty'>): void {
    const items = this.itemsState();
    const existing = items.findIndex(
      (l) =>
        l.tireId === line.tireId &&
        l.rearTireId === line.rearTireId &&
        l.vehicleTrimId === line.vehicleTrimId,
    );
    const next =
      existing >= 0
        ? items.map((l, i) => (i === existing ? { ...l, setQty: l.setQty + 1 } : l))
        : [...items, { ...line, setQty: 1 }];
    this.itemsState.set(next);
    this.storage.set(CART_KEY, next);
  }
}
