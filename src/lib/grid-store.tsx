import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AGGREGATOR_REGION, ORGS, defaultContract, evaluateAction, validateContract } from "@/domain/contracts";
import {
  appendAudit,
  enclaveQuote,
  generateProof,
  hashWeights,
  merkleRoot,
  sha256,
  sign,
  verifyAuditChain,
  verifyProof,
} from "@/domain/crypto";
import { DEFAULT_OFFERS, meter, scheduleCompute, type ScheduleMode } from "@/domain/economics";
import {
  add,
  clip,
  evaluate,
  fedAvg,
  gauss,
  localTrain,
  makeDataset,
  mulberry32,
  sub,
  zeroWeights,
  type Dataset,
} from "@/domain/federation";
import type {
  AuditEntry,
  Contract,
  LedgerEntry,
  ModelVersion,
  Offer,
  PendingChange,
  ProofRecord,
  RoundSummary,
  Weights,
} from "@/domain/types";

export const EPOCHS = 5;
export const LR = 0.5;
export const CLIP_NORM = 1.0;
export const NORM_BOUND = 1.25;
export const DP_BASE = 0.04;
export const REGISTRY_KEY = "sovereign-registry-signing-key";
export const APPROVER_ROLES = ["Data Protection Officer", "Platform Operator"] as const;

export interface GridState {
  ready: boolean;
  round: number;
  global: Weights;
  history: RoundSummary[];
  proofs: ProofRecord[];
  audit: AuditEntry[];
  models: ModelVersion[];
  contracts: Record<string, Contract>;
  pending: PendingChange[];
  ledger: LedgerEntry[];
  offers: Offer[];
  mode: ScheduleMode;
  maliciousOrg: string | null;
  dataRoots: Record<string, string>;
  quotes: Record<string, string>;
  artifacts: number;
}

interface GridApi {
  state: GridState;
  busy: boolean;
  datasets: Record<string, Dataset>;
  runRound: () => Promise<void>;
  runRounds: (n: number) => Promise<void>;
  setMode: (m: ScheduleMode) => void;
  setMalicious: (orgId: string | null) => void;
  proposeContract: (orgId: string, json: string) => Promise<string[]>;
  approve: (changeId: string, role: string) => Promise<void>;
  reject: (changeId: string) => Promise<void>;
  addOffer: (o: Offer) => Promise<void>;
  checkChain: () => Promise<number | null>;
  recordArtifact: (orgId: string, framework: string) => Promise<void>;
  log: (actor: string, action: string, detail: string) => Promise<void>;
}

const Ctx = createContext<GridApi | null>(null);

function initialState(): GridState {
  return {
    ready: false,
    round: 0,
    global: zeroWeights(),
    history: [],
    proofs: [],
    audit: [],
    models: [],
    contracts: Object.fromEntries(ORGS.map((o) => [o.id, defaultContract(o)])),
    pending: [],
    ledger: [],
    offers: DEFAULT_OFFERS,
    mode: "carbon",
    maliciousOrg: null,
    dataRoots: {},
    quotes: {},
    artifacts: 0,
  };
}

export function GridProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GridState>(initialState);
  const [busy, setBusy] = useState(false);
  const ref = useRef(state);
  const busyRef = useRef(false);
  const [datasets] = useState(() =>
    Object.fromEntries(ORGS.map((o, i) => [o.id, makeDataset(o, 1009 + i * 7919)])) as Record<string, Dataset>,
  );

  const commit = useCallback((next: GridState) => {
    ref.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const dataRoots: Record<string, string> = {};
      const quotes: Record<string, string> = {};
      for (const o of ORGS) {
        const ds = datasets[o.id]!;
        const leaves = await Promise.all(ds.train.map((r, i) => sha256(`${i}:${r.x.map((v) => v.toFixed(6)).join(",")}:${r.y}`)));
        dataRoots[o.id] = await merkleRoot(leaves);
        quotes[o.id] = await enclaveQuote(o.id);
      }
      const g = zeroWeights();
      const wh = await hashWeights(g);
      const proofsRoot = await merkleRoot([]);
      const genesis: ModelVersion = {
        version: "v0.0",
        round: 0,
        weights: g,
        weightsHash: wh,
        parentHash: null,
        proofsRoot,
        signature: await sign(REGISTRY_KEY, `${wh}|genesis|${proofsRoot}`),
        accuracy: 0.5,
        contributors: [],
        createdAt: new Date().toISOString(),
      };
      let audit: AuditEntry[] = [];
      audit = await appendAudit(audit, { actor: "platform", action: "grid.initialised", detail: `${ORGS.length} orgs enrolled; genesis model ${wh.slice(0, 12)}` });
      for (const o of ORGS) {
        audit = await appendAudit(audit, { actor: o.id, action: "contract.signed", detail: `${o.framework} contract v1; data root ${dataRoots[o.id]!.slice(0, 12)}` });
      }
      if (!cancelled) commit({ ...ref.current, ready: true, dataRoots, quotes, models: [genesis], audit });
    })();
    return () => {
      cancelled = true;
    };
  }, [commit, datasets]);

  const log = useCallback(
    async (actor: string, action: string, detail: string) => {
      commit({ ...ref.current, audit: await appendAudit(ref.current.audit, { actor, action, detail }) });
    },
    [commit],
  );

  const runRound = useCallback(async () => {
    if (busyRef.current || !ref.current.ready) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const s = ref.current;
      const round = s.round + 1;
      let audit = s.audit;
      const note = async (actor: string, action: string, detail: string) => {
        audit = await appendAudit(audit, { actor, action, detail });
      };
      const updates: { orgId: string; weights: Weights; n: number }[] = [];
      const proofs: ProofRecord[] = [];
      const ledger: LedgerEntry[] = [];
      const summary: RoundSummary = { round, accuracy: 0, loss: 0, perOrg: {}, accepted: [], rejected: [], blocked: [], aggregated: false };

      for (const [i, org] of ORGS.entries()) {
        const c = s.contracts[org.id]!;
        const exp = evaluateAction(c, { kind: "export", artifact: "gradients", destRegion: AGGREGATOR_REGION });
        if (!exp.allowed) {
          summary.blocked.push(org.id);
          await note(org.id, "export.denied", exp.reasons.join("; "));
          continue;
        }
        const sched = scheduleCompute(s.offers, c.allowedComputeRegions, org.region, s.mode, round);
        if (!sched) {
          summary.blocked.push(org.id);
          await note(org.id, "compute.unavailable", "no offer inside allowedComputeRegions");
          continue;
        }
        const ds = datasets[org.id]!;
        const trained = localTrain(s.global, ds.train, { epochs: EPOCHS, lr: LR });
        const rng = mulberry32(round * 997 + i * 31);
        let delta = clip(sub(trained, s.global), CLIP_NORM).map((d) => d + gauss(rng) * (DP_BASE / c.dpEpsilon));
        if (s.maliciousOrg === org.id) delta = delta.map((d) => d * 8);
        const post = add(s.global, delta);
        const proof = await generateProof({ orgId: org.id, round, dataRoot: s.dataRoots[org.id]!, pre: s.global, post });
        const checks = await verifyProof(proof, s.global, post, NORM_BOUND);
        const accepted = checks.every((k) => k.ok);
        proofs.push({ ...proof, checks, accepted });
        ledger.push(meter({ round, orgId: org.id, samples: ds.train.length, epochs: EPOCHS, pick: sched.pick, baseline: sched.baseline }));
        await note(org.id, "compute.scheduled", `${sched.pick.o.id} (${sched.pick.o.region}) via ${s.mode} scheduling`);
        if (accepted) {
          summary.accepted.push(org.id);
          updates.push({ orgId: org.id, weights: post, n: ds.train.length });
          await note(org.id, "proof.verified", `commitment ${proof.commitment.slice(0, 12)}; norm ${proof.deltaNorm.toFixed(3)}`);
        } else {
          summary.rejected.push(org.id);
          await note("verifier", "proof.rejected", `${org.id}: ${checks.filter((k) => !k.ok).map((k) => k.name).join("; ")}`);
        }
      }

      const minAgg = Math.max(...updates.map((u) => s.contracts[u.orgId]!.minAggregationSize), 1);
      let global = s.global;
      const models = [...s.models];
      let artifacts = s.artifacts;
      if (updates.length >= minAgg && updates.length > 0) {
        global = fedAvg(updates);
        summary.aggregated = true;
        const parent = models[models.length - 1]!;
        const wh = await hashWeights(global);
        const proofsRoot = await merkleRoot(proofs.filter((p) => p.accepted).map((p) => p.commitment));
        const evals = ORGS.map((o) => evaluate(global, datasets[o.id]!.test).accuracy);
        models.push({
          version: `v0.${round}`,
          round,
          weights: global,
          weightsHash: wh,
          parentHash: parent.weightsHash,
          proofsRoot,
          signature: await sign(REGISTRY_KEY, `${wh}|${parent.weightsHash}|${proofsRoot}`),
          accuracy: evals.reduce((a, b) => a + b, 0) / evals.length,
          contributors: updates.map((u) => u.orgId),
          createdAt: new Date().toISOString(),
        });
        artifacts += updates.length;
        await note("aggregator", "model.registered", `v0.${round} ${wh.slice(0, 12)} from ${updates.length} proofs`);
      } else {
        await note("aggregator", "aggregation.withheld", `${updates.length} verified updates < required ${minAgg}`);
      }

      let lossSum = 0;
      let accSum = 0;
      for (const o of ORGS) {
        const e = evaluate(global, datasets[o.id]!.test);
        summary.perOrg[o.id] = e.accuracy;
        lossSum += e.loss;
        accSum += e.accuracy;
      }
      summary.accuracy = accSum / ORGS.length;
      summary.loss = lossSum / ORGS.length;

      commit({
        ...ref.current,
        round,
        global,
        history: [...s.history, summary],
        proofs: [...s.proofs, ...proofs],
        ledger: [...s.ledger, ...ledger],
        models,
        audit,
        artifacts,
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [commit, datasets]);

  const runRounds = useCallback(
    async (n: number) => {
      for (let i = 0; i < n; i++) await runRound();
    },
    [runRound],
  );

  const setMode = useCallback(
    (mode: ScheduleMode) => {
      commit({ ...ref.current, mode });
      void log("operator", "scheduler.mode", mode);
    },
    [commit, log],
  );

  const setMalicious = useCallback(
    (maliciousOrg: string | null) => {
      commit({ ...ref.current, maliciousOrg });
      void log("operator", "fault.injection", maliciousOrg ? `${maliciousOrg} will submit an 8x poisoned update` : "cleared");
    },
    [commit, log],
  );

  const proposeContract = useCallback(
    async (orgId: string, json: string) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        return ["Invalid JSON"];
      }
      const { contract, errors } = validateContract(parsed, orgId);
      if (!contract) return errors;
      const current = ref.current.contracts[orgId]!;
      const change: PendingChange = {
        id: (await sha256(`${orgId}|${json}|${Date.now()}`)).slice(0, 10),
        orgId,
        proposed: { ...contract, version: current.version + 1 },
        approvals: [],
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      commit({
        ...ref.current,
        pending: [change, ...ref.current.pending],
        audit: await appendAudit(ref.current.audit, { actor: orgId, action: "contract.proposed", detail: `change ${change.id} -> v${change.proposed.version}` }),
      });
      return [];
    },
    [commit],
  );

  const approve = useCallback(
    async (id: string, role: string) => {
      const s = ref.current;
      const ch = s.pending.find((p) => p.id === id);
      if (!ch || ch.status !== "pending" || ch.approvals.includes(role)) return;
      const approvals = [...ch.approvals, role];
      const applied = APPROVER_ROLES.every((r) => approvals.includes(r));
      let audit = await appendAudit(s.audit, { actor: role, action: "contract.approved", detail: `change ${id}` });
      if (applied) audit = await appendAudit(audit, { actor: "policy-engine", action: "contract.applied", detail: `${ch.orgId} now on v${ch.proposed.version}` });
      commit({
        ...s,
        audit,
        pending: s.pending.map((p) => (p.id === id ? { ...p, approvals, status: applied ? "applied" : "pending" } : p)),
        contracts: applied ? { ...s.contracts, [ch.orgId]: ch.proposed } : s.contracts,
      });
    },
    [commit],
  );

  const reject = useCallback(
    async (id: string) => {
      const s = ref.current;
      commit({
        ...s,
        audit: await appendAudit(s.audit, { actor: "governance", action: "contract.rejected", detail: `change ${id}` }),
        pending: s.pending.map((p) => (p.id === id ? { ...p, status: "rejected" } : p)),
      });
    },
    [commit],
  );

  const addOffer = useCallback(
    async (o: Offer) => {
      const s = ref.current;
      commit({
        ...s,
        offers: [...s.offers, o],
        audit: await appendAudit(s.audit, { actor: o.seller ?? "market", action: "offer.listed", detail: `${o.chip} in ${o.region} at $${o.pricePerHr}/h` }),
      });
    },
    [commit],
  );

  const recordArtifact = useCallback(
    async (orgId: string, framework: string) => {
      const s = ref.current;
      commit({
        ...s,
        artifacts: s.artifacts + 1,
        audit: await appendAudit(s.audit, { actor: "regulatory-bridge", action: "artifact.generated", detail: `${framework} evidence pack for ${orgId}` }),
      });
    },
    [commit],
  );

  const checkChain = useCallback(() => verifyAuditChain(ref.current.audit), []);

  return (
    <Ctx.Provider
      value={{ state, busy, datasets, runRound, runRounds, setMode, setMalicious, proposeContract, approve, reject, addOffer, checkChain, recordArtifact, log }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useGrid() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGrid must be used inside GridProvider");
  return v;
}
