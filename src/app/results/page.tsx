"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ADMIN_NAV_ITEMS, USER_NAV_ITEMS } from "@/components/layout/nav-items";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { StatTile } from "@/components/ui/StatTile";
import { PositionStatusBadge } from "@/components/positions/PositionStatusBadge";
import { useAuth } from "@/lib/supabase/auth-context";
import { useRealtimeResults } from "@/hooks/useRealtimeResults";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDateTime } from "@/lib/utils/format";

export default function ResultsPage() {
  const { profile } = useAuth();
  const navItems = profile?.role === "admin" ? ADMIN_NAV_ITEMS : USER_NAV_ITEMS;
  const { results, loading } = useRealtimeResults();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return results;
    return results.filter((r) => {
      const name = `${r.selected_by_first_name ?? ""} ${r.selected_by_last_name ?? ""}`.toLowerCase();
      return (
        r.position_code.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q) ||
        r.division.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q) ||
        name.includes(q)
      );
    });
  }, [results, debouncedQuery]);

  const stats = useMemo(() => {
    const taken = results.filter((r) => r.status === "taken").length;
    return { taken, total: results.length };
  }, [results]);

  return (
    <AppShell navItems={navItems} eyebrow={profile?.role === "admin" ? "Admin Console" : "Position Selection"}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">RESULTS</h1>
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Selected" value={stats.taken} accent="taken" />
            <StatTile label="Total" value={stats.total} />
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            placeholder="ค้นหาตำแหน่ง หรือชื่อผู้เลือก..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Card className="px-6 py-4">
          {loading ? (
            <div className="flex flex-col gap-3 py-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-6 animate-pulse rounded bg-surface-2" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-14 text-center text-sm text-muted">ไม่พบตำแหน่งที่ตรงกับการค้นหา</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-widest text-muted">
                    <th className="py-3 pr-4 font-semibold">Code</th>
                    <th className="py-3 pr-4 font-semibold">Department</th>
                    <th className="py-3 pr-4 font-semibold">Division</th>
                    <th className="py-3 pr-4 font-semibold">Location</th>
                    <th className="py-3 pr-4 font-semibold">Status</th>
                    <th className="py-3 pr-4 font-semibold">Selected By</th>
                    <th className="py-3 pr-4 font-semibold">Selected At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((r) => (
                    <tr key={r.position_id} className="hover:bg-surface-2/50">
                      <td className="py-3 pr-4 font-mono font-semibold">{r.position_code}</td>
                      <td className="py-3 pr-4 text-foreground/90">{r.department}</td>
                      <td className="py-3 pr-4 text-muted">{r.division}</td>
                      <td className="py-3 pr-4 text-muted">{r.location}</td>
                      <td className="py-3 pr-4">
                        <PositionStatusBadge status={r.status} />
                      </td>
                      <td className="py-3 pr-4">
                        {r.selected_by_first_name ? (
                          <span className="text-foreground/90">
                            {r.selected_by_first_name} {r.selected_by_last_name}
                            {r.selected_by_seniority_order != null && (
                              <span className="text-muted"> (ลำดับที่ {r.selected_by_seniority_order})</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-muted">
                        {r.selected_at ? formatDateTime(r.selected_at) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
