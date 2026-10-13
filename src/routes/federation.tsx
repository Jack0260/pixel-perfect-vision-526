import { createFileRoute } from "@tanstack/react-router";
import { Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Btn, Loading, PageHeader, Panel, Spec } from "@/components/system";
import { ORGS } from "@/domain/contracts";
import { CLIP_NORM, EPOCHS, LR, useGrid } from "@/lib/grid-store";
import { pageMeta, pct } from "@/lib/meta";

export const Route = createFileRoute("/federation")({
  head: () => pageMeta("Federated runtime", "Round-by-round FedAvg across three organisations with clipped, differentially private updates."),
  component: FederationPage,
});

const COLORS = ["var(--primary)", "var(--warning)", "var(--destructive)"];

function FederationPage() {
  const { state, busy, runRound, setMalicious } = useGrid();
  const rows = state.history.map((h) => ({ round: h.round, ...h.perOrg }));
  return (
    <>
      <PageHeader eyebrow="01 / Federated runtime" title="Federated training rounds" decision="Should we keep training, or has the model converged? Is any participant dragging it down?">
        <Btn onClick={() => void runRound()} disabled={busy || !state.ready}>Run round</Btn>
      </PageHeader>
      {!state.ready ? <Loading /> : (
        <div className="grid gap-5">
          <Panel title="Fault injection">
            <p className="mb-3 text-sm text-muted-foreground">Make one org submit an 8x scaled (poisoned) update next round.</p>
            <div className="flex flex-wrap gap-2">
              <Btn variant={state.maliciousOrg === null ? "primary" : "outline"} onClick={() => setMalicious(null)}>All honest</Btn>
              {ORGS.map((o) => (
                <Btn key={o.id} variant={state.maliciousOrg === o.id ? "danger" : "outline"} onClick={() => setMalicious(o.id)}>{o.name}</Btn>
              ))}
            </div>
          </Panel>
          <Panel title="Per-org held-out accuracy">
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={rows}>
                  <XAxis dataKey="round" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis domain={[0.4, 1]} stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
                  <Legend />
                  {ORGS.map((o, i) => <Line key={o.id} dataKey={o.id} name={o.name} stroke={COLORS[i]} strokeWidth={2} dot={false} />)}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="Round log">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="font-mono text-[11px] uppercase text-muted-foreground"><tr><th className="py-2">Round</th><th>Accuracy</th><th>Loss</th><th>Accepted</th><th>Rejected</th><th>Blocked</th><th>Aggregated</th></tr></thead>
                <tbody>
                  {[...state.history].reverse().map((h) => (
                    <tr key={h.round} className="border-t">
                      <td className="py-2 font-mono">{h.round}</td>
                      <td>{pct(h.accuracy * 100)}</td>
                      <td className="font-mono">{h.loss.toFixed(3)}</td>
                      <td>{h.accepted.length}</td>
                      <td>{h.rejected.length ? <Badge tone="bad">{h.rejected.length}</Badge> : 0}</td>
                      <td>{h.blocked.length ? <Badge tone="warn">{h.blocked.length}</Badge> : 0}</td>
                      <td>{h.aggregated ? <Badge tone="good">yes</Badge> : <Badge tone="bad">withheld</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!state.history.length && <p className="py-4 text-sm text-muted-foreground">No rounds yet.</p>}
            </div>
          </Panel>
          <Spec items={[
            ["Purpose", "Train one logistic-regression readmission model across orgs via FedAvg."],
            ["Users", "ML leads at each participating org; platform operator."],
            ["Inputs", `Global weights; local data (never exported). ${EPOCHS} epochs, lr ${LR}, clip ${CLIP_NORM}, Gaussian DP noise scaled by 1/epsilon.`],
            ["Outputs", "Sample-weighted global model, per-org accuracy, round summary."],
            ["Failure modes", "Non-IID drift, poisoned updates (caught by the proof layer), quorum not met (aggregation withheld)."],
            ["Metrics", "Held-out accuracy, log loss, acceptance rate per round."],
          ]} />
        </div>
      )}
    </>
  );
}
