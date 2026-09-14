"use client";

import { useMemo } from "react";
import { StatTile } from "@/components/ui/StatTile";
import { SystemStatusPill } from "@/components/system/SystemStatusPill";
import { useRealtimePositions } from "@/hooks/useRealtimePositions";
import { useRealtimeProfiles } from "@/hooks/useRealtimeProfiles";
import { useRealtimeSystem } from "@/hooks/useRealtimeSystem";

export default function AdminDashboardPage() {
  const { positions, loading: loadingPositions } = useRealtimePositions();
  const { profiles, loading: loadingProfiles } = useRealtimeProfiles();
  const { settings } = useRealtimeSystem();

  const stats = useMemo(() => {
    const participants = profiles.filter((p) => p.role === "user");
    const available = positions.filter((p) => p.status === "available").length;
    const taken = positions.filter((p) => p.status === "taken").length;
    const disabled = positions.filter((p) => p.status === "disabled").length;
    return {
      totalUsers: participants.length,
      selected: taken, // 1 confirmed selection <-> 1 taken position, enforced by the DB
      notSelected: Math.max(0, participants.length - taken),
      totalPositions: positions.length,
      available,
      taken,
      disabled,
    };
  }, [positions, profiles]);

  const loading = loadingPositions || loadingProfiles;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">ADMIN DASHBOARD</h1>
        <SystemStatusPill status={settings?.system_status ?? "waiting"} />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-surface" />
          ))}
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Users</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <StatTile label="Total Users" value={stats.totalUsers} />
              <StatTile label="Selected" value={stats.selected} accent="available" />
              <StatTile label="Not Selected" value={stats.notSelected} accent="selecting" />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Positions</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatTile label="Total Positions" value={stats.totalPositions} />
              <StatTile label="Available" value={stats.available} accent="available" />
              <StatTile label="Taken" value={stats.taken} accent="taken" />
              <StatTile label="Disabled" value={stats.disabled} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
