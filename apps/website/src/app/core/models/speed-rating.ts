import { SpeedRating } from './fitment.model';

/** Speed ratings in ascending max-speed order (spec 04). Index = rank. */
export const SPEED_RATING_ORDER: readonly SpeedRating[] = [
  'Q',
  'R',
  'S',
  'T',
  'H',
  'V',
  'W',
  'Y',
];

/** Max speed (km/h) per rating (spec 04: Y → 300 km/h). */
export const SPEED_RATING_KMH: Readonly<Record<SpeedRating, number>> = {
  Q: 160,
  R: 170,
  S: 180,
  T: 190,
  H: 210,
  V: 240,
  W: 270,
  Y: 300,
};

/** Ordinal rank (0..7) for comparing two speed ratings. */
export function speedRatingRank(rating: SpeedRating): number {
  return SPEED_RATING_ORDER.indexOf(rating);
}

/**
 * Grade difference `a - b`: positive when `a` is faster-rated than `b`,
 * 0 when equal, negative when `a` is below `b`.
 */
export function speedRatingDelta(a: SpeedRating, b: SpeedRating): number {
  return speedRatingRank(a) - speedRatingRank(b);
}

export function speedRatingKmh(rating: SpeedRating): number {
  return SPEED_RATING_KMH[rating];
}
