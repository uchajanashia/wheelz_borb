import { firstValueFrom } from 'rxjs';

import { MockFitmentDataService } from './mock-fitment-data.service';

/**
 * Fixture-contract tests (spec 04 "minimum viable dataset"). These guard the
 * mock data layer; the tire-fitment acceptance proof lives in fitment-acceptance.spec.
 */
describe('MockFitmentDataService', () => {
  let service: MockFitmentDataService;

  beforeEach(() => {
    service = new MockFitmentDataService();
  });

  it('ships 5 makes', async () => {
    const makes = await firstValueFrom(service.getMakes());
    expect(makes.length).toBe(5);
  });

  it('ships 8 models across the makes, including required body types', async () => {
    const makes = await firstValueFrom(service.getMakes());
    const models = (
      await Promise.all(makes.map((m) => firstValueFrom(service.getModels(m.id))))
    ).flat();
    expect(models.length).toBe(8);
    const bodyTypes = new Set(models.map((m) => m.bodyType));
    expect(bodyTypes.has('sedan')).toBe(true);
    expect(bodyTypes.has('coupe')).toBe(true);
    expect(bodyTypes.has('suv')).toBe(true);
    expect(bodyTypes.has('hatchback')).toBe(true);
  });

  it('ships 12 trims, each joined with a tire-fitment spec and a tire-ring visual contract', async () => {
    const makes = await firstValueFrom(service.getMakes());
    const models = (
      await Promise.all(makes.map((m) => firstValueFrom(service.getModels(m.id))))
    ).flat();
    const trims = (
      await Promise.all(models.map((m) => firstValueFrom(service.getTrims(m.id))))
    ).flat();

    expect(trims.length).toBe(12);
    for (const trim of trims) {
      expect(trim.fitment.rimDiametersInch.length).toBeGreaterThan(0);
      expect(trim.fitment.oemBySize.length).toBeGreaterThan(0);
      expect(trim.fitment.minLoadIndex).toBeGreaterThan(0);
      expect(trim.fitment.oemSpeedRating).toBeTruthy();
      expect(trim.visual.stageWidthPx).toBe(2400);
      expect(trim.visual.groundY).toBeGreaterThan(0);
      expect(trim.visual.frontWheel.cx).toBeGreaterThan(trim.visual.rearWheel.cx);
      expect(trim.visual.frontWheel.rimRadiusPx).toBeGreaterThan(0);
      expect(trim.visual.frontWheel.oemSidewallPx).toBeGreaterThan(0);
    }
  });

  it('includes at least one staggered car (RWD coupe)', async () => {
    const z = await firstValueFrom(service.getTrim('nissan-370z-z34-sport'));
    expect(z?.fitment.staggered).toBe(true);
    const front = z?.fitment.oemBySize.find((o) => o.rimDiameterInch === 19);
    expect(front?.front.widthMm).toBe(245);
    expect(front?.rear?.widthMm).toBe(275);
  });

  it('ships 3 brands across the three tiers', async () => {
    const brands = await firstValueFrom(service.getBrands());
    expect(brands.length).toBe(3);
    const tiers = new Set(brands.map((b) => b.tier));
    expect(tiers.has('flagship')).toBe(true);
    expect(tiers.has('performance')).toBe(true);
    expect(tiers.has('value')).toBe(true);
  });

  it('ships tires with full media placeholders and the three seasons', async () => {
    const tires = await firstValueFrom(service.getTires());
    expect(tires.length).toBeGreaterThanOrEqual(30);
    for (const tire of tires) {
      expect(tire.media.catalogUrl).toBeTruthy();
      expect(tire.media.sidewallUrl).toBeTruthy();
    }
    const seasons = new Set(tires.map((t) => t.season));
    expect(seasons.has('summer')).toBe(true);
    expect(seasons.has('winter')).toBe(true);
    expect(seasons.has('all-season')).toBe(true);
  });

  it('includes at least 3 tires with a 3D model (glbUrl)', async () => {
    const tires = await firstValueFrom(service.getTires());
    expect(tires.filter((t) => t.media.glbUrl).length).toBeGreaterThanOrEqual(3);
  });

  it('covers rim variety incl. deliberate no-fit sizes (15″ and 21″) and run-flat / 3PMSF', async () => {
    const tires = await firstValueFrom(service.getTires());
    const rims = new Set(tires.map((t) => t.size.rimDiameterInch));
    for (const r of [16, 17, 18, 19, 20]) {
      expect(rims.has(r)).toBe(true);
    }
    expect(rims.has(15)).toBe(true); // no-fit-everywhere
    expect(rims.has(21)).toBe(true); // no-fit-everywhere
    expect(tires.some((t) => t.attributes.runFlat)).toBe(true);
    expect(tires.some((t) => t.attributes.threePMSF)).toBe(true);
  });

  it('returns undefined for unknown ids', async () => {
    expect(await firstValueFrom(service.getTire('nope'))).toBeUndefined();
    expect(await firstValueFrom(service.getTrim('nope'))).toBeUndefined();
  });
});
