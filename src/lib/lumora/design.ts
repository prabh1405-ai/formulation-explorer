import { emptyResults, type DesignKind, type Material, type Trial } from "./types";

/** Deterministic 32-bit PRNG (mulberry32) so every design is reproducible. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** map coded level in [-1, 1] to grams */
const decode = (m: Material, coded: number) =>
  round2(((m.min + m.max) / 2 + (coded * (m.max - m.min)) / 2));

/** Latin-hypercube style design: every factor range is stratified into n bins. */
function latinHypercube(k: number, n: number, rand: () => number): number[][] {
  const cols: number[][] = [];
  for (let j = 0; j < k; j++) {
    const bins = Array.from({ length: n }, (_, i) => (i + rand()) / n);
    for (let i = n - 1; i > 0; i--) {
      const s = Math.floor(rand() * (i + 1));
      const tmp = bins[i]!;
      bins[i] = bins[s]!;
      bins[s] = tmp;
    }
    cols.push(bins.map((u) => u * 2 - 1));
  }
  return Array.from({ length: n }, (_, i) => cols.map((c) => c[i]!));
}

/** Face-centred central composite design (alpha = 1 keeps runs inside the range). */
function ccd(k: number): number[][] {
  const factorial: number[][] = [];
  const total = 2 ** k;
  for (let i = 0; i < total; i++) {
    factorial.push(Array.from({ length: k }, (_, j) => ((i >> j) & 1 ? 1 : -1)));
  }
  const axial: number[][] = [];
  for (let j = 0; j < k; j++) {
    for (const s of [-1, 1]) {
      const row = Array(k).fill(0);
      row[j] = s;
      axial.push(row);
    }
  }
  return [...factorial, ...axial, Array(k).fill(0)];
}

/** Box-Behnken design (k >= 3): pairs of factors at +-1, the rest at centre. */
function bbd(k: number): number[][] {
  const rows: number[][] = [];
  for (let a = 0; a < k; a++) {
    for (let b = a + 1; b < k; b++) {
      for (const sa of [-1, 1]) {
        for (const sb of [-1, 1]) {
          const row = Array(k).fill(0);
          row[a] = sa;
          row[b] = sb;
          rows.push(row);
        }
      }
    }
  }
  rows.push(Array(k).fill(0));
  rows.push(Array(k).fill(0));
  return rows;
}

export function generateDesign(
  materials: Material[],
  kind: DesignKind,
  seed: number,
): Trial[] {
  const k = materials.length;
  const rand = rng(seed);
  let coded: number[][];
  if (kind === "ccd") coded = ccd(k);
  else if (kind === "bbd" && k >= 3) coded = bbd(k);
  else coded = latinHypercube(k, 10, rand);

  return coded.map((row, i) => ({
    trial: i + 1,
    levels: row.map((c, j) => decode(materials[j]!, c)),
    results: emptyResults(),
  }));
}

export function designRunCount(kind: DesignKind, k: number) {
  if (kind === "ccd") return 2 ** k + 2 * k + 1;
  if (kind === "bbd" && k >= 3) return 4 * ((k * (k - 1)) / 2) + 2;
  return 10;
}
