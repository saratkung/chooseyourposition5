import { cn } from "@/lib/utils/cn";
import type { PositionStatus } from "@/types/database";

const CONFIG: Record<PositionStatus, { label: string; dot: string; text: string }> = {
  available: { label: "AVAILABLE", dot: "bg-status-available", text: "text-status-available" },
  selecting: { label: "SELECTING", dot: "bg-status-selecting", text: "text-status-selecting" },
  taken: { label: "TAKEN", dot: "bg-status-taken", text: "text-status-taken" },
  disabled: { label: "DISABLED", dot: "bg-status-disabled", text: "text-status-disabled" },
};

export function PositionStatusBadge({
  status,
  pulse = false,
  className,
}: {
  status: PositionStatus;
  pulse?: boolean;
  className?: string;
}) {
  const cfg = CONFIG[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide", cfg.text, className)}>
      <span className={cn("h-2 w-2 rounded-full", cfg.dot, pulse && "animate-pulse-dot")} />
      {cfg.label}
    </span>
  );
}
