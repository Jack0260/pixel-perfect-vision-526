import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Badge, Btn, Hash, PageHeader, Panel, Spec } from "@/components/system";
import { ORGS, orgById } from "@/domain/contracts";
import { APPROVER_ROLES, useGrid } from "@/lib/grid-store";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/governance")({
  head: () => pageMeta("Governance", "Contract policy editor with two-person approval and a hash-chained, tamper-evident audit log."),
  component: GovernancePage,
});

function GovernancePage() {
  const { state, proposeContract, approve, reject, checkChain } = useGrid();
  const [orgId, setOrgId] = useState(ORGS[0]!.id);
  const [draft, setDraft] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [chain, setChain] = useState<string | null>(null);

  useEffect(() => {
    setDraft(JSON.stringify(state.contracts[orgId], null, 2));
    setErrors([]);
  }, [orgId, state.contracts]);

  const submit = async () => {
    const errs = await proposeContract(orgId, draft);
    setErrors(errs.length ? errs : ["Submitted for approval"]);
  };

  return (
    <>
      <PageHeader eyebrow="08 / Governance" title="Policy, approvals, audit" decision="Should this contract change take effect, and is the audit trail intact?">
        <Btn variant="outline" onClick={async () => { const bad = await checkChain(); setChain(bad === null ? "Chain intact" : `Broken at entry ${bad}`); }}>Verify audit chain</Btn>
      </PageHeader>
      {chain && <p role="status" className="mb-4 font-mono text-sm text-primary">{chain}</p>}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Policy editor">
          <select aria-label="Organisation" className="mb-3 w-full rounded-md border bg-background px-2 py-1.5 text-sm" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
            {ORGS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <textarea aria-label="Contract JSON" value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false} className="h-80 w-full rounded-md border bg-background p-3 font-mono text-xs" />
          <div className="mt-3 flex items-center gap-3"><Btn onClick={() => void submit()}>Propose change</Btn></div>
          {errors.map((e) => <p key={e} className={e.startsWith("Submitted") ? "mt-2 text-xs text-primary" : "mt-2 text-xs text-destructive"}>{e}</p>)}
        </Panel>
        <Panel title="Approval queue (two-person rule)">
          {!state.pending.length && <p className="text-sm text-muted-foreground">No proposed changes yet. Try removing "eu-north" from allowedAggregatorRegions.</p>}
          <div className="space-y-3">
            {state.pending.map((p) => (
              <div key={p.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{orgById(p.orgId)?.name} to v{p.proposed.version}</span>
                  <Badge tone={p.status === "applied" ? "good" : p.status === "rejected" ? "bad" : "warn"}>{p.status}</Badge>
                </div>
                {p.status === "pending" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {APPROVER_ROLES.map((r) => (
                      <Btn key={r} variant="outline" disabled={p.approvals.includes(r)} onClick={() => void approve(p.id, r)}>{p.approvals.includes(r) ? `${r} approved` : `Approve as ${r}`}</Btn>
                    ))}
                    <Btn variant="danger" onClick={() => void reject(p.id)}>Reject</Btn>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel title={`Audit log (${state.audit.length})`} className="mt-5">
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-card font-mono uppercase text-muted-foreground"><tr><th className="py-2">#</th><th>Actor</th><th>Action</th><th>Detail</th><th>Hash</th></tr></thead>
            <tbody>
              {[...state.audit].reverse().map((e) => (
                <tr key={e.seq} className="border-t align-top">
                  <td className="py-1.5 font-mono">{e.seq}</td><td className="font-mono">{e.actor}</td><td className="font-mono text-primary">{e.action}</td><td className="text-muted-foreground">{e.detail}</td><td><Hash value={e.hash} n={8} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Spec items={[
        ["Purpose", "Change sovereignty rules safely, with full accountability."],
        ["Users", "Data Protection Officer, Platform Operator, auditors."],
        ["Inputs", "Contract JSON edits; approvals."],
        ["Outputs", "Applied contract versions; hash-chained audit entries."],
        ["Failure modes", "Invalid JSON or unsafe rules (rejected by validation), single-actor change (blocked by the two-person rule), log tampering (chain check)."],
        ["Metrics", "Pending changes, time to approve, chain integrity."],
      ]} />
    </>
  );
}
