import { cn } from "@/lib/utils/cn";

export function StatTile({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: React.ReactNode;
  accent?: "default" | "available" | "taken" | "selecting";
}) {
  const accentClass =
    accent === "available"
      ? "text-status-available"
      : accent === "taken"
        ? "text-status-taken"
        : accent === "selecting"
          ? "text-status-selecting"
          : "text-foreground";

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface px-5 py-4">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted">{label}</span>
      <span className={cn("font-mono text-3xl font-bold tabular-nums", accentClass)}>{value}</span>
    </div>
  );
}
