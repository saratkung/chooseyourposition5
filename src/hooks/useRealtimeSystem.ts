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

    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
      supabase.removeChannel(channel);
    };
  }, []);

  return { settings, loading };
}
