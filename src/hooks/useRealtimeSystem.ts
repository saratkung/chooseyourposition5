"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { SystemSettingsRow } from "@/types/database";

/** Live-syncs the single system_settings row (WAITING / LIVE / PAUSED / FINISHED). */
export function useRealtimeSystem() {
  const [settings, setSettings] = useState<SystemSettingsRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function loadInitial() {
      const { data } = await supabase
        .from("system_settings")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      setSettings(data ?? null);
      setLoading(false);
    }

    loadInitial();

    const channel = supabase
      .channel("realtime:system_settings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_settings" },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          setSettings(payload.new as SystemSettingsRow);
        },
      )
      .subscribe();

    function handleOnline() {
      loadInitial();
    }
    window.addEventListener("online", handleOnline);

    // Safety net: the seniority queue is only ever gated by this row, so a
    // silently dropped realtime event (backgrounded tab, flaky socket) would
    // otherwise leave a user staring at "not your turn" forever with no
    // sign anything is wrong. Cheap enough to poll alongside the subscription.
    const pollId = window.setInterval(loadInitial, 15000);

    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
      window.clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, []);

  return { settings, loading };
}
