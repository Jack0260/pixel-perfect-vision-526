import { norm, sub } from "./federation";
import type { AuditEntry, ProofCheck, TrainingProof, Weights } from "./types";

export const ENCLAVE_RUNTIME = "sovereign-enclave-runtime@1.4.2";

export async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const hashWeights = (w: Weights) => sha256(w.map((v) => v.toFixed(8)).join(","));

export async function merkleRoot(leaves: string[]): Promise<string> {
  if (leaves.length === 0) return sha256("empty");
  let level = leaves;
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(await sha256((level[i] ?? "") + (level[i + 1] ?? level[i] ?? "")));
    }
    level = next;
  }
  return level[0] ?? "";
}

/** Mock attestation quote: hash of the measured runtime bound to the org. */
export const enclaveQuote = (orgId: string) => sha256(`${ENCLAVE_RUNTIME}|${orgId}`);

/** Mock signature (keyed hash). Production would use Ed25519 keys held in an HSM. */
export const sign = (key: string, payload: string) => sha256(`${key}::${payload}`);

const commitmentInput = (p: Omit<TrainingProof, "commitment">) =>
  [p.orgId, p.round, p.dataRoot, p.preHash, p.postHash, p.deltaNorm.toFixed(6), p.nonce, p.enclaveQuote].join("|");

export async function generateProof(args: {
  orgId: string;
  round: number;
  dataRoot: string;
  pre: Weights;
  post: Weights;
}): Promise<TrainingProof> {
  const base = {
    orgId: args.orgId,
    round: args.round,
    dataRoot: args.dataRoot,
    preHash: await hashWeights(args.pre),
    postHash: await hashWeights(args.post),
    deltaNorm: norm(sub(args.post, args.pre)),
    nonce: await sha256(`${args.orgId}:${args.round}:nonce`),
    enclaveQuote: await enclaveQuote(args.orgId),
  };
  return { ...base, commitment: await sha256(commitmentInput(base)) };
}

/**
 * Mock "proof of honest training": a hash commitment plus a bounded-update check.
 * This is NOT zero-knowledge; it demonstrates the verifier contract a real ZK system would satisfy.
 */
export async function verifyProof(
  proof: TrainingProof,
  globalBefore: Weights,
  received: Weights,
  bound: number,
): Promise<ProofCheck[]> {
  const { commitment, ...rest } = proof;
  const recomputedNorm = norm(sub(received, globalBefore));
  return [
    { name: "Submitted weights match committed hash", ok: (await hashWeights(received)) === proof.postHash },
    { name: "Training started from current global model", ok: (await hashWeights(globalBefore)) === proof.preHash },
    { name: "Commitment recomputes", ok: (await sha256(commitmentInput(rest))) === commitment },
    { name: "Enclave quote matches measured runtime", ok: (await enclaveQuote(proof.orgId)) === proof.enclaveQuote },
    { name: "Declared update norm is truthful", ok: Math.abs(recomputedNorm - proof.deltaNorm) < 1e-5 },
    { name: `Update norm within bound (${bound})`, ok: recomputedNorm <= bound },
  ];
}

const auditInput = (e: Omit<AuditEntry, "hash">) => [e.prevHash, e.seq, e.ts, e.actor, e.action, e.detail].join("|");

export async function appendAudit(
  log: AuditEntry[],
  entry: { actor: string; action: string; detail: string },
): Promise<AuditEntry[]> {
  const prev = log[log.length - 1];
  const base = {
    seq: (prev?.seq ?? 0) + 1,
    ts: new Date().toISOString(),
    prevHash: prev?.hash ?? "0".repeat(64),
    ...entry,
  };
  return [...log, { ...base, hash: await sha256(auditInput(base)) }];
}

/** Returns the seq of the first broken link, or null when the chain is intact. */
export async function verifyAuditChain(log: AuditEntry[]): Promise<number | null> {
  let prev = "0".repeat(64);
  for (const e of log) {
    const { hash, ...rest } = e;
    if (e.prevHash !== prev || (await sha256(auditInput(rest))) !== hash) return e.seq;
    prev = hash;
  }
  return null;
}
