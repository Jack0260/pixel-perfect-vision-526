import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Badge, Json, PageHeader, Panel, Spec } from "@/components/system";
import { ARTIFACTS, ORGS, REGIONS, evaluateAction } from "@/domain/contracts";
import type { Artifact, Region } from "@/domain/types";
import { useGrid } from "@/lib/grid-store";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/contracts")({
  head: () => pageMeta("Data contracts", "Machine-readable GDPR, HIPAA and DPDP sovereignty contracts enforced on every export and compute request."),
  component: ContractsPage,
});

const sel = "rounded-md border bg-background px-2 py-1.5 text-sm";

function ContractsPage() {
  const { state } = useGrid();
  const [orgId, setOrgId] = useState(ORGS[0]!.id);
  const [artifact, setArtifact] = useState<Artifact>("gradients");
  const [region, setRegion] = useState<Region>("eu-north");
  const c = state.contracts[orgId]!;
  const exp = evaluateAction(c, { kind: "export", artifact, destRegion: region });
  const comp = evaluateAction(c, { kind: "compute", region });

  return (
    <>
      <PageHeader eyebrow="04 / Data contracts" title="Sovereignty as code" decision="Is this data movement or compute placement legal for this org?" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Policy decision point">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-xs text-muted-foreground">Org
              <select className={sel} value={orgId} onChange={(e) => setOrgId(e.target.value)}>{ORGS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">Artifact
              <select className={sel} value={artifact} onChange={(e) => setArtifact(e.target.value as Artifact)}>{ARTIFACTS.map((a) => <option key={a}>{a}</option>)}</select>
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">Region
              <select className={sel} value={region} onChange={(e) => setRegion(e.target.value as Region)}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select>
            </label>
          </div>
          {[["Export", exp], ["Compute", comp]].map(([label, d]) => {
            const dec = d as typeof exp;
            return (
              <div key={label as string} className="mt-4 rounded-md border p-3">
                <div className="flex items-center justify-between"><span className="text-sm">{label as string} {label === "Export" ? `${artifact} to ${region}` : `in ${region}`}</span><Badge tone={dec.allowed ? "good" : "bad"}>{dec.allowed ? "allow" : "deny"}</Badge></div>
                {dec.reasons.map((r) => <p key={r} className="mt-1 text-xs text-muted-foreground">{r}</p>)}
              </div>
            );
          })}
        </Panel>
        <Panel title={`${c.framework} contract v${c.version}`}><Json value={c} /></Panel>
      </div>
      <Spec items={[
        ["Purpose", "Encode residency, export and privacy rules as versioned JSON (sovereign.contract/v1)."],
        ["Users", "DPOs, legal, platform operator."],
        ["Inputs", "Action requests: export, compute, inference."],
        ["Outputs", "Allow or deny with human-readable reasons; denials are audited."],
        ["Failure modes", "Over-permissive edits (blocked by validation and two-person approval)."],
        ["Metrics", "Denials per round, contract versions."],
      ]} />
    </>
  );
}
