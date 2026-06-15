import { SpeedRating, Tire, TireSize, VehicleTireFitment } from '../models';
import {
  OVERALL_DIAMETER_FIT_PCT,
  OVERALL_DIAMETER_WARN_PCT,
  checkCompatibility,
  classifyOverallDiameter,
  compatibleTiresForCar,
  filterTiresBySeason,
  overallDiameterMm,
  resolveStaggeredSets,
  sidewallMm,
} from './fitment-engine.service';

/**
 * Mandatory engine coverage (spec 04, written BEFORE the implementation):
 * rim-diameter gate; overall-diameter ±3% boundaries (inclusive/exclusive both
 * edges) and the ±2% warning band; load-index pass/fail boundary; every
 * speed-rating branch incl. the winter-below-OEM case; staggered both-sizes-
 * required; each hard-fail rule independently; combined failures.
 */

const size = (widthMm: number, aspect: number, rimDiameterInch: number): TireSize => ({
  widthMm,
  aspect,
  rimDiameterInch,
});

const fitment = (over: Partial<VehicleTireFitment> = {}): VehicleTireFitment => ({
  rimDiametersInch: [18, 19],
  oemBySize: [
    { rimDiameterInch: 18, front: size(225, 45, 18) },
    { rimDiameterInch: 19, front: size(245, 40, 19) },
  ],
  staggered: false,
  minLoadIndex: 94,
  oemSpeedRating: 'V',
  ...over,
});

const tire = (over: Partial<Tire> = {}): Tire => ({
  id: 't',
  brandId: 'b',
  model: 'M',
  season: 'summer',
  size: size(225, 45, 18),
  loadIndex: 95,
  speedRating: 'V',
  priceGel: 100,
  inStock: 8,
  euLabel: { fuelEfficiency: 'B', wetGrip: 'A', noiseDb: 71, noiseClass: 'B' },
  attributes: { runFlat: false },
  media: { catalogUrl: '', sidewallUrl: '', gallery: [] },
  tags: [],
  ...over,
});

const statusOf = (result: ReturnType<typeof checkCompatibility>, rule: string) =>
  result.reasons.find((r) => r.rule === rule)?.status;

const hasAdvisory = (result: ReturnType<typeof checkCompatibility>, kind: string) =>
  result.advisories.some((a) => a.kind === kind);

describe('geometry helpers', () => {
  it('sidewall height = width × aspect / 100', () => {
    expect(sidewallMm(size(225, 45, 18))).toBeCloseTo(101.25, 6);
  });

  it('overall diameter = rim(mm) + 2 × sidewall', () => {
    expect(overallDiameterMm(size(225, 45, 18))).toBeCloseTo(18 * 25.4 + 2 * 101.25, 6);
  });
});

describe('classifyOverallDiameter — ±3% hard / ±2% warning, exact edges', () => {
  it('exposes the band constants', () => {
    expect(OVERALL_DIAMETER_FIT_PCT).toBe(3);
    expect(OVERALL_DIAMETER_WARN_PCT).toBe(2);
  });

  it('within ±2% (inclusive) → pass', () => {
    expect(classifyOverallDiameter(0).status).toBe('pass');
    expect(classifyOverallDiameter(2).status).toBe('pass');
    expect(classifyOverallDiameter(-2).status).toBe('pass');
  });

  it('beyond ±2% up to ±3% (inclusive) → warning', () => {
    expect(classifyOverallDiameter(2.0001).status).toBe('warning');
    expect(classifyOverallDiameter(-2.0001).status).toBe('warning');
    expect(classifyOverallDiameter(3).status).toBe('warning');
    expect(classifyOverallDiameter(-3).status).toBe('warning');
  });

  it('beyond ±3% (exclusive) → fail', () => {
    expect(classifyOverallDiameter(3.0001).status).toBe('fail');
    expect(classifyOverallDiameter(-3.0001).status).toBe('fail');
  });
});

describe('checkCompatibility — exact OEM match', () => {
  it('fits at level "oem" with all hard rules passing, no advisories', () => {
    const r = checkCompatibility(fitment(), tire(), { rimDiameterInch: 18 });
    expect(r.fits).toBe(true);
    expect(r.level).toBe('oem');
    expect(r.overallDiameterDeltaPct).toBeCloseTo(0, 6);
    expect(r.reasons.map((c) => c.rule).sort()).toEqual([
      'load-index',
      'overall-diameter',
      'rim-diameter',
      'speed-rating',
    ]);
    expect(r.reasons.every((c) => c.status === 'pass')).toBe(true);
    expect(r.advisories).toHaveLength(0);
  });
});

describe('rim-diameter gate (hard)', () => {
  it('tire rim not equal to the selected rim → hard fail', () => {
    const r = checkCompatibility(fitment(), tire({ size: size(245, 40, 19) }), {
      rimDiameterInch: 18,
    });
    expect(r.fits).toBe(false);
    expect(r.level).toBe('no-fit');
    expect(statusOf(r, 'rim-diameter')).toBe('fail');
  });

  it('defaults the selected rim to the lowest OEM when unspecified', () => {
    // lowest OEM is 18; an 18" OEM-exact tire passes the gate with no opts
    expect(statusOf(checkCompatibility(fitment(), tire()), 'rim-diameter')).toBe('pass');
    // a 19" tire fails against the defaulted 18" gate
    expect(statusOf(checkCompatibility(fitment(), tire({ size: size(245, 40, 19) })), 'rim-diameter')).toBe(
      'fail',
    );
  });
});

describe('overall-diameter through real sizes', () => {
  it('legal alternative within ±2% → fits as "alternative", pass status', () => {
    // 235/45R18 vs OEM 225/45R18: +1.36%
    const r = checkCompatibility(fitment(), tire({ size: size(235, 45, 18) }), { rimDiameterInch: 18 });
    expect(r.fits).toBe(true);
    expect(r.level).toBe('alternative');
    expect(statusOf(r, 'overall-diameter')).toBe('pass');
    expect(r.overallDiameterDeltaPct).toBeGreaterThan(0);
  });

  it('alternative in the ±2–3% band → warning + aggressive-sizing advisory', () => {
    // 235/40R18 vs OEM 225/45R18: -2.20%
    const r = checkCompatibility(fitment(), tire({ size: size(235, 40, 18) }), { rimDiameterInch: 18 });
    expect(r.fits).toBe(true);
    expect(statusOf(r, 'overall-diameter')).toBe('warning');
    expect(hasAdvisory(r, 'aggressive-sizing')).toBe(true);
  });

  it('beyond ±3% → hard fail (overall-diameter)', () => {
    // 225/40R18 vs OEM 225/45R18: -3.41%
    const r = checkCompatibility(fitment(), tire({ size: size(225, 40, 18) }), { rimDiameterInch: 18 });
    expect(r.fits).toBe(false);
    expect(statusOf(r, 'overall-diameter')).toBe('fail');
  });
});

describe('load-index (hard) boundary', () => {
  it('exactly meeting minLoadIndex → pass', () => {
    const r = checkCompatibility(fitment(), tire({ loadIndex: 94 }), { rimDiameterInch: 18 });
    expect(statusOf(r, 'load-index')).toBe('pass');
    expect(r.fits).toBe(true);
  });

  it('one below minLoadIndex → hard fail (never softened)', () => {
    const r = checkCompatibility(fitment(), tire({ loadIndex: 93 }), { rimDiameterInch: 18 });
    expect(statusOf(r, 'load-index')).toBe('fail');
    expect(r.fits).toBe(false);
    expect(r.level).toBe('no-fit');
  });
});

describe('speed-rating (nuanced) — every branch', () => {
  const sr = (rating: SpeedRating, season: Tire['season'] = 'summer') =>
    checkCompatibility(fitment({ oemSpeedRating: 'V' }), tire({ speedRating: rating, season }), {
      rimDiameterInch: 18,
    });

  it('equal to OEM → pass', () => {
    expect(statusOf(sr('V'), 'speed-rating')).toBe('pass');
  });

  it('above OEM → pass', () => {
    expect(statusOf(sr('W'), 'speed-rating')).toBe('pass');
    expect(statusOf(sr('Y'), 'speed-rating')).toBe('pass');
  });

  it('winter tire below OEM → pass + winter-speed-rating advisory (legal for winter)', () => {
    const r = sr('T', 'winter'); // T is two grades below V
    expect(statusOf(r, 'speed-rating')).toBe('pass');
    expect(r.fits).toBe(true);
    expect(hasAdvisory(r, 'winter-speed-rating')).toBe(true);
  });

  it('winter tire one grade below OEM → pass + advisory', () => {
    const r = sr('H', 'winter');
    expect(statusOf(r, 'speed-rating')).toBe('pass');
    expect(hasAdvisory(r, 'winter-speed-rating')).toBe(true);
  });

  it('non-winter exactly one grade below OEM → warning (still fits)', () => {
    const r = sr('H', 'summer'); // H is one grade below V
    expect(statusOf(r, 'speed-rating')).toBe('warning');
    expect(r.fits).toBe(true);
    expect(hasAdvisory(r, 'winter-speed-rating')).toBe(false);
  });

  it('non-winter more than one grade below OEM → hard fail', () => {
    const r = sr('T', 'summer'); // T is two grades below V
    expect(statusOf(r, 'speed-rating')).toBe('fail');
    expect(r.fits).toBe(false);
  });

  it('all-season is treated as non-winter for the speed rule', () => {
    expect(statusOf(sr('T', 'all-season'), 'speed-rating')).toBe('fail');
    expect(statusOf(sr('H', 'all-season'), 'speed-rating')).toBe('warning');
  });
});

describe('season is never a compatibility failure', () => {
  it('a winter tire that passes the hard rules fits regardless of selected season', () => {
    const r = checkCompatibility(fitment({ oemSpeedRating: 'H' }), tire({ season: 'winter', speedRating: 'H' }), {
      rimDiameterInch: 18,
    });
    expect(r.fits).toBe(true);
    // no 'season' rule exists in the checklist
    expect(r.reasons.some((c) => (c.rule as string) === 'season')).toBe(false);
  });
});

describe('each hard-fail rule independently + combined', () => {
  it('only load-index fails (rim, overall-diameter, speed all pass)', () => {
    const r = checkCompatibility(fitment(), tire({ loadIndex: 90 }), { rimDiameterInch: 18 });
    expect(statusOf(r, 'rim-diameter')).toBe('pass');
    expect(statusOf(r, 'overall-diameter')).toBe('pass');
    expect(statusOf(r, 'speed-rating')).toBe('pass');
    expect(statusOf(r, 'load-index')).toBe('fail');
    expect(r.fits).toBe(false);
  });

  it('only overall-diameter fails', () => {
    const r = checkCompatibility(fitment(), tire({ size: size(225, 40, 18) }), { rimDiameterInch: 18 });
    expect(statusOf(r, 'rim-diameter')).toBe('pass');
    expect(statusOf(r, 'load-index')).toBe('pass');
    expect(statusOf(r, 'speed-rating')).toBe('pass');
    expect(statusOf(r, 'overall-diameter')).toBe('fail');
  });

  it('only speed-rating fails', () => {
    const r = checkCompatibility(fitment({ oemSpeedRating: 'Y' }), tire({ speedRating: 'V' }), {
      rimDiameterInch: 18,
    });
    expect(statusOf(r, 'rim-diameter')).toBe('pass');
    expect(statusOf(r, 'load-index')).toBe('pass');
    expect(statusOf(r, 'overall-diameter')).toBe('pass');
    expect(statusOf(r, 'speed-rating')).toBe('fail');
  });

  it('reports every failing rule, not just the first', () => {
    const r = checkCompatibility(
      fitment({ oemSpeedRating: 'Y' }),
      tire({ size: size(225, 40, 19), loadIndex: 80, speedRating: 'S' }),
      { rimDiameterInch: 18 },
    );
    expect(r.fits).toBe(false);
    expect(r.level).toBe('no-fit');
    expect(statusOf(r, 'rim-diameter')).toBe('fail'); // 19 ≠ 18
    expect(statusOf(r, 'load-index')).toBe('fail');
    expect(statusOf(r, 'speed-rating')).toBe('fail');
  });
});

describe('compatibleTiresForCar — non-staggered', () => {
  const cars = fitment();
  const tires: Tire[] = [
    tire({ id: 'oem18', size: size(225, 45, 18) }),
    tire({ id: 'alt18', size: size(235, 45, 18) }),
    tire({ id: 'oem19', size: size(245, 40, 19) }),
    tire({ id: 'wrong16', size: size(205, 55, 16) }),
    tire({ id: 'wrong21', size: size(245, 35, 21) }),
    tire({ id: 'loadfail', size: size(225, 45, 18), loadIndex: 88 }),
  ];

  it('lists only fitting tires; wrong-rim and load-fail never appear', () => {
    const ids = compatibleTiresForCar(cars, tires).map((f) => f.tire.id);
    expect(ids).toContain('oem18');
    expect(ids).toContain('alt18');
    expect(ids).toContain('oem19');
    expect(ids).not.toContain('wrong16');
    expect(ids).not.toContain('wrong21');
    expect(ids).not.toContain('loadfail');
  });

  it('annotates the OEM-exact tire as level oem and the substitute as alternative', () => {
    const fitted = compatibleTiresForCar(cars, tires);
    expect(fitted.find((f) => f.tire.id === 'oem18')?.compatibility.level).toBe('oem');
    expect(fitted.find((f) => f.tire.id === 'alt18')?.compatibility.level).toBe('alternative');
  });
});

describe('staggered — both sizes required, set resolves 2+2', () => {
  const coupe = fitment({
    rimDiametersInch: [19],
    oemBySize: [{ rimDiameterInch: 19, front: size(245, 40, 19), rear: size(275, 35, 19) }],
    staggered: true,
    minLoadIndex: 95,
    oemSpeedRating: 'Y',
  });

  const frontTire = tire({ id: 'fam-front', brandId: 'k', model: 'Apex', size: size(245, 40, 19), loadIndex: 96, speedRating: 'Y' });
  const rearTire = tire({ id: 'fam-rear', brandId: 'k', model: 'Apex', size: size(275, 35, 19), loadIndex: 99, speedRating: 'Y' });

  it('a front-width tire is assigned to the front axle, a rear-width tire to the rear', () => {
    const fitted = compatibleTiresForCar(coupe, [frontTire, rearTire]);
    expect(fitted.find((f) => f.tire.id === 'fam-front')?.axle).toBe('front');
    expect(fitted.find((f) => f.tire.id === 'fam-rear')?.axle).toBe('rear');
  });

  it('resolves a 2+2 set only when the model offers BOTH front and rear sizes', () => {
    const both = resolveStaggeredSets(coupe, [frontTire, rearTire]);
    expect(both).toHaveLength(1);
    expect(both[0]!.front.size).toEqual(size(245, 40, 19));
    expect(both[0]!.rear.size).toEqual(size(275, 35, 19));

    // front-only model → no complete set
    expect(resolveStaggeredSets(coupe, [frontTire])).toHaveLength(0);
  });
});

describe('filterTiresBySeason', () => {
  const tires = [
    tire({ id: 's', season: 'summer' }),
    tire({ id: 'w', season: 'winter' }),
    tire({ id: 'a', season: 'all-season' }),
  ];

  it('null season → all tires (no filter)', () => {
    expect(filterTiresBySeason(tires, null)).toHaveLength(3);
  });

  it('a season → only that season', () => {
    expect(filterTiresBySeason(tires, 'winter').map((t) => t.id)).toEqual(['w']);
    expect(filterTiresBySeason(tires, 'summer').map((t) => t.id)).toEqual(['s']);
    expect(filterTiresBySeason(tires, 'all-season').map((t) => t.id)).toEqual(['a']);
  });
});
