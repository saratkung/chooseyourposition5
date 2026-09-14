"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PositionRow } from "@/types/database";

/**
 * Loads all positions once, then keeps them in sync via Supabase Realtime
 * postgres_changes on the `positions` table. This is what makes A-001 flip
 * from AVAILABLE to TAKEN on every open browser without a refresh.
 */
export function useRealtimePositions() {
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    async function loadInitial() {
      const { data, error: fetchError } = await supabase
        .from("positions")
        .select("*")
        .order("position_code", { ascending: true });

      if (!active) return;
      if (fetchError) {
        setError(fetchError.message);
      } else {
        setPositions(data ?? []);
      }
      setLoading(false);
    }

    loadInitial();

    const channel = supabase
      .channel("realtime:positions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "positions" },
        (payload) => {
          setPositions((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as PositionRow;
              if (prev.some((p) => p.id === row.id)) return prev;
              return [...prev, row].sort((a, b) => a.position_code.localeCompare(b.position_code));
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as PositionRow;
              return prev.map((p) => (p.id === row.id ? row : p));
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as Partial<PositionRow>;
              return prev.filter((p) => p.id !== row.id);
            }
            return prev;
          });
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setError("การเชื่อมต่อแบบเรียลไทม์ขัดข้อง กำลังเชื่อมต่อใหม่...");
        }
        if (status === "SUBSCRIBED") {
          setError(null);
        }
      });

    // Re-sync full state whenever the tab regains connectivity, so we never
    // drift from the database after a dropped websocket.
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

  return { positions, loading, error };
}
