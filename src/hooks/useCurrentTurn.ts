"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CurrentTurn, SystemSettingsRow } from "@/types/database";

/**
 * Resolves who currently holds the seniority-queue turn (name + rank only —
 * via the get_current_turn() RPC, which exposes just that one profile, not
 * the full profiles table). Re-fetches whenever the seniority-relevant
 * fields on `settings` change, which already arrive in real time through
 * useRealtimeSystem() since they live on the same system_settings row.
 */
export function useCurrentTurn(settings: SystemSettingsRow | null) {
  const [fetchedTurn, setFetchedTurn] = useState<CurrentTurn>({ active: false });
  const [fetchedLoading, setFetchedLoading] = useState(true);

  const mode = settings?.selection_mode;
  const currentSeniority = settings?.current_turn_seniority_order;
  const seniorityMode = mode === "seniority";

  useEffect(() => {
    if (!seniorityMode) return;

    let active = true;
    const supabase = getSupabaseBrowserClient();
    supabase.rpc("get_current_turn").then(({ data }) => {
      if (!active) return;
      setFetchedTurn((data as unknown as CurrentTurn) ?? { active: false });
      setFetchedLoading(false);
    });

    return () => {
      active = false;
    };
  }, [seniorityMode, currentSeniority]);

  return {
    turn: seniorityMode ? fetchedTurn : { active: false },
    loading: seniorityMode ? fetchedLoading : false,
  };
}
