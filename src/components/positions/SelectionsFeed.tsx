import { Card } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/utils/format";
import type { ResultRow } from "@/types/database";

export function SelectionsFeed({ results, loading }: { results: ResultRow[]; loading: boolean }) {
  return (
    <Card className="flex max-h-[calc(100vh-8rem)] flex-col gap-4 p-5 lg:sticky lg:top-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide">ใครเลือกอะไรไปแล้ว</h2>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-status-available">
          <span className="h-1.5 w-1.5 rounded-full bg-status-available animate-pulse-dot" />
          LIVE
        </span>
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-surface-2" />
          ))
        ) : results.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">ยังไม่มีใครเลือกตำแหน่ง</p>
        ) : (
          results.map((r) => (
            <div key={r.position_id} className="rounded-md border border-border bg-surface-2/50 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-foreground">
                  {r.selected_by_first_name} {r.selected_by_last_name}
                </span>
                {r.selected_by_seniority_order != null && (
                  <span className="shrink-0 text-[10px] text-muted">#{r.selected_by_seniority_order}</span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span className="font-mono font-semibold text-accent">{r.position_code}</span>
                <span className="truncate text-muted">{r.department}</span>
              </div>
              {r.selected_at && (
                <p className="mt-1 text-[10px] text-muted">{formatDateTime(r.selected_at)}</p>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
