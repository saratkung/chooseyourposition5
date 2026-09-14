import { cn } from "@/lib/utils/cn";
import type { SystemStatus } from "@/types/database";

const CONFIG: Record<SystemStatus, { label: string; dot: string; text: string }> = {
  waiting: { label: "WAITING", dot: "bg-status-selecting", text: "text-status-selecting" },
  live: { label: "LIVE", dot: "bg-status-available", text: "text-status-available" },
  paused: { label: "PAUSED", dot: "bg-status-taken", text: "text-status-taken" },
  finished: { label: "FINISHED", dot: "bg-status-disabled", text: "text-status-disabled" },
};

export function SystemStatusPill({ status, className }: { status: SystemStatus; className?: string }) {
  const cfg = CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-bold tracking-widest",
        cfg.text,
        className,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full animate-pulse-dot", cfg.dot)} />
      {cfg.label}
    </span>
  );
}
