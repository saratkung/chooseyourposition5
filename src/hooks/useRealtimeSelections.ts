"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { SelectionRow } from "@/types/database";

/**
 * Live-syncs the current user's own selection (RLS restricts rows to the
 * caller unless they're admin). Used to drive the /my-position page and to
 * redirect users who already selected away from /positions in real time.
 */
export function useRealtimeSelections(userId: string | undefined) {
  const [selection, setSelection] = useState<SelectionRow | null>(null);
  const [internalLoading, setInternalLoading] = useState(true);
  const loading = userId ? internalLoading : false;

  useEffect(() => {
    if (!userId) return;

    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function loadInitial() {
      const { data } = await supabase
        .from("selections")
        .select("*")
        .eq("user_id", userId!)
        .eq("status", "confirmed")
        .maybeSingle();
      if (!active) return;
      setSelection(data ?? null);
      setInternalLoading(false);
    }

    loadInitial();

    const channel = supabase
      .channel(`realtime:selections:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "selections", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setSelection(null);
            return;
          }
          const row = payload.new as SelectionRow;
          setSelection(row.status === "confirmed" ? row : null);
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { selection, loading };
}
