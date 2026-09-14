"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const AUTO_EXPIRE_MS = 8000;

/**
 * Ephemeral "someone is choosing this" indicator (the SELECTING/yellow
 * status) broadcast over a Supabase Realtime channel — NOT persisted to the
 * database. The database only ever knows AVAILABLE/TAKEN, which is what the
 * atomic select_position() function and RLS enforce; this broadcast layer is
 * a pure UX hint that self-expires, so it can never leave a position stuck
 * in a stale "selecting" lock if someone closes the confirm modal or their
 * tab crashes.
 */
export function usePositionActivityBroadcast() {
  const [selectingIds, setSelectingIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = timersRef.current;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel("broadcast:position-activity", {
      config: { broadcast: { self: false } },
    });

    const markSelecting = (positionId: string) => {
      setSelectingIds((prev) => new Set(prev).add(positionId));
      const existing = timers.get(positionId);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        setSelectingIds((prev) => {
          const next = new Set(prev);
          next.delete(positionId);
          return next;
        });
      }, AUTO_EXPIRE_MS);
      timers.set(positionId, timer);
    };

    const markIdle = (positionId: string) => {
      const existing = timers.get(positionId);
      if (existing) clearTimeout(existing);
      timers.delete(positionId);
      setSelectingIds((prev) => {
        const next = new Set(prev);
        next.delete(positionId);
        return next;
      });
    };

    channel
      .on("broadcast", { event: "selecting" }, ({ payload }) => {
        markSelecting((payload as { positionId: string }).positionId);
      })
      .on("broadcast", { event: "idle" }, ({ payload }) => {
        markIdle((payload as { positionId: string }).positionId);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      supabase.removeChannel(channel);
    };
  }, []);

  const notifySelecting = useCallback((positionId: string) => {
    channelRef.current?.send({ type: "broadcast", event: "selecting", payload: { positionId } });
  }, []);

  const notifyIdle = useCallback((positionId: string) => {
    channelRef.current?.send({ type: "broadcast", event: "idle", payload: { positionId } });
  }, []);

  return { selectingIds, notifySelecting, notifyIdle };
}
