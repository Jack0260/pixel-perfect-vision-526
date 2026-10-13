import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Badge, Btn, Json, Loading, PageHeader, Panel, Spec } from "@/components/system";
import { ORGS, evaluateAction } from "@/domain/contracts";
import { FEATURES, predict } from "@/domain/federation";
import { useGrid } from "@/lib/grid-store";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/inference")({
  head: () => pageMeta("Edge inference", "Run the federated model on-prem through a versioned inference endpoint, gated by each contract."),
  component: InferencePage,
});

const field = "w-full rounded-md border bg-background px-2 py-1.5 text-sm";

function InferencePage() {
  const { state, log } = useGrid();
  const [orgId, setOrgId] = useState(ORGS[0]!.id);
  const [location, setLocation] = useState<"on-prem" | "cloud">("on-prem");
  const [version, setVersion] = useState<string>("");
  const [x, setX] = useState([0.5, 1, 0, 0.5]);
  const [resp, setResp] = useState<unknown>(null);

  const model = state.models.find((m) => m.version === version) ?? state.models[state.models.length - 1];
  const request = { api: "POST /v1/infer", orgId, location, model: model?.version, features: Object.fromEntries(FEATURES.map((f, i) => [f, x[i]])) };

  const run = async () => {
    if (!model) return;
    const d = evaluateAction(state.contracts[orgId]!, { kind: "inference", location });
    if (!d.allowed) {
      setResp({ status: 403, error: "policy_denied", reasons: d.reasons });
      await log(orgId, "inference.denied", d.reasons.join("; "));
      return;
    }
    const p = predict(model.weights, x);
    setResp({ status: 200, model: model.version, weightsHash: model.weightsHash, readmissionRisk: +p.toFixed(4), band: p > 0.6 ? "high" : p > 0.35 ? "medium" : "low", servedFrom: `${orgId}/${location}` });
    await log(orgId, "inference.served", `${model.version} risk=${p.toFixed(3)} at ${location}`);
  };

  return (
    <>
      <PageHeader eyebrow="09 / Edge inference" title="On-prem inference endpoint" decision="Should this patient be flagged for readmission follow-up, using a model no single hospital could train alone?" />
      {!state.ready ? <Loading /> : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Request">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1 text-xs text-muted-foreground">Org<select className={field} value={orgId} onChange={(e) => setOrgId(e.target.value)}>{ORGS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
              <label className="grid gap-1 text-xs text-muted-foreground">Deploy to<select className={field} value={location} onChange={(e) => setLocation(e.target.value as "on-prem" | "cloud")}><option>on-prem</option><option>cloud</option></select></label>
              <label className="grid gap-1 text-xs text-muted-foreground">Model<select className={field} value={model?.version} onChange={(e) => setVersion(e.target.value)}>{state.models.map((m) => <option key={m.version}>{m.version}</option>)}</select></label>
            </div>
            <div className="mt-4 space-y-3">
              {FEATURES.map((f, i) => (
                <label key={f} className="block text-xs text-muted-foreground">
                  <span className="flex justify-between"><span>{f}</span><span className="font-mono">{x[i]!.toFixed(1)}</span></span>
                  <input type="range" min={-3} max={3} step={0.1} value={x[i]} onChange={(e) => setX(x.map((v, j) => (j === i ? Number(e.target.value) : v)))} className="w-full accent-primary" />
                </label>
              ))}
            </div>
            <Btn className="mt-4" onClick={() => void run()}>Send request</Btn>
          </Panel>
          <Panel title="Wire format" aside={resp ? <Badge tone={(resp as { status: number }).status === 200 ? "good" : "bad"}>{(resp as { status: number }).status}</Badge> : undefined}>
            <Json value={request} />
            {resp !== null && <div className="mt-3"><Json value={resp} /></div>}
          </Panel>
        </div>
      )}
      <Spec items={[
        ["Purpose", "Serve the federated model inside each org's perimeter."],
        ["Users", "Clinicians and care coordinators via hospital systems."],
        ["Inputs", "Four standardised features, model version, deployment target."],
        ["Outputs", "Risk score and band; every call audited."],
        ["Failure modes", "Cloud deployment under an on-prem contract (403), version not promoted."],
        ["Metrics", "Calls, denials, risk distribution."],
      ]} />
    </>
  );
}
