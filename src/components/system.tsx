import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ eyebrow, title, decision, children }: { eyebrow: string; title: string; decision: string; children?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold md:text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          <span className="font-mono text-xs uppercase tracking-wider text-foreground">Decision: </span>
          {decision}
        </p>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}

export function Panel({ title, children, className, aside }: { title?: string; children: ReactNode; className?: string; aside?: ReactNode | undefined }) {
  return (
    <section className={cn("rounded-lg border bg-card p-5 text-card-foreground", className)}>
      {title && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{title}</h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone = "default" }: { label: string; value: string; hint?: string | undefined; tone?: "default" | "good" | "warn" | "bad" }) {
  const toneCls = { default: "text-foreground", good: "text-primary", warn: "text-warning", bad: "text-destructive" }[tone];
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={cn("mt-2 font-display text-3xl font-semibold tabular-nums", toneCls)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

type Tone = "good" | "bad" | "warn" | "muted";
export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const cls = {
    good: "border-primary/40 bg-primary/10 text-primary",
    bad: "border-destructive/40 bg-destructive/10 text-destructive",
    warn: "border-warning/40 bg-warning/10 text-warning",
    muted: "border-border bg-muted text-muted-foreground",
  }[tone];
  return <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide", cls)}>{children}</span>;
}

type Variant = "primary" | "outline" | "ghost" | "danger";
export function Btn({ variant = "primary", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const cls = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border bg-transparent text-foreground hover:bg-secondary",
    ghost: "bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground",
    danger: "border border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20",
  }[variant];
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 font-mono text-xs font-medium uppercase tracking-wider transition-colors disabled:pointer-events-none disabled:opacity-50",
        cls,
        className,
      )}
    />
  );
}

export const short = (h: string, n = 10) => (h ? `${h.slice(0, n)}...` : "");

export function Hash({ value, n = 10 }: { value: string; n?: number }) {
  return (
    <code className="font-mono text-xs text-muted-foreground" title={value}>
      {short(value, n)}
    </code>
  );
}

export function Json({ value }: { value: unknown }) {
  return <pre className="overflow-auto rounded-md border bg-background p-3 font-mono text-xs leading-relaxed text-muted-foreground">{JSON.stringify(value, null, 2)}</pre>;
}

export function Spec({ items }: { items: [string, string][] }) {
  return (
    <details className="mt-8 rounded-lg border bg-card p-4 text-sm">
      <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Subsystem spec</summary>
      <dl className="mt-4 grid gap-3 md:grid-cols-2">
        {items.map(([k, v]) => (
          <div key={k}>
            <dt className="font-mono text-[11px] uppercase tracking-wider text-primary">{k}</dt>
            <dd className="mt-1 text-muted-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

export function Loading() {
  return <p className="font-mono text-sm text-muted-foreground">Hashing datasets and measuring enclaves...</p>;
}
