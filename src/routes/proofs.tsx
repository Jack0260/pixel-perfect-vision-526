import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Badge, Btn, Hash, Loading, PageHeader, Panel, Spec } from "@/components/system";
import { orgById } from "@/domain/contracts";
import { verifyProof } from "@/domain/crypto";
import type { ProofCheck } from "@/domain/types";
import { NORM_BOUND, useGrid } from "@/lib/grid-store";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/proofs")({
  head: () => pageMeta("Proof layer", "Hash-commitment proofs that each organisation trained honestly, verified before aggregation."),
  component: ProofsPage,
});

function ProofsPage() {
  const { state } = useGrid();
  const [tamper, setTamper] = useState<ProofCheck[] | null>(null);
  const latest = [...state.proofs].reverse();

  const simulateTamper = async () => {
    const p = latest.find((x) => x.accepted);
    if (!p) return;
    const pre = state.models.find((m) => m.round === p.round - 1)?.weights ?? state.global;
    const forged = state.global.map((v) => v + 0.05);
    setTamper(await verifyProof({ ...p, deltaNorm: p.deltaNorm }, pre, forged, NORM_BOUND));
  };

  return (
    <>
      <PageHeader eyebrow="03 / Proof layer" title="Proof of honest training" decision="Should this org's update be accepted into the global model?">
        <Btn variant="danger" onClick={() => void simulateTamper()} disabled={!latest.some((p) => p.accepted)}>Submit forged weights</Btn>
      </PageHeader>
      {!state.ready ? <Loading /> : (
        <div className="grid gap-5">
          {tamper && (
            <Panel title="Forgery attempt: verifier output" aside={<Badge tone="bad">rejected</Badge>}>
              <Checks checks={tamper} />
            </Panel>
          )}
          <Panel title={`Proofs (${state.proofs.length})`}>
            {!latest.length && <p className="text-sm text-muted-foreground">Run a round to generate proofs.</p>}
            <div className="grid gap-3 md:grid-cols-2">
              {latest.slice(0, 12).map((p) => (
                <div key={`${p.orgId}-${p.round}`} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{orgById(p.orgId)?.name} / round {p.round}</p>
                    <Badge tone={p.accepted ? "good" : "bad"}>{p.accepted ? "accepted" : "rejected"}</Badge>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">commit <Hash value={p.commitment} /> / norm {p.deltaNorm.toFixed(3)}</p>
                  <div className="mt-2"><Checks checks={p.checks} /></div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
      <Spec items={[
        ["Purpose", "Bind each update to its data root, starting model, enclave quote and update norm."],
        ["Users", "Aggregator (verifier), auditors."],
        ["Inputs", "Pre/post weight hashes, data Merkle root, nonce, quote."],
        ["Outputs", "SHA-256 commitment and six verifier checks."],
        ["Failure modes", "Forged weights, stale base model, poisoned (oversized) update, fake quote."],
        ["Metrics", "Acceptance rate, rejections by reason."],
        ["Trade-off", "This is a hash commitment with a bound check, not zero-knowledge. Real ZK (zkSNARK over SGD) costs 1000x+ more compute; commitments give tamper evidence today."],
      ]} />
    </>
  );
}

function Checks({ checks }: { checks: ProofCheck[] }) {
  return (
    <ul className="space-y-1">
      {checks.map((c) => (
        <li key={c.name} className="flex items-center gap-2 text-xs">
          <span className={c.ok ? "text-primary" : "text-destructive"} aria-hidden>{c.ok ? "PASS" : "FAIL"}</span>
          <span className="text-muted-foreground">{c.name}</span>
        </li>
      ))}
    </ul>
  );
}
