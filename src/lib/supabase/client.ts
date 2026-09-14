"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

/**
 * Singleton browser Supabase client. Reused across the app so Realtime
 * hooks share the same underlying websocket connection instead of each
 * opening its own.
 */
export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return browserClient;
}
