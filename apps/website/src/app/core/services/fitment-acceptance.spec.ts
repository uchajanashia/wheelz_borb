import { firstValueFrom } from 'rxjs';

import { Season, Tire, VehicleTrim } from '../models';
import {
  compatibleTiresForCar,
  filterTiresBySeason,
  resolveStaggeredSets,
} from './fitment-engine.service';
import { MockFitmentDataService } from './mock-fitment-data.service';

/**
 * R1 acceptance proof: the tire engine run over the real fixtures (replaces the
 * obsolete rim acceptance). The catalog/configurator render exactly
 * `compatibleTiresForCar` (which filters on `fits`), so these assertions are
 * equivalent to catalog/rail behavior.
 *
 *  - No deliberate no-fit tire (wrong rim diameter, or failed load index) ever
 *    appears as compatible for ANY fixture car.
 *  - Every compatible tire matches the car's rim diameter, meets the load floor,
 *    and is oem|alternative — never no-fit.
 *  - The staggered set resolves to the correct 2 front + 2 rear.
 *  - The season filter is correct.
 */

/** Wrong rim diameter (15″, 21″) → fit no car; the SUV winter fails Prado's load index. */
const NO_FIT_EVERYWHERE = [
  'kinetik-trackattack-24535r21', // 21″ — no car has a 21″ OEM rim
  'vektor-iceguard-19565r15', // 15″ — no car has a 15″ OEM rim
  'vektor-iceguard-suv-26565r17', // load index 108 < Prado's 112 (OD-fails the rest)
];

describe('Tire fitment acceptance over fixtures', () => {
  let trims: VehicleTrim[];
  let tires: Tire[];

  const compatibleFor = (trim: VehicleTrim) => compatibleTiresForCar(trim.fitment, tires);

  beforeAll(async () => {
    const service = new MockFitmentDataService();
    const makes = await firstValueFrom(service.getMakes());
    const models = (
      await Promise.all(makes.map((m) => firstValueFrom(service.getModels(m.id))))
    ).flat();
    trims = (await Promise.all(models.map((m) => firstValueFrom(service.getTrims(m.id))))).flat();
    tires = await firstValueFrom(service.getTires());
  });

  it('covers all 12 fixture trims and 44 tires', () => {
    expect(trims).toHaveLength(12);
    expect(tires).toHaveLength(44);
  });

  it('deliberate no-fit tires never appear for any fixture car', () => {
    for (const trim of trims) {
      const ids = compatibleFor(trim).map((f) => f.tire.id);
      for (const noFitId of NO_FIT_EVERYWHERE) {
        expect(ids, `"${noFitId}" must not fit ${trim.id}`).not.toContain(noFitId);
      }
    }
  });

  it('every compatible tire matches the rim, meets the load floor, and is oem|alternative', () => {
    for (const trim of trims) {
      for (const { tire, compatibility } of compatibleFor(trim)) {
        expect(
          trim.fitment.rimDiametersInch,
          `${tire.id} rim must be OEM for ${trim.id}`,
        ).toContain(tire.size.rimDiameterInch);
        expect(tire.loadIndex, `${tire.id} load on ${trim.id}`).toBeGreaterThanOrEqual(
          trim.fitment.minLoadIndex,
        );
        expect(compatibility.fits).toBe(true);
        expect(['oem', 'alternative']).toContain(compatibility.level);
      }
    }
  });

  it('every fixture car has at least one compatible tire (no dead garages)', () => {
    for (const trim of trims) {
      expect(compatibleFor(trim).length, `${trim.id} has no tires`).toBeGreaterThan(0);
    }
  });

  it('every fixture car has fitting tires in EVERY season (no empty car×season)', () => {
    const seasons: Season[] = ['summer', 'winter', 'all-season'];
    for (const trim of trims) {
      const fitted = compatibleFor(trim).map((f) => f.tire);
      for (const season of seasons) {
        expect(
          filterTiresBySeason(fitted, season).length,
          `${trim.id} has no ${season} tire`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('the season filter is correct for every car (partitions the compatible list)', () => {
    const seasons: Season[] = ['summer', 'winter', 'all-season'];
    for (const trim of trims) {
      const fitted = compatibleFor(trim);
      let summed = 0;
      for (const season of seasons) {
        const inSeason = filterTiresBySeason(
          fitted.map((f) => f.tire),
          season,
        );
        expect(inSeason.every((t) => t.season === season)).toBe(true);
        summed += inSeason.length;
      }
      expect(summed).toBe(fitted.length); // the three seasons partition the list
      expect(filterTiresBySeason(fitted.map((f) => f.tire), null)).toHaveLength(fitted.length);
    }
  });

  describe('staggered set resolution (2 front + 2 rear)', () => {
    it('370Z Sport resolves SportContact to OEM front 245/40 R19 + rear 275/35 R19', () => {
      const sport = trims.find((t) => t.id === 'nissan-370z-z34-sport')!;
      const sets = resolveStaggeredSets(sport.fitment, tires);
      const oemSet = sets.find(
        (s) => s.front.size.widthMm === 245 && s.rear.size.widthMm === 275,
      );
      expect(oemSet, 'a 245-front / 275-rear set must resolve').toBeTruthy();
      expect(oemSet!.front.size).toEqual({ widthMm: 245, aspect: 40, rimDiameterInch: 19 });
      expect(oemSet!.rear.size).toEqual({ widthMm: 275, aspect: 35, rimDiameterInch: 19 });
      expect(oemSet!.front.brandId).toBe(oemSet!.rear.brandId);
      expect(oemSet!.front.model).toBe(oemSet!.rear.model);
    });

    it('370Z NISMO resolves to OEM front 245/40 R19 + rear 285/35 R19', () => {
      const nismo = trims.find((t) => t.id === 'nissan-370z-z34-nismo')!;
      const sets = resolveStaggeredSets(nismo.fitment, tires);
      const oemSet = sets.find((s) => s.front.size.widthMm === 245 && s.rear.size.widthMm === 285);
      expect(oemSet, 'a 245-front / 285-rear set must resolve').toBeTruthy();
      expect(oemSet!.rear.size).toEqual({ widthMm: 285, aspect: 35, rimDiameterInch: 19 });
    });

    it('non-staggered cars resolve no staggered sets', () => {
      const golf = trims.find((t) => t.id === 'vw-golf-8-15tsi')!;
      expect(resolveStaggeredSets(golf.fitment, tires)).toHaveLength(0);
    });
  });

  describe('known nuanced cases', () => {
    const result = (trimId: string, tireId: string) => {
      const trim = trims.find((t) => t.id === trimId)!;
      const fitted = compatibleTiresForCar(trim.fitment, tires).find((f) => f.tire.id === tireId);
      return fitted?.compatibility;
    };

    it('Prado load-fail winter SUV tire is excluded', () => {
      const prado = trims.find((t) => t.id === 'toyota-land-cruiser-prado-150-vx')!;
      const ids = compatibleTiresForCar(prado.fitment, tires).map((f) => f.tire.id);
      expect(ids).not.toContain('vektor-iceguard-suv-26565r17');
    });

    it('M340i + winter 225/45 R18 (H, below OEM Y) → fits with a winter-speed-rating advisory', () => {
      const c = result('bmw-3-series-g20-m340i', 'aurelia-wintercontact-22545r18');
      expect(c?.fits).toBe(true);
      expect(c?.advisories.some((a) => a.kind === 'winter-speed-rating')).toBe(true);
    });

    it('320i + 245/45 R18 lands in the ±2–3% warning band with an aggressive-sizing advisory', () => {
      const c = result('bmw-3-series-g20-320i', 'aurelia-grandtour-24545r18');
      expect(c?.fits).toBe(true);
      expect(c?.reasons.find((r) => r.rule === 'overall-diameter')?.status).toBe('warning');
      expect(c?.advisories.some((a) => a.kind === 'aggressive-sizing')).toBe(true);
    });

    it('M340i + all-season 225/40 R19 (W, one grade below OEM Y) → warning, still fits', () => {
      const c = result('bmw-3-series-g20-m340i', 'aurelia-allseasoncontact-22540r19');
      expect(c?.fits).toBe(true);
      expect(c?.reasons.find((r) => r.rule === 'speed-rating')?.status).toBe('warning');
    });
  });

  it('prints the per-car compatibility + season matrix (demo evidence)', () => {
    const lines = trims.map((trim) => {
      const fitted = compatibleFor(trim);
      const oem = fitted.filter((f) => f.compatibility.level === 'oem').length;
      const alt = fitted.filter((f) => f.compatibility.level === 'alternative').length;
      const su = filterTiresBySeason(fitted.map((f) => f.tire), 'summer').length;
      const wi = filterTiresBySeason(fitted.map((f) => f.tire), 'winter').length;
      const al = filterTiresBySeason(fitted.map((f) => f.tire), 'all-season').length;
      const stag = trim.fitment.staggered ? resolveStaggeredSets(trim.fitment, tires).length : 0;
      return `${trim.id.padEnd(34)} ${fitted.length} fit (oem ${oem}, alt ${alt}) · season[S${su}/W${wi}/A${al}]${trim.fitment.staggered ? ` · staggered sets ${stag}` : ''}`;
    });
    console.log('\n=== Tire fitment matrix (per car) ===\n' + lines.join('\n'));
    expect(lines).toHaveLength(12);
  });
});
