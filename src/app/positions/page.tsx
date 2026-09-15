"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { USER_NAV_ITEMS } from "@/components/layout/nav-items";
import { PositionCard } from "@/components/positions/PositionCard";
import { PositionFilters, type PositionFilterState } from "@/components/positions/PositionFilters";
import { ConfirmSelectModal } from "@/components/positions/ConfirmSelectModal";
import { SelectionsFeed } from "@/components/positions/SelectionsFeed";
import { SystemStatusPill } from "@/components/system/SystemStatusPill";
import { StatTile } from "@/components/ui/StatTile";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/supabase/auth-context";
import { useRealtimePositions } from "@/hooks/useRealtimePositions";
import { useRealtimeSystem } from "@/hooks/useRealtimeSystem";
import { useRealtimeSelections } from "@/hooks/useRealtimeSelections";
import { useRealtimeResults } from "@/hooks/useRealtimeResults";
import { usePositionActivityBroadcast } from "@/hooks/usePositionActivityBroadcast";
import { useCurrentTurn } from "@/hooks/useCurrentTurn";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { PositionRow } from "@/types/database";


const PAGE_SIZE = 12;

export default function PositionsPage() {
  return (
    <Suspense fallback={null}>
      <PositionsPageInner />
    </Suspense>
  );
}

function PositionsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const { positions, loading, error } = useRealtimePositions();
  const { settings } = useRealtimeSystem();
  const { selection } = useRealtimeSelections(user?.id);
  const { results, loading: resultsLoading } = useRealtimeResults();
  const { selectingIds, notifySelecting, notifyIdle } = usePositionActivityBroadcast();
  const { turn } = useCurrentTurn(settings);

  const takenResults = useMemo(
    () =>
      results
        .filter((r) => r.status === "taken" && r.selected_at)
        .sort((a, b) => new Date(b.selected_at!).getTime() - new Date(a.selected_at!).getTime()),
    [results],
  );

  const isPreview = profile?.role === "admin" && searchParams.get("preview") === "1";

  const [filters, setFilters] = useState<PositionFilterState>({
    query: "",
    department: "all",
    division: "all",
    status: "all",
  });
  const debouncedQuery = useDebouncedValue(filters.query, 250);
  const [page, setPage] = useState(1);
  const [activePosition, setActivePosition] = useState<PositionRow | null>(null);

  // Already selected (e.g. via another tab) -> bounce to /my-position live.
  // Skipped in preview mode: an admin browsing here has no real selection flow to bounce into.
  useEffect(() => {
    if (selection && !isPreview) router.push("/my-position");
  }, [selection, isPreview, router]);

  function handleFiltersChange(next: PositionFilterState) {
    setFilters(next);
    setPage(1);
  }

  const departments = useMemo(
    () => Array.from(new Set(positions.map((p) => p.department))).sort(),
    [positions],
  );
  const divisions = useMemo(
    () => Array.from(new Set(positions.map((p) => p.division))).sort(),
    [positions],
  );

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return positions.filter((p) => {
      if (filters.department !== "all" && p.department !== filters.department) return false;
      if (filters.division !== "all" && p.division !== filters.division) return false;
      if (filters.status !== "all" && p.status !== filters.status) return false;
      if (!q) return true;
      return (
        p.position_code.toLowerCase().includes(q) ||
        p.department.toLowerCase().includes(q) ||
        p.division.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q)
      );
    });
  }, [positions, filters, debouncedQuery]);

  const stats = useMemo(() => {
    const available = positions.filter((p) => p.status === "available").length;
    const taken = positions.filter((p) => p.status === "taken").length;
    return { available, taken, total: positions.length };
  }, [positions]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const systemLive = settings?.system_status === "live";
  const isSeniorityMode = settings?.selection_mode === "seniority";
  const isMyTurn =
    isPreview ||
    !isSeniorityMode ||
    (profile?.seniority_order != null && profile.seniority_order === settings?.current_turn_seniority_order);

  function openConfirm(position: PositionRow) {
    setActivePosition(position);
    notifySelecting(position.id);
  }

  function closeConfirm() {
    if (activePosition) notifyIdle(activePosition.id);
    setActivePosition(null);
  }

  return (
    <AppShell navItems={USER_NAV_ITEMS} eyebrow="Position Selection">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">POSITION SELECTION</h1>
            <div className="mt-2">
              <SystemStatusPill status={settings?.system_status ?? "live"} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Available" value={stats.available} accent="available" />
            <StatTile label="Taken" value={stats.taken} accent="taken" />
            <StatTile label="Total" value={stats.total} />
          </div>
        </div>

        {isPreview && (
          <div className="flex flex-col gap-3 rounded-lg border border-accent/40 bg-accent-soft px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 font-semibold text-accent">
              <Eye className="h-4 w-4" />
              PREVIEW MODE — มุมมองของผู้ใช้ทั่วไป (การเลือกตำแหน่งเป็นการจำลอง ไม่มีการบันทึกจริง)
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push("/admin")}>
              ออกจากโหมดพรีวิว
            </Button>
          </div>
        )}

        {!isPreview && !systemLive && (
          <div className="rounded-lg border border-status-taken/30 bg-status-taken/10 px-5 py-4 text-sm text-status-taken">
            {settings?.system_status === "paused"
              ? "SYSTEM PAUSED — ขณะนี้ไม่สามารถเลือกตำแหน่งได้ กรุณารอจนกว่าผู้ดูแลระบบจะเปิดใช้งานอีกครั้ง"
              : settings?.system_status === "finished"
                ? "ระบบการเลือกตำแหน่งได้ปิดลงแล้ว"
                : "ระบบยังไม่เปิดให้เลือกตำแหน่ง"}
          </div>
        )}

        {!isPreview && systemLive && isSeniorityMode && (
          <div
            className={
              isMyTurn
                ? "rounded-lg border border-status-available/30 bg-status-available/10 px-5 py-4 text-sm font-semibold text-status-available"
                : "rounded-lg border border-status-selecting/30 bg-status-selecting/10 px-5 py-4 text-sm text-status-selecting"
            }
          >
            {isMyTurn
              ? `ถึงคิวของคุณแล้ว! (ลำดับอาวุโสที่ ${profile?.seniority_order}) กรุณาเลือกตำแหน่ง`
              : turn.active
                ? `กำลังรอคิว — ขณะนี้ถึงคิวของ ${turn.first_name ?? "-"} ${turn.last_name ?? ""} (ลำดับอาวุโสที่ ${turn.seniority_order})`
                : "คิวยังไม่เริ่ม กรุณารอผู้ดูแลระบบเปิดคิวอาวุโส"}
          </div>
        )}

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex flex-1 flex-col gap-6">
            <PositionFilters
              filters={filters}
              departments={departments}
              divisions={divisions}
              onChange={handleFiltersChange}
            />

            {error && <p className="text-sm text-status-taken">{error}</p>}

            {loading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-40 animate-pulse rounded-lg border border-border bg-surface" />
                ))}
              </div>
            ) : pageItems.length === 0 ? (
              <div className="rounded-lg border border-border bg-surface py-16 text-center text-sm text-muted">
                ไม่พบตำแหน่งที่ตรงกับการค้นหา
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pageItems.map((position) => (
                  <PositionCard
                    key={position.id}
                    position={position}
                    isSelectingLive={selectingIds.has(position.id)}
                    disabledReason={
                      !isPreview && !systemLive ? "system_not_live" : !isMyTurn ? "not_your_turn" : null
                    }
                    onSelect={openConfirm}
                  />
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  ก่อนหน้า
                </Button>
                <span className="px-2 text-xs text-muted">
                  หน้า {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  ถัดไป
                </Button>
              </div>
            )}
          </div>

          <div className="w-full shrink-0 lg:w-80">
            <SelectionsFeed results={takenResults} loading={resultsLoading} />
          </div>
        </div>
      </div>

      {activePosition && (
        <ConfirmSelectModal
          key={activePosition.id}
          position={activePosition}
          preview={isPreview}
          onClose={closeConfirm}
        />
      )}
    </AppShell>
  );
}
