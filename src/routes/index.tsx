import { createFileRoute, Link } from "@tanstack/react-router";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Btn, Loading, PageHeader, Panel, Stat } from "@/components/system";
import { Topology } from "@/components/Topology";
import { totals } from "@/domain/economics";
import { useGrid } from "@/lib/grid-store";
import { pageMeta, pct } from "@/lib/meta";

export const Route = createFileRoute("/")({
  head: () => pageMeta("Federated AI grid", "Three hospitals train one readmission model without sharing a single patient record. Every update is proven, every rule enforced."),
  component: GridPage,
});

function GridPage() {
  const { state, busy, runRound, runRounds } = useGrid();
  const t = totals(state.ledger);
  const last = state.history[state.history.length - 1];
  return (
    <>
      <PageHeader eyebrow="00 / Grid" title="Data never moves. Only gradients do." decision="Is the shared model improving, and is every participant still honest and compliant?">
        <Btn onClick={() => void runRound()} disabled={busy || !state.ready}>Run round</Btn>
        <Btn variant="outline" onClick={() => void runRounds(5)} disabled={busy || !state.ready}>Run 5 rounds</Btn>
      </PageHeader>
      {!state.ready ? <Loading /> : (
        <div className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Global accuracy" value={last ? pct(last.accuracy * 100) : "--"} hint={`Round ${state.round}, held-out sets`} tone="good" />
            <Stat label="Cost saved (X)" value={pct(t.costSavedPct)} hint="vs. home-region default" tone="good" />
            <Stat label="Carbon saved (Y)" value={pct(t.carbonSavedPct)} hint="carbon-aware scheduling" tone="good" />
            <Stat label="Compliance artifacts (Z)" value={String(state.artifacts)} hint="auto-generated evidence" />
          </div>
          <div className="grid gap-5 lg:grid-cols-5">
            <Panel title="Topology / last round" className="lg:col-span-3"><Topology last={last} /></Panel>
            <Panel title="Accuracy by round" className="lg:col-span-2">
              <div className="h-64">
                <ResponsiveContainer>
                  <LineChart data={state.history}>
                    <XAxis dataKey="round" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis domain={[0.4, 1]} stroke="var(--muted-foreground)" fontSize={11} />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
                    <Line type="monotone" dataKey="accuracy" stroke="var(--primary)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {!state.history.length && <p className="text-sm text-muted-foreground">Run a round to start training.</p>}
            </Panel>
          </div>
          <Panel title="Try this">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Run 5 rounds and watch accuracy climb while raw data stays put.</li>
              <li>On <Link to="/federation" className="text-primary underline">Federated runtime</Link>, make one org send a poisoned update. The <Link to="/proofs" className="text-primary underline">proof layer</Link> rejects it.</li>
              <li>In <Link to="/governance" className="text-primary underline">Governance</Link>, remove eu-north from a contract. Once approved, that org is blocked from exporting.</li>
            </ol>
          </Panel>
        </div>
      )}
    </>
  );
}
