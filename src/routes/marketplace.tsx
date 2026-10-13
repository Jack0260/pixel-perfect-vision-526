import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Badge, Btn, PageHeader, Panel, Spec } from "@/components/system";
import { ORGS, REGIONS } from "@/domain/contracts";
import { intensityAt, type ScheduleMode } from "@/domain/economics";
import type { Region } from "@/domain/types";
import { useGrid } from "@/lib/grid-store";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/marketplace")({
  head: () => pageMeta("Compute marketplace", "Buy and sell GPU and TPU capacity with carbon-aware scheduling constrained by sovereignty contracts."),
  component: MarketPage,
});

const MODES: { id: ScheduleMode; label: string }[] = [
  { id: "carbon", label: "Carbon-aware" },
  { id: "price", label: "Cheapest" },
  { id: "baseline", label: "Home region" },
];
const field = "rounded-md border bg-background px-2 py-1.5 text-sm";

function MarketPage() {
  const { state, setMode, addOffer } = useGrid();
  const [chip, setChip] = useState("L40S");
  const [region, setRegion] = useState<Region>("eu-north");
  const [price, setPrice] = useState("2.2");
  const [seller, setSeller] = useState(ORGS[0]!.id);
  const lastPicks = new Set(state.ledger.filter((l) => l.round === state.round).map((l) => l.offerId));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = Number(price);
    if (!(p > 0)) return;
    void addOffer({ id: `${seller}-${state.offers.length}`, provider: `${seller} (idle capacity)`, region, chip, pricePerHr: p, kw: 0.35, gco2PerKwh: region.startsWith("eu-north") ? 30 : 300, seller });
  };

  return (
    <>
      <PageHeader eyebrow="05 / Compute market" title="Carbon-aware compute" decision="Where should each org's training run this round, inside what its contract allows?">
        {MODES.map((m) => <Btn key={m.id} variant={state.mode === m.id ? "primary" : "outline"} onClick={() => setMode(m.id)}>{m.label}</Btn>)}
      </PageHeader>
      <div className="grid gap-5">
        <Panel title="Order book">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="font-mono text-[11px] uppercase text-muted-foreground"><tr><th className="py-2">Provider</th><th>Region</th><th>Chip</th><th>$/h</th><th>gCO2/kWh now</th><th></th></tr></thead>
              <tbody>
                {state.offers.map((o, i) => (
                  <tr key={o.id} className="border-t">
                    <td className="py-2">{o.provider}</td><td className="font-mono">{o.region}</td><td>{o.chip}</td>
                    <td className="font-mono">{o.pricePerHr.toFixed(2)}</td>
                    <td className="font-mono">{intensityAt(o, state.round + 1, i).toFixed(0)}</td>
                    <td>{lastPicks.has(o.id) && <Badge tone="good">used last round</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Sell idle capacity">
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-5">
            <label className="grid gap-1 text-xs text-muted-foreground">Seller<select className={field} value={seller} onChange={(e) => setSeller(e.target.value)}>{ORGS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
            <label className="grid gap-1 text-xs text-muted-foreground">Chip<input className={field} value={chip} onChange={(e) => setChip(e.target.value)} required /></label>
            <label className="grid gap-1 text-xs text-muted-foreground">Region<select className={field} value={region} onChange={(e) => setRegion(e.target.value as Region)}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></label>
            <label className="grid gap-1 text-xs text-muted-foreground">$/hour<input className={field} type="number" step="0.1" min="0.1" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
            <div className="flex items-end"><Btn type="submit" className="w-full">List offer</Btn></div>
          </form>
        </Panel>
      </div>
      <Spec items={[
        ["Purpose", "Match training jobs to compute offers, minimising cost and carbon within contract regions."],
        ["Users", "Org finance and ops; capacity sellers."],
        ["Inputs", "Offers (price, kW, live grid intensity), allowedComputeRegions."],
        ["Outputs", "One placement per org per round, metered into billing."],
        ["Failure modes", "No eligible offer (org sits out the round), stale intensity data."],
        ["Metrics", "Cost and carbon saved against the home-region baseline."],
        ["Trade-off", "Score = 0.4 normalised price + 0.6 normalised carbon. A simple, explainable weighting beats an opaque optimiser for a regulated buyer."],
      ]} />
    </>
  );
}
