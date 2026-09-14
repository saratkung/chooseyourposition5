"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { ActivityFeed } from "@/components/admin/ActivityFeed";
import { useRealtimeActivityLogs } from "@/hooks/useRealtimeActivityLogs";
import { useRealtimeProfiles } from "@/hooks/useRealtimeProfiles";

export default function AdminMonitorPage() {
  const { logs, loading } = useRealtimeActivityLogs(100);
  const { profiles } = useRealtimeProfiles();

  const profilesById = useMemo(() => new Map(profiles.map((p) => [p.user_id, p])), [profiles]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">LIVE MONITOR</h1>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-status-available">
          <span className="h-1.5 w-1.5 rounded-full bg-status-available animate-pulse-dot" />
          LIVE FEED
        </span>
      </div>

      <Card className="px-6">
        {loading ? (
          <div className="flex flex-col gap-3 py-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-6 animate-pulse rounded bg-surface-2" />
            ))}
          </div>
        ) : (
          <ActivityFeed logs={logs} profilesById={profilesById} />
        )}
      </Card>
    </div>
  );
}
