"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ActivityLogRow } from "@/types/database";

/** Live activity feed for the Admin Live Monitor. Admin-only via RLS. */
export function useRealtimeActivityLogs(limit = 50) {
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function loadInitial() {
      const { data } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (!active) return;
      setLogs(data ?? []);
      setLoading(false);
    }

    loadInitial();

    const channel = supabase
      .channel("realtime:activity_logs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_logs" },
        (payload) => {
          const row = payload.new as ActivityLogRow;
          setLogs((prev) => [row, ...prev].slice(0, limit));
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [limit]);

  return { logs, loading };
}
