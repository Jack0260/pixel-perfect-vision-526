import { createFileRoute } from "@tanstack/react-router";
import { Badge, Hash, Loading, PageHeader, Panel, Spec } from "@/components/system";
import { ORGS } from "@/domain/contracts";
import { ENCLAVE_RUNTIME } from "@/domain/crypto";
import { useGrid } from "@/lib/grid-store";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/enclaves")({
  head: () => pageMeta("Confidential compute", "Per-organisation enclave isolation: what stays inside, what crosses the boundary, and the attestation behind it."),
  component: EnclavesPage,
});

function EnclavesPage() {
  const { state, datasets } = useGrid();
  return (
    <>
      <PageHeader eyebrow="02 / Confidential compute" title="Enclave isolation per org" decision="Can we trust that each org's training ran inside the approved, measured runtime?" />
      {!state.ready ? <Loading /> : (
        <div className="grid gap-5 lg:grid-cols-3">
          {ORGS.map((o) => {
            const last = [...state.proofs].reverse().find((p) => p.orgId === o.id);
            const ds = datasets[o.id]!;
            return (
              <Panel key={o.id} title={`${o.city} / ${o.region}`} aside={<Badge tone="good">attested</Badge>}>
                <h3 className="text-lg font-semibold">{o.name}</h3>
                <div className="mt-4 rounded-md border border-dashed p-3">
                  <p className="font-mono text-[11px] uppercase text-muted-foreground">Inside the enclave (never leaves)</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>{ds.train.length + ds.test.length} patient records</li>
                    <li>Raw features and labels</li>
                    <li>Local optimiser state</li>
                  </ul>
                </div>
                <div className="mt-3 rounded-md border border-primary/40 p-3">
                  <p className="font-mono text-[11px] uppercase text-primary">Crosses the boundary</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>Clipped, noised weight update</li>
                    <li>Commitment <Hash value={last?.commitment ?? ""} /></li>
                    <li>Data Merkle root <Hash value={state.dataRoots[o.id] ?? ""} /></li>
                  </ul>
                </div>
                <dl className="mt-4 space-y-1 font-mono text-xs text-muted-foreground">
                  <div className="flex justify-between"><dt>runtime</dt><dd>{ENCLAVE_RUNTIME}</dd></div>
                  <div className="flex justify-between"><dt>quote</dt><dd><Hash value={state.quotes[o.id] ?? ""} /></dd></div>
                </dl>
              </Panel>
            );
          })}
        </div>
      )}
      <Spec items={[
        ["Purpose", "Show TEE-style isolation (SGX/SEV/Nitro in production) so raw data is never addressable outside the org."],
        ["Users", "Security officers, auditors."],
        ["Inputs", "Measured runtime identity and org id."],
        ["Outputs", "Attestation quote bound into each training proof."],
        ["Failure modes", "Unmeasured or modified runtime: quote mismatch, proof rejected."],
        ["Metrics", "Attested rounds and quote mismatches."],
      ]} />
    </>
  );
}
