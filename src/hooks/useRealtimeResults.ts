"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ResultRow } from "@/types/database";

/**
 * Every position + who (if anyone) holds it, for the /results board any
 * logged-in participant can view. Backed by get_results() (a narrow,
 * SECURITY DEFINER join — see 0006_results_board.sql), not a direct table
 * read, so this never needs to broaden the profiles/selections RLS
 * policies. Re-fetches whenever `selections` or `positions` change so
 * newly confirmed picks appear live.
 */
export function useRealtimeResults() {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function load() {
      const { data } = await supabase.rpc("get_results");
      if (!active) return;
      setResults((data as unknown as ResultRow[]) ?? []);
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel("realtime:results")
      .on("postgres_changes", { event: "*", schema: "public", table: "selections" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "positions" }, load)
      .subscribe();

    function handleOnline() {
      load();
    }
    window.addEventListener("online", handleOnline);

    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
      supabase.removeChannel(channel);
    };
  }, []);

  return { results, loading };
}
