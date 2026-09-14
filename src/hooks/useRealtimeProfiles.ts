"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ProfileRow } from "@/types/database";

/** Admin-only (RLS): live list of all user profiles, for dashboard stats and user counts. */
export function useRealtimeProfiles() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function loadInitial() {
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (!active) return;
      setProfiles(data ?? []);
      setLoading(false);
    }

    loadInitial();

    const channel = supabase
      .channel("realtime:profiles")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => {
        setProfiles((prev) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as ProfileRow;
            if (prev.some((p) => p.id === row.id)) return prev;
            return [row, ...prev];
          }
          if (payload.eventType === "UPDATE") {
            const row = payload.new as ProfileRow;
            return prev.map((p) => (p.id === row.id ? row : p));
          }
          if (payload.eventType === "DELETE") {
            const row = payload.old as Partial<ProfileRow>;
            return prev.filter((p) => p.id !== row.id);
          }
          return prev;
        });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { profiles, loading };
}
