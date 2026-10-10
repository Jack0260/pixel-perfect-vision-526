import type { LedgerEntry, Offer, Region } from "./types";

export type ScheduleMode = "carbon" | "price" | "baseline";

export const DEFAULT_OFFERS: Offer[] = [
  { id: "fra-h100", provider: "NordGrid", region: "eu-central", chip: "H100", pricePerHr: 3.9, kw: 0.7, gco2PerKwh: 310 },
  { id: "sto-a100", provider: "Boreal Compute", region: "eu-north", chip: "A100", pricePerHr: 2.6, kw: 0.4, gco2PerKwh: 25 },
  { id: "iad-h100", provider: "Atlantic Cloud", region: "us-east", chip: "H100", pricePerHr: 4.2, kw: 0.7, gco2PerKwh: 380 },
  { id: "pdx-a100", provider: "Cascade GPU", region: "us-west", chip: "A100", pricePerHr: 2.9, kw: 0.4, gco2PerKwh: 90 },
  { id: "bom-h100", provider: "Konkan DC", region: "ap-south", chip: "H100", pricePerHr: 3.4, kw: 0.7, gco2PerKwh: 650 },
  { id: "hyd-tpu", provider: "Deccan TPU", region: "ap-south", chip: "TPU v5e", pricePerHr: 1.8, kw: 0.25, gco2PerKwh: 600 },
];

/** Grid carbon intensity varies through the day; modelled as a phase-shifted sine per offer. */
export function intensityAt(offer: Offer, round: number, idx: number) {
  return offer.gco2PerKwh * (1 + 0.3 * Math.sin(round * 0.9 + idx));
}

export const GPU_HOURS_PER_SAMPLE_EPOCH = 1 / 2000;

/** Carbon-aware scheduler: picks a compute offer inside the contract's allowed regions. */
export function scheduleCompute(offers: Offer[], allowed: Region[], home: Region, mode: ScheduleMode, round: number) {
  const eligible = offers.map((o, i) => ({ o, i })).filter(({ o }) => allowed.includes(o.region));
  if (!eligible.length) return null;
  const baseline = eligible
    .filter(({ o }) => o.region === home)
    .sort((a, b) => b.o.pricePerHr - a.o.pricePerHr)[0] ?? eligible[0]!;
  if (mode === "baseline") return { pick: baseline, baseline };
  const maxP = Math.max(...eligible.map(({ o }) => o.pricePerHr));
  const maxC = Math.max(...eligible.map(({ o, i }) => o.kw * intensityAt(o, round, i)));
  const score = ({ o, i }: { o: Offer; i: number }) =>
    mode === "price" ? o.pricePerHr : 0.4 * (o.pricePerHr / maxP) + 0.6 * ((o.kw * intensityAt(o, round, i)) / maxC);
  const pick = [...eligible].sort((a, b) => score(a) - score(b))[0]!;
  return { pick, baseline };
}

export function meter(args: {
  round: number;
  orgId: string;
  samples: number;
  epochs: number;
  pick: { o: Offer; i: number };
  baseline: { o: Offer; i: number };
}): LedgerEntry {
  const hours = args.samples * args.epochs * GPU_HOURS_PER_SAMPLE_EPOCH;
  const carbon = (x: { o: Offer; i: number }) => hours * x.o.kw * intensityAt(x.o, args.round, x.i);
  return {
    round: args.round,
    orgId: args.orgId,
    offerId: args.pick.o.id,
    gpuHours: hours,
    samples: args.samples * args.epochs,
    cost: hours * args.pick.o.pricePerHr,
    baselineCost: hours * args.baseline.o.pricePerHr,
    carbonG: carbon(args.pick),
    baselineCarbonG: carbon(args.baseline),
  };
}

export function totals(ledger: LedgerEntry[]) {
  const t = ledger.reduce(
    (a, e) => ({
      cost: a.cost + e.cost,
      baselineCost: a.baselineCost + e.baselineCost,
      carbonG: a.carbonG + e.carbonG,
      baselineCarbonG: a.baselineCarbonG + e.baselineCarbonG,
      gpuHours: a.gpuHours + e.gpuHours,
      samples: a.samples + e.samples,
    }),
    { cost: 0, baselineCost: 0, carbonG: 0, baselineCarbonG: 0, gpuHours: 0, samples: 0 },
  );
  return {
    ...t,
    costSavedPct: t.baselineCost ? (1 - t.cost / t.baselineCost) * 100 : 0,
    carbonSavedPct: t.baselineCarbonG ? (1 - t.carbonG / t.baselineCarbonG) * 100 : 0,
  };
}
