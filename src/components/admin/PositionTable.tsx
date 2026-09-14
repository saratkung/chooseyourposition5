import { Pencil, Ban, CheckCircle, Trash2 } from "lucide-react";
import { PositionStatusBadge } from "@/components/positions/PositionStatusBadge";
import type { PositionRow } from "@/types/database";

export function PositionTable({
  positions,
  onEdit,
  onToggleDisabled,
  onDelete,
}: {
  positions: PositionRow[];
  onEdit: (position: PositionRow) => void;
  onToggleDisabled: (position: PositionRow) => void;
  onDelete: (position: PositionRow) => void;
}) {
  if (positions.length === 0) {
    return <p className="py-14 text-center text-sm text-muted">ไม่พบตำแหน่ง</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-widest text-muted">
            <th className="py-3 pr-4 font-semibold">Code</th>
            <th className="py-3 pr-4 font-semibold">Department</th>
            <th className="py-3 pr-4 font-semibold">Division</th>
            <th className="py-3 pr-4 font-semibold">Location</th>
            <th className="py-3 pr-4 font-semibold">Status</th>
            <th className="py-3 pr-4 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {positions.map((p) => (
            <tr key={p.id} className="hover:bg-surface-2/50">
              <td className="py-3 pr-4 font-mono font-semibold">{p.position_code}</td>
              <td className="py-3 pr-4 text-foreground/90">{p.department}</td>
              <td className="py-3 pr-4 text-muted">{p.division}</td>
              <td className="py-3 pr-4 text-muted">{p.location}</td>
              <td className="py-3 pr-4">
                <PositionStatusBadge status={p.status} />
              </td>
              <td className="py-3 pr-4">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => onEdit(p)}
                    aria-label="Edit"
                    className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onToggleDisabled(p)}
                    aria-label={p.status === "disabled" ? "Enable" : "Disable"}
                    className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
                  >
                    {p.status === "disabled" ? (
                      <CheckCircle className="h-3.5 w-3.5" />
                    ) : (
                      <Ban className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => onDelete(p)}
                    aria-label="Delete"
                    className="rounded p-1.5 text-muted hover:bg-status-taken/10 hover:text-status-taken"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
