import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Variant = "violet" | "emerald" | "amber" | "rose" | "slate";

const VARIANT_STYLES: Record<Variant, { border: string; wash: string; badge: string; glow: string }> = {
  violet: {
    border: "border-accent/50",
    wash: "from-accent/30 via-accent/5 to-transparent",
    badge: "bg-accent text-white shadow-[0_0_16px_rgba(139,92,246,0.7)]",
    glow: "shadow-[0_0_28px_-6px_rgba(139,92,246,0.55)]",
  },
  emerald: {
    border: "border-emerald-400/50",
    wash: "from-emerald-500/30 via-emerald-500/5 to-transparent",
    badge: "bg-emerald-500 text-white shadow-[0_0_16px_rgba(16,185,129,0.7)]",
    glow: "shadow-[0_0_28px_-6px_rgba(16,185,129,0.55)]",
  },
  amber: {
    border: "border-amber-400/50",
    wash: "from-amber-500/30 via-amber-500/5 to-transparent",
    badge: "bg-amber-500 text-white shadow-[0_0_16px_rgba(245,158,11,0.7)]",
    glow: "shadow-[0_0_28px_-6px_rgba(245,158,11,0.55)]",
  },
  rose: {
    border: "border-rose-400/50",
    wash: "from-rose-500/30 via-rose-500/5 to-transparent",
    badge: "bg-rose-500 text-white shadow-[0_0_16px_rgba(244,63,94,0.7)]",
    glow: "shadow-[0_0_28px_-6px_rgba(244,63,94,0.55)]",
  },
  slate: {
    border: "border-slate-400/40",
    wash: "from-slate-500/25 via-slate-500/5 to-transparent",
    badge: "bg-slate-500 text-white shadow-[0_0_16px_rgba(100,116,139,0.6)]",
    glow: "shadow-[0_0_28px_-6px_rgba(100,116,139,0.4)]",
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
        "relative flex items-center gap-4 overflow-hidden rounded-xl border bg-gradient-to-br p-5 transition-shadow",
        styles.border,
        styles.wash,
        styles.glow,
      )}
    >
      <Sparkles className="pointer-events-none absolute right-3 top-3 h-3.5 w-3.5 text-white/25" />
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
