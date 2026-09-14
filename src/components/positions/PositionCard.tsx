import { Building2, MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PositionStatusBadge } from "@/components/positions/PositionStatusBadge";
import { cn } from "@/lib/utils/cn";
import type { PositionRow } from "@/types/database";

export function PositionCard({
  position,
  isSelectingLive,
  disabledReason,
  onSelect,
}: {
  position: PositionRow;
  isSelectingLive: boolean;
  disabledReason: string | null;
  onSelect: (position: PositionRow) => void;
}) {
  const effectiveStatus = isSelectingLive && position.status === "available" ? "selecting" : position.status;
  const isTaken = position.status === "taken";
  const canSelect = position.status === "available" && !isSelectingLive && !disabledReason;

  return (
    <Card
      className={cn(
        "group flex flex-col gap-4 p-5 transition-colors",
        canSelect ? "hover:border-accent/50" : "opacity-90",
      )}
    >
      <div className="flex items-start justify-between">
        <span className="font-mono text-2xl font-bold tracking-wide text-foreground">
          {position.position_code}
        </span>
        <PositionStatusBadge status={effectiveStatus} pulse={effectiveStatus === "selecting"} />
      </div>

      <div className="flex flex-col gap-1.5 text-sm text-muted">
        <div className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span className="text-foreground/90">{position.department}</span>
          <span className="text-muted">· {position.division}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {position.location}
        </div>
      </div>

      {isTaken ? (
        <div className="rounded-md border border-status-taken/30 bg-status-taken/10 py-2.5 text-center text-xs font-bold tracking-widest text-status-taken">
          POSITION TAKEN
        </div>
      ) : position.status === "disabled" ? (
        <Button size="md" variant="secondary" disabled className="w-full">
          UNAVAILABLE
        </Button>
      ) : (
        <Button
          size="md"
          variant="primary"
          disabled={!canSelect}
          onClick={() => onSelect(position)}
          className="w-full"
        >
          SELECT
        </Button>
      )}
    </Card>
  );
}
