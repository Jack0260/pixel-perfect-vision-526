import type { Org, Weights } from "./types";

/** Deterministic PRNG so every demo run is reproducible. */
export function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(rng: () => number) {
  const u = Math.max(rng(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

export const FEATURES = ["Age (z)", "Prior admissions (z)", "Length of stay (z)", "Comorbidity index (z)"];
const TRUE_W = [0.8, 1.2, 0.6, 1.0];
const TRUE_B = -0.3;

export interface Row {
  x: number[];
  y: 0 | 1;
}
export interface Dataset {
  train: Row[];
  test: Row[];
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** Synthetic 30-day readmission data; each org has a shifted (non-IID) population. */
export function makeDataset(org: Org, seed: number): Dataset {
  const rng = mulberry32(seed);
  const rows: Row[] = [];
  for (let i = 0; i < org.samples; i++) {
    const x = TRUE_W.map((_, j) => gauss(rng) + (org.featureShift[j] ?? 0));
    const z = x.reduce((a, v, j) => a + v * (TRUE_W[j] ?? 0), TRUE_B) + gauss(rng) * 0.5;
    rows.push({ x, y: rng() < sigmoid(z) ? 1 : 0 });
  }
  const cut = Math.floor(rows.length * 0.8);
  return { train: rows.slice(0, cut), test: rows.slice(cut) };
}

export const zeroWeights = (): Weights => [0, 0, 0, 0, 0];

export function predict(w: Weights, x: number[]) {
  return sigmoid(x.reduce((a, v, j) => a + v * (w[j] ?? 0), w[4] ?? 0));
}

export function localTrain(w0: Weights, data: Row[], opts: { epochs: number; lr: number }) {
  const w = [...w0];
  for (let e = 0; e < opts.epochs; e++) {
    const g = [0, 0, 0, 0, 0];
    for (const r of data) {
      const err = predict(w, r.x) - r.y;
      for (let j = 0; j < 4; j++) g[j] = (g[j] ?? 0) + err * (r.x[j] ?? 0);
      g[4] = (g[4] ?? 0) + err;
    }
    for (let j = 0; j < 5; j++) w[j] = (w[j] ?? 0) - (opts.lr * (g[j] ?? 0)) / data.length;
  }
  return w;
}

export function evaluate(w: Weights, data: Row[]) {
  let loss = 0;
  let correct = 0;
  for (const r of data) {
    const p = Math.min(Math.max(predict(w, r.x), 1e-7), 1 - 1e-7);
    loss += -(r.y * Math.log(p) + (1 - r.y) * Math.log(1 - p));
    if ((p >= 0.5 ? 1 : 0) === r.y) correct++;
  }
  return { loss: loss / data.length, accuracy: correct / data.length };
}

export const sub = (a: Weights, b: Weights) => a.map((v, i) => v - (b[i] ?? 0));
export const add = (a: Weights, b: Weights) => a.map((v, i) => v + (b[i] ?? 0));
export const norm = (a: Weights) => Math.sqrt(a.reduce((s, v) => s + v * v, 0));

export function clip(delta: Weights, max: number) {
  const n = norm(delta);
  return n > max ? delta.map((v) => (v * max) / n) : delta;
}

/** FedAvg: sample-weighted mean of accepted client models. */
export function fedAvg(updates: { weights: Weights; n: number }[]): Weights {
  const total = updates.reduce((s, u) => s + u.n, 0);
  const out = zeroWeights();
  for (const u of updates) u.weights.forEach((v, i) => (out[i] = (out[i] ?? 0) + (v * u.n) / total));
  return out;
}
