import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader, Panel, Spec, Stat } from "@/components/system";
import { ORGS } from "@/domain/contracts";
import { totals } from "@/domain/economics";
import { useGrid } from "@/lib/grid-store";
import { kg, pageMeta, pct, usd } from "@/lib/meta";

export const Route = createFileRoute("/billing")({
  head: () => pageMeta("Billing and economics", "Per-organisation metering of compute cost, samples processed and carbon emitted."),
  component: BillingPage,
});

function BillingPage() {
  const { state } = useGrid();
  const all = totals(state.ledger);
  const perOrg = ORGS.map((o) => ({ org: o, ...totals(state.ledger.filter((l) => l.orgId === o.id)) }));
  const chart = perOrg.map((p) => ({ name: p.org.name, actual: +p.cost.toFixed(2), baseline: +p.baselineCost.toFixed(2) }));
  return (
    <>
      <PageHeader eyebrow="07 / Billing" title="Cost, compute and carbon" decision="Is federated training paying off for each org, and who should be invoiced what?" />
      <div className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Spend" value={usd(all.cost)} hint={`baseline ${usd(all.baselineCost)}`} />
          <Stat label="Cost saved" value={pct(all.costSavedPct)} tone="good" />
          <Stat label="Carbon" value={kg(all.carbonG)} hint={`baseline ${kg(all.baselineCarbonG)}`} />
          <Stat label="Samples processed" value={all.samples.toLocaleString()} hint={`${all.gpuHours.toFixed(1)} GPU-hours`} />
        </div>
        <Panel title="Spend vs home-region baseline">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={chart}>
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
                <Legend />
                <Bar dataKey="baseline" fill="var(--muted-foreground)" />
                <Bar dataKey="actual" fill="var(--primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Invoice lines">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="font-mono text-[11px] uppercase text-muted-foreground"><tr><th className="py-2">Org</th><th>GPU-h</th><th>Samples</th><th>Cost</th><th>Carbon</th><th>Carbon saved</th></tr></thead>
              <tbody>
                {perOrg.map((p) => (
                  <tr key={p.org.id} className="border-t">
                    <td className="py-2">{p.org.name}</td><td className="font-mono">{p.gpuHours.toFixed(1)}</td><td className="font-mono">{p.samples.toLocaleString()}</td>
                    <td className="font-mono">{usd(p.cost)}</td><td className="font-mono">{kg(p.carbonG)}</td><td className="font-mono">{pct(p.carbonSavedPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      <Spec items={[
        ["Purpose", "Meter every training job so costs and carbon are attributable per org."],
        ["Users", "Finance, sustainability reporting."],
        ["Inputs", "Ledger entries from the scheduler (hours, price, kW, intensity)."],
        ["Outputs", "Invoice lines and savings against baseline."],
        ["Failure modes", "Missing ledger rows if a round crashes mid-way (rounds commit atomically)."],
        ["Metrics", "X% cost saved, Y% carbon saved."],
      ]} />
    </>
  );
}
