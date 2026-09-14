import { cn } from "@/lib/utils/cn";

type Variant = "violet" | "emerald" | "amber" | "rose" | "slate";

const VARIANT_STYLES: Record<Variant, { border: string; wash: string; badge: string }> = {
  violet: {
    border: "border-accent/30",
    wash: "from-accent/25 via-accent/5 to-transparent",
    badge: "bg-accent text-white",
  },
  emerald: {
    border: "border-emerald-500/30",
    wash: "from-emerald-500/25 via-emerald-500/5 to-transparent",
    badge: "bg-emerald-500 text-white",
  },
  amber: {
    border: "border-amber-500/30",
    wash: "from-amber-500/25 via-amber-500/5 to-transparent",
    badge: "bg-amber-500 text-white",
  },
  rose: {
    border: "border-rose-500/30",
    wash: "from-rose-500/25 via-rose-500/5 to-transparent",
    badge: "bg-rose-500 text-white",
  },
  slate: {
    border: "border-slate-500/25",
    wash: "from-slate-500/20 via-slate-500/5 to-transparent",
    badge: "bg-slate-500 text-white",
  },
};

export function DashboardStatCard({
  label,
  value,
  icon,
  variant = "slate",
  subtext,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  variant?: Variant;
  subtext?: string;
}) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      className={cn(
        "relative flex items-center gap-4 overflow-hidden rounded-xl border bg-gradient-to-br p-5",
        styles.border,
        styles.wash,
      )}
    >
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", styles.badge)}>
        {icon}
      </div>
      <div className="relative z-10 flex flex-col gap-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted">{label}</span>
        <span className="font-mono text-3xl font-bold tabular-nums text-foreground">{value}</span>
        {subtext && <span className="text-xs text-muted">{subtext}</span>}
      </div>
    </div>
  );
}
