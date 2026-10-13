import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Badge, Btn, Hash, Loading, PageHeader, Panel, Spec } from "@/components/system";
import { hashWeights, sign } from "@/domain/crypto";
import { REGISTRY_KEY, useGrid } from "@/lib/grid-store";
import { pageMeta, pct } from "@/lib/meta";

export const Route = createFileRoute("/registry")({
  head: () => pageMeta("Model registry", "Versioned, signed federated models with full lineage back to the proofs that produced them."),
  component: RegistryPage,
});

function RegistryPage() {
  const { state } = useGrid();
  const [verified, setVerified] = useState<Record<string, boolean>>({});

  const verifyAll = async () => {
    const out: Record<string, boolean> = {};
    for (const m of state.models) {
      const wh = await hashWeights(m.weights);
      const sig = await sign(REGISTRY_KEY, `${wh}|${m.parentHash ?? "genesis"}|${m.proofsRoot}`);
      out[m.version] = wh === m.weightsHash && sig === m.signature;
    }
    setVerified(out);
  };

  return (
    <>
      <PageHeader eyebrow="06 / Model registry" title="Signed model lineage" decision="Which model version is safe to promote to inference?">
        <Btn onClick={() => void verifyAll()} disabled={!state.ready}>Verify signatures</Btn>
      </PageHeader>
      {!state.ready ? <Loading /> : (
        <Panel title={`${state.models.length} versions`}>
          <ol className="relative space-y-4 border-l pl-6">
            {[...state.models].reverse().map((m) => (
              <li key={m.version}>
                <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-primary bg-background" aria-hidden />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-lg font-semibold">{m.version}</span>
                  <Badge tone="muted">round {m.round}</Badge>
                  <span className="text-sm text-muted-foreground">accuracy {pct(m.accuracy * 100)}</span>
                  {m.version in verified && <Badge tone={verified[m.version] ? "good" : "bad"}>{verified[m.version] ? "signature valid" : "invalid"}</Badge>}
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  weights <Hash value={m.weightsHash} /> / parent {m.parentHash ? <Hash value={m.parentHash} /> : "genesis"} / proofs root <Hash value={m.proofsRoot} /> / sig <Hash value={m.signature} />
                </p>
                <p className="text-xs text-muted-foreground">Contributors: {m.contributors.join(", ") || "none"}</p>
              </li>
            ))}
          </ol>
        </Panel>
      )}
      <Spec items={[
        ["Purpose", "Content-addressed, signed model versions with parent links (IPFS-style CIDs as SHA-256)."],
        ["Users", "ML ops, inference owners, auditors."],
        ["Inputs", "Aggregated weights, parent hash, Merkle root of accepted proofs."],
        ["Outputs", "Signed version record."],
        ["Failure modes", "Weight tampering or a broken lineage: signature check fails."],
        ["Metrics", "Versions, accuracy per version."],
      ]} />
    </>
  );
}
