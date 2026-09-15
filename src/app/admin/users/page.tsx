"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, Download, Upload, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useRealtimeProfiles } from "@/hooks/useRealtimeProfiles";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toFriendlyMessage } from "@/lib/utils/errors";
import { parseCsv, toCsv } from "@/lib/utils/csv";

const CSV_HEADERS = ["email", "seniority_order"] as const;

export default function AdminUsersPage() {
  const { profiles, loading } = useRealtimeProfiles();
  const { push } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [importing, setImporting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedByUser, setSelectedByUser] = useState<Set<string>>(new Set());
  const [sortBySeniority, setSortBySeniority] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase
      .from("selections")
      .select("user_id")
      .eq("status", "confirmed")
      .then(({ data }) => setSelectedByUser(new Set((data ?? []).map((r) => r.user_id))));
  }, [profiles.length]);

  const participants = useMemo(() => profiles.filter((p) => p.role === "user"), [profiles]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter(
      (p) =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q),
    );
  }, [participants, debouncedQuery]);

  const sorted = useMemo(() => {
    if (!sortBySeniority) return filtered;
    return filtered
      .slice()
      .sort((a, b) => (a.seniority_order ?? Infinity) - (b.seniority_order ?? Infinity));
  }, [filtered, sortBySeniority]);

  async function handleSeniorityChange(profileId: string, userId: string, value: string) {
    const trimmed = value.trim();
    const seniority = trimmed === "" ? null : Number(trimmed);
    if (trimmed !== "" && (!Number.isInteger(seniority) || (seniority as number) < 1)) {
      push("ลำดับอาวุโสต้องเป็นจำนวนเต็มบวก", "error");
      return;
    }
    setSavingId(profileId);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("profiles").update({ seniority_order: seniority }).eq("id", profileId);
    setSavingId(null);
    if (error) {
      push(toFriendlyMessage(error), "error");
      return;
    }
    void userId;
    push("บันทึกลำดับอาวุโสแล้ว", "success");
  }

  function handleExport() {
    const rows = participants
      .slice()
      .sort((a, b) => (a.seniority_order ?? 9999) - (b.seniority_order ?? 9999))
      .map((p) => [p.email, p.seniority_order ?? ""]);
    const csv = toCsv(CSV_HEADERS, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `seniority-${new Date().toISOString().slice(0, 10)}.csv`;
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
    const emailCol = colIndex("email");
    const seniorityCol = colIndex("seniority_order");

    if (emailCol === -1 || seniorityCol === -1) {
      setImporting(false);
      push("ไฟล์ CSV ต้องมีคอลัมน์ email และ seniority_order", "error");
      return;
    }

    const byEmail = new Map(participants.map((p) => [p.email.toLowerCase(), p]));
    const supabase = getSupabaseBrowserClient();
    let updated = 0;
    const notFound: string[] = [];

    for (const row of dataRows) {
      const email = row[emailCol]?.trim();
      const seniorityRaw = row[seniorityCol]?.trim();
      if (!email || !seniorityRaw) continue;
      const match = byEmail.get(email.toLowerCase());
      if (!match) {
        notFound.push(email);
        continue;
      }
      const seniority = Number(seniorityRaw);
      if (!Number.isInteger(seniority) || seniority < 1) continue;
      const { error } = await supabase
        .from("profiles")
        .update({ seniority_order: seniority })
        .eq("id", match.id);
      if (!error) updated++;
    }

    setImporting(false);
    push(
      `อัปเดตลำดับอาวุโสสำเร็จ ${updated} รายการ${notFound.length > 0 ? ` (ไม่พบผู้ใช้ ${notFound.length} อีเมล — ต้องลงทะเบียนก่อน)` : ""}`,
      notFound.length > 0 ? "info" : "success",
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">USERS & SENIORITY</h1>
          <p className="mt-1 text-sm text-muted">
            จัดการลำดับอาวุโส (ลำดับอาวุโส) ของผู้ใช้ที่ลงทะเบียนแล้ว ใช้สำหรับโหมดคิวอาวุโสใน System Control
          </p>
        </div>
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
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input placeholder="ค้นหาชื่อ หรืออีเมล..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10" />
        </div>
        <Button
          variant={sortBySeniority ? "primary" : "outline"}
          size="sm"
          onClick={() => setSortBySeniority((v) => !v)}
        >
          <ArrowDownUp className="h-3.5 w-3.5" />
          เรียงตามลำดับอาวุโส
        </Button>
      </div>

      <Card className="px-6 py-4">
        {loading ? (
          <div className="flex flex-col gap-3 py-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-6 animate-pulse rounded bg-surface-2" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <p className="py-14 text-center text-sm text-muted">ไม่พบผู้ใช้</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-widest text-muted">
                  <th className="py-3 pr-4 font-semibold">Name</th>
                  <th className="py-3 pr-4 font-semibold">Email</th>
                  <th className="py-3 pr-4 font-semibold">Seniority Order</th>
                  <th className="py-3 pr-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-2/50">
                    <td className="py-3 pr-4">
                      {p.first_name} {p.last_name}
                    </td>
                    <td className="py-3 pr-4 text-muted">{p.email}</td>
                    <td className="py-3 pr-4">
                      <input
                        type="number"
                        min={1}
                        defaultValue={p.seniority_order ?? ""}
                        disabled={savingId === p.id}
                        onBlur={(e) => handleSeniorityChange(p.id, p.user_id, e.target.value)}
                        className="h-9 w-24 rounded-md border border-border bg-surface px-2.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                      />
                    </td>
                    <td className="py-3 pr-4">
                      {selectedByUser.has(p.user_id) ? (
                        <span className="text-status-available">เลือกแล้ว</span>
                      ) : (
                        <span className="text-muted">ยังไม่เลือก</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
