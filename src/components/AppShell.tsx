import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useGrid } from "@/lib/grid-store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Grid", n: "00" },
  { to: "/federation", label: "Federated runtime", n: "01" },
  { to: "/enclaves", label: "Confidential compute", n: "02" },
  { to: "/proofs", label: "Proof layer", n: "03" },
  { to: "/contracts", label: "Data contracts", n: "04" },
  { to: "/marketplace", label: "Compute market", n: "05" },
  { to: "/registry", label: "Model registry", n: "06" },
  { to: "/billing", label: "Billing", n: "07" },
  { to: "/governance", label: "Governance", n: "08" },
  { to: "/inference", label: "Edge inference", n: "09" },
  { to: "/compliance", label: "Regulatory bridge", n: "10" },
] as const;

const THEMES = [
  { id: "console", label: "Console" },
  { id: "paper", label: "Paper" },
  { id: "crypto", label: "Crypto" },
] as const;

function ThemeSwitch() {
  const [theme, setTheme] = useState<string>("console");
  useEffect(() => {
    const saved = localStorage.getItem("sovereign-theme");
    if (saved) setTheme(saved);
  }, []);
  useEffect(() => {
    document.documentElement.dataset["theme"] = theme;
    localStorage.setItem("sovereign-theme", theme);
  }, [theme]);
  return (
    <div role="radiogroup" aria-label="Colour theme" className="grid grid-cols-3 gap-1 rounded-md border p-1">
      {THEMES.map((t) => (
        <button
          key={t.id}
          role="radio"
          aria-checked={theme === t.id}
          onClick={() => setTheme(t.id)}
          className={cn(
            "rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider",
            theme === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { state, busy } = useGrid();
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="border-b bg-sidebar lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col gap-6 p-5">
          <Link to="/" className="block">
            <p className="font-display text-xl font-bold tracking-[0.12em]">SOVEREIGN</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Data stays. Gradients move.</p>
          </Link>
          <nav aria-label="Subsystems" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: true }}
                className="flex shrink-0 items-center gap-3 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                <span className="font-mono text-[10px] text-primary">{n.n}</span>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto hidden space-y-3 lg:block">
            <div className="rounded-md border p-3 font-mono text-[11px] text-muted-foreground">
              <div className="flex justify-between"><span>round</span><span className="text-foreground">{state.round}</span></div>
              <div className="flex justify-between"><span>audit</span><span className="text-foreground">{state.audit.length}</span></div>
              <div className="flex justify-between"><span>status</span><span className={busy ? "text-warning" : "text-primary"}>{busy ? "training" : state.ready ? "idle" : "boot"}</span></div>
            </div>
            <ThemeSwitch />
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-5 py-8 md:px-10">
        <div className="mx-auto max-w-6xl">{children}</div>
        <div className="mx-auto mt-10 max-w-6xl lg:hidden"><ThemeSwitch /></div>
      </main>
    </div>
  );
}
