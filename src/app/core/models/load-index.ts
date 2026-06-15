/**
 * Standard ISO tire load-index → max load (kg) table (spec 04: 91 → 615 kg).
 * Used by the loadIndex pipe and anywhere a human-readable capacity is shown.
 * The fitment engine compares the raw numeric index, not the kg value.
 */
export const LOAD_INDEX_KG: Readonly<Record<number, number>> = {
  75: 387,
  76: 400,
  77: 412,
  78: 425,
  79: 437,
  80: 450,
  81: 462,
  82: 475,
  83: 487,
  84: 500,
  85: 515,
  86: 530,
  87: 545,
  88: 560,
  89: 580,
  90: 600,
  91: 615,
  92: 630,
  93: 650,
  94: 670,
  95: 690,
  96: 710,
  97: 730,
  98: 750,
  99: 775,
  100: 800,
  101: 825,
  102: 850,
  103: 875,
  104: 900,
  105: 925,
  106: 950,
  107: 975,
  108: 1000,
  109: 1030,
  110: 1060,
  111: 1090,
  112: 1120,
  113: 1150,
  114: 1180,
  115: 1215,
  116: 1250,
  117: 1285,
  118: 1320,
  119: 1360,
  120: 1400,
};

/** Max load in kg for a load index, or null if the index is off-table. */
export function loadIndexKg(index: number): number | null {
  return LOAD_INDEX_KG[index] ?? null;
}
