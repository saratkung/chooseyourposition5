"use client";

import { useMemo, useRef, useState } from "react";
import { Plus, Download, Upload } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { PositionFilters, type PositionFilterState } from "@/components/positions/PositionFilters";
import { PositionForm } from "@/components/admin/PositionForm";
import { PositionTable } from "@/components/admin/PositionTable";
import { useRealtimePositions } from "@/hooks/useRealtimePositions";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toFriendlyMessage } from "@/lib/utils/errors";
import { parseCsv, toCsv } from "@/lib/utils/csv";
import { CSV_HEADERS, positionSchema, type PositionInput } from "@/lib/validation/position";
import type { PositionRow, PositionStatus } from "@/types/database";

export default function AdminPositionsPage() {
  const { positions, loading } = useRealtimePositions();
  const { push } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filters, setFilters] = useState<PositionFilterState>({
    query: "",
    department: "all",
    division: "all",
    status: "all",
  });
  const debouncedQuery = useDebouncedValue(filters.query, 250);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PositionRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const departments = useMemo(() => Array.from(new Set(positions.map((p) => p.department))).sort(), [positions]);
  const divisions = useMemo(() => Array.from(new Set(positions.map((p) => p.division))).sort(), [positions]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return positions.filter((p) => {
      if (filters.department !== "all" && p.department !== filters.department) return false;
      if (filters.division !== "all" && p.division !== filters.division) return false;
      if (filters.status !== "all" && p.status !== filters.status) return false;
      if (!q) return true;
      return p.position_code.toLowerCase().includes(q) || p.department.toLowerCase().includes(q);
    });
  }, [positions, filters, debouncedQuery]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(position: PositionRow) {
    setEditing(position);
    setFormOpen(true);
  }

  async function handleSubmit(input: PositionInput) {
    setSaving(true);
    const supabase = getSupabaseBrowserClient();
    const payload = {
      position_code: input.positionCode,
      department: input.department,
      division: input.division,
      location: input.location,
      description: input.description || null,
      capacity: input.capacity,
      status: input.status,
    };

    const { error } = editing
      ? await supabase.from("positions").update(payload).eq("id", editing.id)
      : await supabase.from("positions").insert(payload);

    setSaving(false);
    if (error) {
      push(toFriendlyMessage(error), "error");
      return;
    }
    push(editing ? "อัปเดตตำแหน่งแล้ว" : "เพิ่มตำแหน่งแล้ว", "success");
    setFormOpen(false);
  }

  async function handleToggleDisabled(position: PositionRow) {
    const nextStatus: PositionStatus = position.status === "disabled" ? "available" : "disabled";
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("positions").update({ status: nextStatus }).eq("id", position.id);
    if (error) {
      push(toFriendlyMessage(error), "error");
      return;
    }
    push(nextStatus === "disabled" ? "ปิดใช้งานตำแหน่งแล้ว" : "เปิดใช้งานตำแหน่งแล้ว", "success");
  }

  async function handleDelete(position: PositionRow) {
    if (!window.confirm(`ยืนยันการลบตำแหน่ง ${position.position_code}?`)) return;
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("positions").delete().eq("id", position.id);
    if (error) {
      push(toFriendlyMessage(error), "error");
      return;
    }
    push("ลบตำแหน่งแล้ว", "success");
  }

  function handleExport() {
    const rows = positions.map((p) => [
      p.position_code,
      p.department,
      p.division,
      p.location,
      p.description ?? "",
      p.capacity,
      p.status,
    ]);
    const csv = toCsv(CSV_HEADERS, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `positions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      setImporting(false);
      push("ไฟล์ CSV ว่างเปล่า", "error");
      return;
    }

    const [header, ...dataRows] = rows;
    const colIndex = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);

    const parsed: Pick<
      PositionRow,
      "position_code" | "department" | "division" | "location" | "description" | "capacity" | "status"
    >[] = [];
    const errors: string[] = [];

    dataRows.forEach((row, i) => {
      const candidate = {
        positionCode: row[colIndex("position_code")]?.trim() ?? "",
        department: row[colIndex("department")]?.trim() ?? "",
        division: row[colIndex("division")]?.trim() ?? "",
        location: row[colIndex("location")]?.trim() ?? "",
        description: row[colIndex("description")]?.trim() ?? "",
        capacity: Number(row[colIndex("capacity")] ?? 1) || 1,
        status: (row[colIndex("status")]?.trim() || "available") as PositionInput["status"],
      };
      const result = positionSchema.safeParse(candidate);
      if (!result.success) {
        errors.push(`แถวที่ ${i + 2}: ${result.error.issues[0]?.message}`);
        return;
      }
      parsed.push({
        position_code: result.data.positionCode,
        department: result.data.department,
        division: result.data.division,
        location: result.data.location,
        description: result.data.description || "",
        capacity: result.data.capacity,
        status: result.data.status,
      });
    });

    if (parsed.length > 0) {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("positions").upsert(parsed, { onConflict: "position_code" });
      if (error) {
        setImporting(false);
        push(toFriendlyMessage(error), "error");
        return;
      }
    }

    setImporting(false);
    push(
      `นำเข้าสำเร็จ ${parsed.length} รายการ${errors.length > 0 ? ` (ข้าม ${errors.length} แถวที่ไม่ถูกต้อง)` : ""}`,
      errors.length > 0 ? "info" : "success",
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">POSITION MANAGEMENT</h1>
        <div className="flex flex-wrap gap-2">
          <input ref={fileInputRef} type="file" accept=".csv" hidden onChange={handleImportFile} />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} loading={importing}>
            <Upload className="h-3.5 w-3.5" />
            IMPORT CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" />
            EXPORT CSV
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            ADD POSITION
          </Button>
        </div>
      </div>

      <PositionFilters filters={filters} departments={departments} divisions={divisions} onChange={setFilters} />

      <Card className="px-6 py-4">
        {loading ? (
          <div className="flex flex-col gap-3 py-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-6 animate-pulse rounded bg-surface-2" />
            ))}
          </div>
        ) : (
          <PositionTable
            positions={filtered}
            onEdit={openEdit}
            onToggleDisabled={handleToggleDisabled}
            onDelete={handleDelete}
          />
        )}
      </Card>

      <PositionForm
        open={formOpen}
        editing={editing}
        saving={saving}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
