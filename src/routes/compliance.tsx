import { createFileRoute } from "@tanstack/react-router";
import { Badge, Btn, PageHeader, Panel, Spec } from "@/components/system";
import { assess } from "@/domain/compliance";
import { ORGS } from "@/domain/contracts";
import { useGrid } from "@/lib/grid-store";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/compliance")({
  head: () => pageMeta("Regulatory bridge", "Automatic GDPR, HIPAA and DPDP control mapping with downloadable evidence packs."),
  component: CompliancePage,
});

function CompliancePage() {
  const { state, recordArtifact } = useGrid();

  const download = async (orgId: string) => {
    const org = ORGS.find((o) => o.id === orgId)!;
    const c = state.contracts[orgId]!;
    const pack = {
      schema: "sovereign.evidence/v1",
      generatedAt: new Date().toISOString(),
      org: { id: org.id, name: org.name, region: org.region, framework: org.framework },
      contract: c,
      controls: assess(c, state.audit),
      proofs: state.proofs.filter((p) => p.orgId === orgId).map(({ round, commitment, accepted }) => ({ round, commitment, accepted })),
      auditHead: state.audit[state.audit.length - 1]?.hash,
      disclaimer: "Automated control mapping; not legal advice.",
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${org.id}-${org.framework}-evidence.json`;
    a.click();
    URL.revokeObjectURL(url);
    await recordArtifact(orgId, org.framework);
  };

  return (
    <>
      <PageHeader eyebrow="10 / Regulatory bridge" title="Auto-compliance per region" decision="Can each org show its regulator that it is compliant today, and if not, what has to change?" />
      <div className="grid gap-5 lg:grid-cols-3">
        {ORGS.map((o) => {
          const reqs = assess(state.contracts[o.id]!, state.audit);
          const failing = reqs.filter((r) => !r.pass).length;
          return (
            <Panel key={o.id} title={`${o.framework} / ${o.region}`} aside={<Badge tone={failing ? "bad" : "good"}>{failing ? `${failing} gaps` : "compliant"}</Badge>}>
              <h3 className="text-lg font-semibold">{o.name}</h3>
              <ul className="mt-3 space-y-2">
                {reqs.map((r) => (
                  <li key={r.id} className="text-sm">
                    <div className="flex items-start gap-2">
                      <span className={r.pass ? "font-mono text-xs text-primary" : "font-mono text-xs text-destructive"}>{r.pass ? "PASS" : "GAP"}</span>
                      <div><p>{r.requirement}</p><p className="font-mono text-[11px] text-muted-foreground">{r.citation} / {r.evidence}</p></div>
                    </div>
                  </li>
                ))}
              </ul>
              <Btn variant="outline" className="mt-4 w-full" onClick={() => void download(o.id)}>Download evidence pack</Btn>
            </Panel>
          );
        })}
      </div>
      <Spec items={[
        ["Purpose", "Translate contracts and audit history into regulator-facing controls."],
        ["Users", "DPOs, compliance officers, external auditors."],
        ["Inputs", "Current contract, audit chain, proofs."],
        ["Outputs", "Pass or gap per control; JSON evidence pack (counted in Z)."],
        ["Failure modes", "Rules drift from the law. Mappings are versioned code and need legal review."],
        ["Metrics", "Open gaps, artifacts generated."],
      ]} />
    </>
  );
}
