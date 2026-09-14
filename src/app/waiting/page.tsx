"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Clock, LogOut } from "lucide-react";
import { useRealtimeSystem } from "@/hooks/useRealtimeSystem";
import { useAuth } from "@/lib/supabase/auth-context";
import { SystemStatusPill } from "@/components/system/SystemStatusPill";
import { Countdown } from "@/components/system/Countdown";
import { Button } from "@/components/ui/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function WaitingPage() {
  const router = useRouter();
  const { settings, loading } = useRealtimeSystem();
  const { profile } = useAuth();

  // The instant an admin flips the system to LIVE, every waiting browser
  // navigates itself to /positions — no refresh required.
  useEffect(() => {
    if (settings?.system_status === "live") {
      router.push("/positions");
    }
  }, [settings?.system_status, router]);

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-4 py-16 text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
          Command Center
        </span>
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">POSITION SELECTION</h1>
        {profile && (
          <p className="mt-1 text-sm text-muted">
            สวัสดี {profile.first_name} {profile.last_name}
            {profile.seniority_order != null && ` (ลำดับอาวุโสที่ ${profile.seniority_order})`}
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface px-10 py-10 shadow-2xl shadow-black/40">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted">
          <Clock className="h-4 w-4" />
          System Status
        </div>
        {loading ? (
          <div className="h-8 w-32 animate-pulse rounded-full bg-surface-2" />
        ) : (
          <SystemStatusPill status={settings?.system_status ?? "waiting"} className="px-4 py-1.5 text-sm" />
        )}

        <div className="mt-4 flex flex-col items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
            System Opens In
          </span>
          <Countdown targetIso={settings?.open_at ?? null} />
        </div>
      </div>

      <p className="max-w-md text-sm text-muted">
        กรุณารอจนกว่าระบบจะเปิดให้เลือกตำแหน่ง หน้านี้จะเปลี่ยนไปยังหน้ารายการตำแหน่งโดยอัตโนมัติทันทีที่ระบบเปิด
      </p>

      <Button variant="ghost" size="sm" onClick={handleSignOut}>
        <LogOut className="h-3.5 w-3.5" />
        ออกจากระบบ
      </Button>
    </main>
  );
}
