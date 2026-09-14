import { cn } from "@/lib/utils/cn";
import type { ActivityLogRow, ProfileRow } from "@/types/database";

const ACTION_LABELS: Record<string, string> = {
  REGISTER: "registered",
  LOGIN: "logged in",
  SELECTION_SUCCESS: "selected",
  SELECTION_FAILED: "failed to select a position",
  ADMIN_UPDATE: "updated the system",
  SYSTEM_STARTED: "opened the system",
  SYSTEM_PAUSED: "paused the system",
  SYSTEM_FINISHED: "finished the system",
};

const ACTION_COLORS: Record<string, string> = {
  SELECTION_SUCCESS: "text-status-available",
  SELECTION_FAILED: "text-status-taken",
  SYSTEM_PAUSED: "text-status-selecting",
  SYSTEM_FINISHED: "text-status-disabled",
};

export function ActivityFeed({
  logs,
  profilesById,
}: {
  logs: ActivityLogRow[];
  profilesById: Map<string, ProfileRow>;
}) {
  if (logs.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">ยังไม่มีกิจกรรม</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {logs.map((log) => {
        const profile = log.user_id ? profilesById.get(log.user_id) : undefined;
        const name = profile ? `${profile.first_name} ${profile.last_name}` : "System";
        const positionCode =
          log.metadata && typeof log.metadata === "object" && "position_code" in log.metadata
            ? String((log.metadata as Record<string, unknown>).position_code)
            : null;

        return (
          <li key={log.id} className="flex items-center gap-4 py-3">
            <span className="w-20 shrink-0 font-mono text-xs text-muted">
              {new Date(log.created_at).toLocaleTimeString("en-GB", { hour12: false })}
            </span>
            <span className="flex-1 text-sm">
              <span className="font-semibold text-foreground">{name}</span>{" "}
              <span className={cn("text-muted", ACTION_COLORS[log.action])}>
                {ACTION_LABELS[log.action] ?? log.action.toLowerCase()}
              </span>{" "}
              {positionCode && <span className="font-mono font-semibold text-foreground">{positionCode}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
