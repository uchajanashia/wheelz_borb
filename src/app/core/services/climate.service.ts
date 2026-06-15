import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, Signal, computed, effect, inject, signal } from '@angular/core';

import { Season } from '../models';
import { StorageService } from './storage.service';

const SEASON_KEY = 'auren.climate.season';
const ALL_CLASSES = ['climate-summer', 'climate-winter', 'climate-all-season'];

/**
 * Global climate (season) state (spec 03/07). The signature axis of the brand:
 * the selected season retints the whole site by applying a `climate-<season>`
 * class on the document root, which overrides the climate custom properties
 * (accent → the season's key light, sky/ground/glow hints). `null` = the neutral
 * studio "showroom" before a season is chosen.
 *
 * R2: calm theme retint + season filter + season frames. R3 adds the cinematic
 * stage transformation driven off this same state.
 */
@Injectable({ providedIn: 'root' })
export class ClimateService {
  private readonly storage = inject(StorageService);
  private readonly doc = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly seasonState = signal<Season | null>(this.storage.get<Season>(SEASON_KEY));

  readonly season = this.seasonState.asReadonly();
  readonly hasSeason = computed(() => this.seasonState() !== null);

  /** The theme class for the active climate, or '' in the neutral base. */
  readonly themeClass: Signal<string> = computed(() => {
    const s = this.seasonState();
    return s ? `climate-${s}` : '';
  });

  constructor() {
    // Apply the climate class on <html> so every surface (incl. body-appended
    // overlays) inherits the retinted custom properties. Browser-only.
    effect(() => {
      if (!this.isBrowser) {
        return;
      }
      const root = this.doc.documentElement;
      root.classList.remove(...ALL_CLASSES);
      const cls = this.themeClass();
      if (cls) {
        root.classList.add(cls);
      }
    });
  }

  setSeason(season: Season): void {
    this.seasonState.set(season);
    this.storage.set(SEASON_KEY, season);
  }

  clear(): void {
    this.seasonState.set(null);
    this.storage.remove(SEASON_KEY);
  }
}
