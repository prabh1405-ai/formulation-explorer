import { rng } from "./design";
import {
  fitLogistic,
  fitMLR,
  fitRSM,
  fitRandomForest,
  makeCoder,
  type Classifier,
  type Fit,
  type Forest,
} from "./models";
import {
  RESPONSES,
  type Material,
  type ObjectiveSpec,
  type ResponseKey,
  type Trial,
} from "./types";

export type Dataset = {
  materials: Material[];
  names: string[];
  gramRows: number[][];
  codedRows: number[][];
  y: Record<ResponseKey, number[]>;
  completed: number;
  total: number;
  missing: { trial: number; response: string }[];
  ready: boolean;
};

export function buildDataset(materials: Material[], trials: Trial[]): Dataset {
  const names = materials.map((m) => m.name);
  const coder = makeCoder(materials.map((m) => ({ min: m.min, max: m.max })));
  const missing: { trial: number; response: string }[] = [];
  const complete: Trial[] = [];
  for (const t of trials) {
    let ok = true;
    for (const r of RESPONSES) {
      const v = t.results[r.key];
      if (v === null || v === undefined || Number.isNaN(v)) {
        missing.push({ trial: t.trial, response: r.label });
        ok = false;
      }
    }
    if (ok) complete.push(t);
  }
  const y = RESPONSES.reduce(
    (acc, r) => ({ ...acc, [r.key]: complete.map((t) => t.results[r.key] as number) }),
    {} as Record<ResponseKey, number[]>,
  );
  return {
    materials,
    names,
    gramRows: complete.map((t) => t.levels),
    codedRows: complete.map((t) => coder.encode(t.levels)),
    y,
    completed: complete.length,
    total: trials.length,
    missing,
    ready: missing.length === 0 && complete.length >= materials.length + 2,
  };
}

export type ResponseModels = {
  rsm: Fit;
  mlr: Fit;
  forest: Forest;
  classifier: Classifier;
};

export type Analysis = {
  dataset: Dataset;
  models: Record<ResponseKey, ResponseModels>;
  coder: ReturnType<typeof makeCoder>;
};

export function runAnalysis(
  materials: Material[],
  trials: Trial[],
  objectives: Record<ResponseKey, ObjectiveSpec>,
): Analysis {
  const dataset = buildDataset(materials, trials);
  const coder = makeCoder(materials.map((m) => ({ min: m.min, max: m.max })));
  const models = RESPONSES.reduce((acc, r) => {
    const y = dataset.y[r.key];
    const labels = y.map((v) => (v >= objectives[r.key].threshold ? 1 : 0));
    acc[r.key] = {
      rsm: fitRSM(dataset.names, dataset.codedRows, y),
      mlr: fitMLR(dataset.names, dataset.codedRows, y),
      forest: fitRandomForest(dataset.codedRows, y, 42),
      classifier: fitLogistic(dataset.codedRows, labels),
    };
    return acc;
  }, {} as Record<ResponseKey, ResponseModels>);
  return { dataset, models, coder };
}

/* ------------------------------- predictions ------------------------------- */

export function predictAll(
  analysis: Analysis,
  grams: number[],
): Record<ResponseKey, { rsm: number; mlr: number; forest: number; blended: number }> {
  const coded = analysis.coder.encode(grams);
  return RESPONSES.reduce(
    (acc, r) => {
      const m = analysis.models[r.key];
      const rsm = clampPct(m.rsm.predict(coded));
      const mlr = clampPct(m.mlr.predict(coded));
      const forest = clampPct(m.forest.predict(coded));
      acc[r.key] = { rsm, mlr, forest, blended: clampPct(0.6 * rsm + 0.4 * forest) };
      return acc;
    },
    {} as Record<
      ResponseKey,
      { rsm: number; mlr: number; forest: number; blended: number }
    >,
  );
}

export const clampPct = (v: number) => Math.max(0, Math.min(100, v));

/* --------------------------- desirability + search ------------------------- */

/** Derringer-Suich style individual desirability in [0, 1]. */
export function desirability(value: number, spec: ObjectiveSpec): number {
  const lo = 0;
  const hi = 100;
  if (spec.goal === "max") return clamp01((value - lo) / (spec.target - lo || 1));
  if (spec.goal === "min") return clamp01((hi - value) / (hi - spec.target || 1));
  const span = Math.max(1, (hi - lo) * 0.25);
  return clamp01(1 - Math.abs(value - spec.target) / span);
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export type Candidate = {
  rank: number;
  grams: number[];
  predicted: Record<ResponseKey, number>;
  overall: number;
  perResponse: Record<ResponseKey, number>;
};

/**
 * Multi-objective optimisation: weighted geometric mean of desirabilities,
 * searched with a seeded random sample plus local refinement, then filtered so
 * the reported candidates are meaningfully different from each other.
 */
export function optimize(
  analysis: Analysis,
  objectives: Record<ResponseKey, ObjectiveSpec>,
  seed = 7,
  samples = 4000,
): Candidate[] {
  const ranges = analysis.dataset.materials.map((m) => ({ min: m.min, max: m.max }));
  const rand = rng(seed);
  const score = (grams: number[]) => {
    const pred = predictAll(analysis, grams);
    const perResponse = {} as Record<ResponseKey, number>;
    const predicted = {} as Record<ResponseKey, number>;
    let logSum = 0;
    let wSum = 0;
    for (const r of RESPONSES) {
      const spec = objectives[r.key];
      const value = pred[r.key].blended;
      const d = desirability(value, spec);
      predicted[r.key] = value;
      perResponse[r.key] = d;
      const w = Math.max(0.0001, spec.weight);
      logSum += w * Math.log(Math.max(d, 1e-6));
      wSum += w;
    }
    return { overall: Math.exp(logSum / wSum), predicted, perResponse };
  };

  const pool: { grams: number[]; overall: number }[] = [];
  for (let i = 0; i < samples; i++) {
    const grams = ranges.map(
      (r) => Math.round((r.min + rand() * (r.max - r.min)) * 100) / 100,
    );
    pool.push({ grams, overall: score(grams).overall });
  }
  pool.sort((a, b) => b.overall - a.overall);

  // local refinement of the best starting points
  const refined = pool.slice(0, 12).map((p) => {
    let best = p;
    let stepScale = 0.25;
    for (let it = 0; it < 300; it++) {
      const grams = best.grams.map((g, j) => {
        const r = ranges[j]!;
        const step = (r.max - r.min) * stepScale * (rand() * 2 - 1);
        return Math.round(Math.max(r.min, Math.min(r.max, g + step)) * 100) / 100;
      });
      const s = score(grams).overall;
      if (s > best.overall) best = { grams, overall: s };
      if (it % 60 === 59) stepScale *= 0.6;
    }
    return best;
  });

  refined.sort((a, b) => b.overall - a.overall);

  const distinct: typeof refined = [];
  for (const cand of refined) {
    const far = distinct.every(
      (d) =>
        Math.max(
          ...cand.grams.map(
            (g, j) =>
              Math.abs(g - d.grams[j]!) / Math.max(1e-6, ranges[j]!.max - ranges[j]!.min),
          ),
        ) > 0.12,
    );
    if (far) distinct.push(cand);
    if (distinct.length === 3) break;
  }

  return distinct.map((c, i) => {
    const s = score(c.grams);
    return {
      rank: i + 1,
      grams: c.grams,
      predicted: s.predicted,
      perResponse: s.perResponse,
      overall: s.overall * 100,
    };
  });
}

/** Quality gate using the trained logistic classifiers where available. */
export function qualityCheck(analysis: Analysis, grams: number[]) {
  const coded = analysis.coder.encode(grams);
  const pred = predictAll(analysis, grams);
  return RESPONSES.map((r) => {
    const c = analysis.models[r.key].classifier;
    const value = pred[r.key].blended;
    return {
      key: r.key,
      label: r.label,
      value,
      trained: c.trained,
      reason: c.reason,
      probability: c.predict(coded).p,
      pass: c.trained ? c.predict(coded).pass : null,
      accuracy: c.accuracy,
    };
  });
}

/** Grid for the response-surface / contour plots (two factors, others centred). */
export function surfaceGrid(
  analysis: Analysis,
  fx: number,
  fy: number,
  response: ResponseKey,
  steps = 28,
) {
  const mats = analysis.dataset.materials;
  const centre = mats.map((m) => (m.min + m.max) / 2);
  const xs = Array.from(
    { length: steps },
    (_, i) => mats[fx]!.min + ((mats[fx]!.max - mats[fx]!.min) * i) / (steps - 1),
  );
  const ys = Array.from(
    { length: steps },
    (_, i) => mats[fy]!.min + ((mats[fy]!.max - mats[fy]!.min) * i) / (steps - 1),
  );
  const z = ys.map((yv) =>
    xs.map((xv) => {
      const grams = [...centre];
      grams[fx] = xv;
      grams[fy] = yv;
      return clampPct(analysis.models[response].rsm.predict(analysis.coder.encode(grams)));
    }),
  );
  return { xs, ys, z };
}
