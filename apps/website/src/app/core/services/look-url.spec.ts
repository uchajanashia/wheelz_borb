import { Look, parseLook, serializeLook } from './look-url';

describe('look URL serialization (spec 05 §6)', () => {
  const look: Look = {
    trimId: 'bmw-3-series-g20-320i',
    tireId: 'aurelia-sportcontact-7-22545r18',
  };

  it('round-trips a look exactly', () => {
    expect(parseLook(serializeLook(look))).toEqual(look);
  });

  it('serializes to a single query-safe value (kebab ids have no dots)', () => {
    expect(serializeLook(look)).toBe('bmw-3-series-g20-320i.aurelia-sportcontact-7-22545r18');
  });

  it('rejects malformed values as null', () => {
    expect(parseLook(null)).toBeNull();
    expect(parseLook(undefined)).toBeNull();
    expect(parseLook('')).toBeNull();
    expect(parseLook('only-a-trim')).toBeNull();
    expect(parseLook('.tire-without-trim')).toBeNull();
    expect(parseLook('trim.')).toBeNull();
    expect(parseLook('a.b.c')).toBeNull();
  });
});
