/** Numerical core: ridge/OLS regression, RSM quadratic model, random forest, logistic regression. */

import { rng } from "./design";

export type Fit = {
  coefficients: number[];
  terms: string[];
  r2: number;
  adjR2: number;
  rmse: number;
  predict: (x: number[]) => number;
  fitted: number[];
  actual: number[];
};

/* ------------------------------ linear algebra ----------------------------- */

function transposeMul(A: number[][], B: number[][]) {
  const n = A[0]!.length;
  const m = B[0]!.length;
  const out = Array.from({ length: n }, () => Array(m).fill(0) as number[]);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      let s = 0;
      for (let r = 0; r < A.length; r++) s += A[r]![i]! * B[r]![j]!;
      out[i]![j] = s;
    }
  return out;
}

function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++)
      if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    const tmp = M[c]!;
    M[c] = M[piv]!;
    M[piv] = tmp;
    const p = M[c]![c]!;
    if (Math.abs(p) < 1e-12) continue;
    for (let j = c; j <= n; j++) M[c]![j] = M[c]![j]! / p;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r]![c]!;
      if (!f) continue;
      for (let j = c; j <= n; j++) M[r]![j] = M[r]![j]! - f * M[c]![j]!;
    }
  }
  return Array.from({ length: n }, (_, i) => M[i]![n]!);
}

/** Ridge regression. lambda = 0 gives plain least squares. */
export function ridge(X: number[][], y: number[], lambda: number): number[] {
  const XtX = transposeMul(X, X);
  const Xty = transposeMul(
    X,
    y.map((v) => [v]),
  ).map((r) => r[0]!);
  for (let i = 1; i < XtX.length; i++) XtX[i]![i] = XtX[i]![i]! + lambda;
  return solve(XtX, Xty);
}

/* --------------------------------- coding --------------------------------- */

export type Coder = {
  encode: (grams: number[]) => number[];
  ranges: { min: number; max: number }[];
};

export function makeCoder(ranges: { min: number; max: number }[]): Coder {
  return {
    ranges,
    encode: (grams) =>
      grams.map((g, j) => {
        const { min, max } = ranges[j]!;
        const mid = (min + max) / 2;
        const half = (max - min) / 2 || 1;
        return (g - mid) / half;
      }),
  };
}

/* ------------------------------ design matrices ---------------------------- */

export function linearTerms(names: string[]) {
  return {
    terms: ["Intercept", ...names],
    build: (x: number[]) => [1, ...x],
  };
}

export function quadraticTerms(names: string[]) {
  const k = names.length;
  const terms = ["Intercept", ...names];
  const pairs: [number, number][] = [];
  for (let i = 0; i < k; i++)
    for (let j = i + 1; j < k; j++) {
      pairs.push([i, j]);
      terms.push(`${names[i]} x ${names[j]}`);
    }
  for (let i = 0; i < k; i++) terms.push(`${names[i]}^2`);
  return {
    terms,
    build: (x: number[]) => [
      1,
      ...x,
      ...pairs.map(([i, j]) => x[i]! * x[j]!),
      ...x.map((v) => v * v),
    ],
  };
}

function metrics(actual: number[], fitted: number[], p: number) {
  const n = actual.length;
  const mean = actual.reduce((a, b) => a + b, 0) / n;
  const sst = actual.reduce((a, v) => a + (v - mean) ** 2, 0);
  const sse = actual.reduce((a, v, i) => a + (v - fitted[i]!) ** 2, 0);
  const r2 = sst > 1e-12 ? 1 - sse / sst : 0;
  const dof = n - p;
  const adjR2 = dof > 0 && sst > 1e-12 ? 1 - (sse / dof) / (sst / (n - 1)) : r2;
  return { r2, adjR2, rmse: Math.sqrt(sse / n) };
}

function fitBasis(
  basis: { terms: string[]; build: (x: number[]) => number[] },
  codedX: number[][],
  y: number[],
  lambda: number,
): Fit {
  const X = codedX.map(basis.build);
  const beta = ridge(X, y, lambda);
  const predictCoded = (x: number[]) =>
    basis.build(x).reduce((s, v, i) => s + v * beta[i]!, 0);
  const fitted = codedX.map(predictCoded);
  const m = metrics(y, fitted, Math.min(basis.terms.length, y.length));
  return {
    coefficients: beta,
    terms: basis.terms,
    ...m,
    predict: predictCoded,
    fitted,
    actual: y,
  };
}

/** Multiple linear regression on coded factors (main effects only, OLS). */
export function fitMLR(names: string[], codedX: number[][], y: number[]): Fit {
  const lambda = codedX.length > names.length + 1 ? 0 : 1e-3;
  return fitBasis(linearTerms(names), codedX, y, lambda);
}

/**
 * RSM second-order model. With few runs the quadratic basis is wider than the
 * design, so a small ridge penalty keeps the solution stable.
 */
export function fitRSM(names: string[], codedX: number[][], y: number[]): Fit {
  const p = quadraticTerms(names).terms.length;
  const lambda = codedX.length > p + 2 ? 1e-6 : 0.35;
  return fitBasis(quadraticTerms(names), codedX, y, lambda);
}

/* ------------------------------ random forest ------------------------------ */

type Node =
  | { leaf: true; value: number }
  | { leaf: false; f: number; t: number; l: Node; r: Node };

function buildTree(
  X: number[][],
  y: number[],
  idx: number[],
  depth: number,
  mtry: number,
  rand: () => number,
): Node {
  const mean = idx.reduce((s, i) => s + y[i]!, 0) / idx.length;
  if (depth === 0 || idx.length < 3) return { leaf: true, value: mean };
  const k = X[0]!.length;
  let best: { f: number; t: number; sse: number; l: number[]; r: number[] } | null = null;
  const feats = Array.from({ length: k }, (_, i) => i)
    .sort(() => rand() - 0.5)
    .slice(0, Math.max(1, mtry));
  for (const f of feats) {
    const vals = [...new Set(idx.map((i) => X[i]![f]!))].sort((a, b) => a - b);
    for (let v = 0; v < vals.length - 1; v++) {
      const t = (vals[v]! + vals[v + 1]!) / 2;
      const l = idx.filter((i) => X[i]![f]! <= t);
      const r = idx.filter((i) => X[i]![f]! > t);
      if (!l.length || !r.length) continue;
      const sseOf = (g: number[]) => {
        const m = g.reduce((s, i) => s + y[i]!, 0) / g.length;
        return g.reduce((s, i) => s + (y[i]! - m) ** 2, 0);
      };
      const sse = sseOf(l) + sseOf(r);
      if (!best || sse < best.sse) best = { f, t, sse, l, r };
    }
  }
  if (!best) return { leaf: true, value: mean };
  return {
    leaf: false,
    f: best.f,
    t: best.t,
    l: buildTree(X, y, best.l, depth - 1, mtry, rand),
    r: buildTree(X, y, best.r, depth - 1, mtry, rand),
  };
}

function evalTree(node: Node, x: number[]): number {
  let n = node;
  while (!n.leaf) n = x[n.f]! <= n.t ? n.l : n.r;
  return n.value;
}

export type Forest = {
  predict: (x: number[]) => number;
  oobR2: number;
  rmse: number;
  fitted: number[];
  actual: number[];
  importance: number[];
};

export function fitRandomForest(
  codedX: number[][],
  y: number[],
  seed = 42,
  trees = 200,
): Forest {
  const rand = rng(seed);
  const n = y.length;
  const k = codedX[0]!.length;
  const forest: Node[] = [];
  const oobSum = Array(n).fill(0) as number[];
  const oobCount = Array(n).fill(0) as number[];
  for (let t = 0; t < trees; t++) {
    const bag = Array.from({ length: n }, () => Math.floor(rand() * n));
    const inBag = new Set(bag);
    const tree = buildTree(codedX, y, bag, 4, Math.max(1, Math.round(k / 2)), rand);
    forest.push(tree);
    for (let i = 0; i < n; i++)
      if (!inBag.has(i)) {
        oobSum[i] = oobSum[i]! + evalTree(tree, codedX[i]!);
        oobCount[i] = oobCount[i]! + 1;
      }
  }
  const predict = (x: number[]) =>
    forest.reduce((s, tr) => s + evalTree(tr, x), 0) / forest.length;
  const fitted = codedX.map(predict);
  const mean = y.reduce((a, b) => a + b, 0) / n;
  const sst = y.reduce((a, v) => a + (v - mean) ** 2, 0);
  let oobSse = 0;
  let used = 0;
  for (let i = 0; i < n; i++)
    if (oobCount[i]!) {
      oobSse += (y[i]! - oobSum[i]! / oobCount[i]!) ** 2;
      used++;
    }
  const oobR2 = used > 1 && sst > 1e-12 ? 1 - (oobSse / used) * (n / sst) : 0;
  // permutation importance on the training rows
  const baseSse = y.reduce((a, v, i) => a + (v - fitted[i]!) ** 2, 0);
  const importance = Array.from({ length: k }, (_, f) => {
    const permuted = codedX.map((row, i) => {
      const copy = [...row];
      copy[f] = codedX[(i + 1) % n]![f]!;
      return copy;
    });
    const sse = y.reduce((a, v, i) => a + (v - predict(permuted[i]!)) ** 2, 0);
    return Math.max(0, sse - baseSse);
  });
  const totalImp = importance.reduce((a, b) => a + b, 0) || 1;
  return {
    predict,
    oobR2,
    rmse: Math.sqrt(baseSse / n),
    fitted,
    actual: y,
    importance: importance.map((v) => v / totalImp),
  };
}

/* --------------------------- logistic regression --------------------------- */

export type Classifier = {
  trained: boolean;
  reason?: string;
  accuracy: number;
  predict: (x: number[]) => { p: number; pass: boolean };
};

/** Binary logistic regression trained with gradient descent on coded factors. */
export function fitLogistic(codedX: number[][], labels: number[]): Classifier {
  const pos = labels.filter((l) => l === 1).length;
  const neg = labels.length - pos;
  if (pos < 2 || neg < 2)
    return {
      trained: false,
      reason:
        pos === labels.length
          ? "every measured trial passes this requirement — no failing examples to learn from"
          : neg === labels.length
            ? "every measured trial fails this requirement — no passing examples to learn from"
            : "needs at least 2 passing and 2 failing measured trials",
      accuracy: 0,
      predict: () => ({ p: pos / Math.max(1, labels.length), pass: pos > neg }),
    };
  const k = codedX[0]!.length;
  let w = Array(k + 1).fill(0) as number[];
  const lr = 0.3;
  const z = (x: number[]) => w[0]! + x.reduce((s, v, i) => s + v * w[i + 1]!, 0);
  const sig = (v: number) => 1 / (1 + Math.exp(-v));
  for (let it = 0; it < 4000; it++) {
    const grad = Array(k + 1).fill(0) as number[];
    codedX.forEach((x, i) => {
      const e = sig(z(x)) - labels[i]!;
      grad[0] = grad[0]! + e;
      for (let j = 0; j < k; j++) grad[j + 1] = grad[j + 1]! + e * x[j]!;
    });
    w = w.map((v, j) => v - (lr * grad[j]!) / codedX.length - (j ? 0.001 * v : 0));
  }
  const correct = codedX.filter(
    (x, i) => (sig(z(x)) >= 0.5 ? 1 : 0) === labels[i],
  ).length;
  return {
    trained: true,
    accuracy: correct / labels.length,
    predict: (x) => {
      const p = sig(z(x));
      return { p, pass: p >= 0.5 };
    },
  };
}
