import {
  STAGE_HEIGHT_PX,
  STAGE_WIDTH_PX,
  anchorRectPct,
  tireRingScale,
} from './tire-ring-scale';

/**
 * Spec 05 mandates tireRingScale() as a pure, unit-tested function: the on-car
 * tire ring's inner radius is fixed by the car's rim; only the sidewall (ring
 * thickness) scales with the tire's aspect ratio.
 */

const anchor = { cx: 1815, cy: 985, rimRadiusPx: 180, oemSidewallPx: 70 };

describe('tireRingScale', () => {
  it('mounting the OEM tire reproduces oemSidewallPx exactly (identity)', () => {
    const ring = tireRingScale(anchor, 101.25, 101.25);
    expect(ring.sidewallPx).toBeCloseTo(70, 10);
    expect(ring.innerRadiusPx).toBe(180);
    expect(ring.outerRadiusPx).toBeCloseTo(250, 10);
    expect(ring.outerDiameterPx).toBeCloseTo(500, 10);
  });

  it('inner radius is always the rim radius, independent of the tire', () => {
    expect(tireRingScale(anchor, 60, 100).innerRadiusPx).toBe(180);
    expect(tireRingScale(anchor, 140, 100).innerRadiusPx).toBe(180);
  });

  it('sidewall scales linearly with the tire sidewall mm', () => {
    // half the OEM sidewall → half the px sidewall
    expect(tireRingScale(anchor, 50, 100).sidewallPx).toBeCloseTo(35, 10);
    // double → double
    expect(tireRingScale(anchor, 200, 100).sidewallPx).toBeCloseTo(140, 10);
  });

  it('outer radius = rim + sidewall (low-profile reads smaller than high-profile)', () => {
    const lowProfile = tireRingScale(anchor, 70, 100); // 35-ish profile
    const highProfile = tireRingScale(anchor, 140, 100); // 55-ish profile
    expect(highProfile.outerRadiusPx).toBeGreaterThan(lowProfile.outerRadiusPx);
    expect(lowProfile.outerRadiusPx).toBeCloseTo(180 + 49, 10);
    expect(highProfile.outerRadiusPx).toBeCloseTo(180 + 98, 10);
  });

  it('is monotonic in sidewall mm', () => {
    const sizes = [40, 60, 80, 100, 120, 140].map((mm) => tireRingScale(anchor, mm, 100).outerDiameterPx);
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]!).toBeGreaterThan(sizes[i - 1]!);
    }
  });

  it('rejects non-positive inputs', () => {
    expect(() => tireRingScale({ rimRadiusPx: 0, oemSidewallPx: 70 }, 100, 100)).toThrow(RangeError);
    expect(() => tireRingScale({ rimRadiusPx: 180, oemSidewallPx: 0 }, 100, 100)).toThrow(RangeError);
    expect(() => tireRingScale(anchor, -1, 100)).toThrow(RangeError);
    expect(() => tireRingScale(anchor, 100, 0)).toThrow(RangeError);
  });
});

describe('anchorRectPct', () => {
  it('centers the rendered box on the anchor in ratio space', () => {
    const rect = anchorRectPct(anchor, 500);
    expect(rect.leftPct + rect.widthPct / 2).toBeCloseTo((1815 / STAGE_WIDTH_PX) * 100, 10);
    expect(rect.topPct + rect.heightPct / 2).toBeCloseTo((985 / STAGE_HEIGHT_PX) * 100, 10);
  });

  it('is pure ratio math — scaling the diameter scales only the box, not the center', () => {
    const a = anchorRectPct(anchor, 400);
    const b = anchorRectPct(anchor, 600);
    expect(a.leftPct + a.widthPct / 2).toBeCloseTo(b.leftPct + b.widthPct / 2, 10);
    expect(b.widthPct).toBeCloseTo((600 / STAGE_WIDTH_PX) * 100, 10);
    expect(b.heightPct).toBeCloseTo((600 / STAGE_HEIGHT_PX) * 100, 10);
  });
});
