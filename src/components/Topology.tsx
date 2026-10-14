import { ORGS } from "@/domain/contracts";
import type { RoundSummary } from "@/domain/types";

const POS = [
  { x: 110, y: 70 },
  { x: 110, y: 250 },
  { x: 590, y: 160 },
];

export function Topology({ last }: { last: RoundSummary | undefined }) {
  const status = (id: string) =>
    !last ? "idle" : last.accepted.includes(id) ? "ok" : last.rejected.includes(id) ? "bad" : last.blocked.includes(id) ? "blocked" : "idle";
  const stroke = { ok: "var(--primary)", bad: "var(--destructive)", blocked: "var(--muted-foreground)", idle: "var(--border)" };
  return (
    <svg viewBox="0 0 700 320" role="img" aria-label="Federation topology: three organisations send gradients to the aggregator" className="h-auto w-full">
      {ORGS.map((o, i) => {
        const p = POS[i]!;
        const s = status(o.id);
        return (
          <g key={o.id}>
            <line x1={p.x} y1={p.y} x2={350} y2={160} stroke={stroke[s]} strokeWidth={2} className={s === "ok" ? "flow-line" : undefined} strokeDasharray={s === "blocked" ? "2 6" : undefined} />
            <rect x={p.x - 95} y={p.y - 34} width={190} height={68} rx={6} fill="var(--card)" stroke={stroke[s]} strokeWidth={1.5} />
            <text x={p.x} y={p.y - 8} textAnchor="middle" fill="var(--foreground)" fontSize={14} fontFamily="var(--font-display)">{o.name}</text>
            <text x={p.x} y={p.y + 12} textAnchor="middle" fill="var(--muted-foreground)" fontSize={11} fontFamily="var(--font-mono)">{o.region} / {o.framework}</text>
            <text x={p.x} y={p.y + 26} textAnchor="middle" fill={stroke[s]} fontSize={10} fontFamily="var(--font-mono)">{s.toUpperCase()}</text>
          </g>
        );
      })}
      <circle cx={350} cy={160} r={48} fill="var(--card)" stroke="var(--primary)" strokeWidth={2} />
      <text x={350} y={156} textAnchor="middle" fill="var(--foreground)" fontSize={13} fontFamily="var(--font-display)">FedAvg</text>
      <text x={350} y={174} textAnchor="middle" fill="var(--muted-foreground)" fontSize={10} fontFamily="var(--font-mono)">eu-north</text>
    </svg>
  );
}
