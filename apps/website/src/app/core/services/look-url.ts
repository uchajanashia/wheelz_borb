/**
 * "Save look" URL serialization (spec 05 §6): a look is `{ trimId, tireId }`
 * packed into a single `?look=` query value so a configuration can be shared
 * and restored exactly, pre-auth. Pure functions — unit-tested, no Angular.
 *
 * Format: `<trimId>.<tireId>` — ids are kebab-case (no dots), so `.` is a safe
 * separator. (The rim-era third "stance" segment is gone; an R3 sizing segment
 * can be reintroduced here.)
 */

export interface Look {
  trimId: string;
  tireId: string;
}

export function serializeLook(look: Look): string {
  return `${look.trimId}.${look.tireId}`;
}

/** Returns null for anything malformed — callers treat that as "no look". */
export function parseLook(raw: string | null | undefined): Look | null {
  if (!raw) {
    return null;
  }
  const [trimId, tireId, ...rest] = raw.split('.');
  if (!trimId || !tireId || rest.length > 0) {
    return null;
  }
  return { trimId, tireId };
}
