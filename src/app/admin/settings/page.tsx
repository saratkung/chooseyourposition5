"use client";

import { useState } from "react";
import { Play, Pause, RotateCcw, Square } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SystemStatusPill } from "@/components/system/SystemStatusPill";
import { useToast } from "@/components/ui/Toast";
import { useRealtimeSystem } from "@/hooks/useRealtimeSystem";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toFriendlyMessage } from "@/lib/utils/errors";
import type { SystemStatus, SelectPositionResult } from "@/types/database";

const ACTIONS: { status: SystemStatus; label: string; icon: typeof Play; from: SystemStatus[] }[] = [
  { status: "live", label: "OPEN SYSTEM", icon: Play, from: ["waiting", "paused"] },
  { status: "paused", label: "PAUSE SYSTEM", icon: Pause, from: ["live"] },
  { status: "live", label: "RESUME SYSTEM", icon: RotateCcw, from: ["paused"] },
  { status: "finished", label: "FINISH SYSTEM", icon: Square, from: ["live", "paused", "waiting"] },
];

export default function AdminSettingsPage() {
  const { settings } = useRealtimeSystem();
  const { push } = useToast();
  const [pending, setPending] = useState(false);
  const [openAt, setOpenAt] = useState("");

  async function handleTransition(status: SystemStatus) {
    setPending(true);
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("set_system_status", { p_status: status });
    setPending(false);
    if (error) {
      push(toFriendlyMessage(error), "error");
      return;
    }
    const result = data as unknown as SelectPositionResult;
    if (!result.success) {
      push(result.message ?? "ไม่สามารถเปลี่ยนสถานะระบบได้", "error");
      return;
    }
    push(`SYSTEM STATUS → ${status.toUpperCase()}`, "success");
  }

  async function handleUpdateOpenAt() {
    if (!openAt || !settings) return;
    setPending(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("system_settings")
      .update({ open_at: new Date(openAt).toISOString() })
      .eq("id", settings.id);
    setPending(false);
    if (error) {
      push(toFriendlyMessage(error), "error");
      return;
    }
    push("อัปเดตเวลาเปิดระบบแล้ว", "success");
  }

  const current = settings?.system_status ?? "waiting";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">SYSTEM CONTROL</h1>

      <Card className="flex flex-col items-center gap-3 px-6 py-8">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted">Current Status</span>
        <SystemStatusPill status={current} className="px-4 py-1.5 text-sm" />
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const enabled = action.from.includes(current);
          return (
            <Button
              key={action.label}
              variant={action.status === "finished" ? "danger" : "secondary"}
              disabled={!enabled || pending}
              onClick={() => handleTransition(action.status)}
              className="flex-col gap-1.5 py-4"
            >
              <Icon className="h-4 w-4" />
              {action.label}
            </Button>
          );
        })}
      </div>

      <Card className="flex flex-col gap-4 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
          Waiting Room Countdown Target
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            type="datetime-local"
            label="System Opens At"
            value={openAt}
            onChange={(e) => setOpenAt(e.target.value)}
            className="sm:w-64"
          />
          <Button variant="outline" onClick={handleUpdateOpenAt} disabled={pending || !openAt}>
            UPDATE
          </Button>
        </div>
        {settings?.open_at && (
          <p className="text-xs text-muted">
            Currently set to: {new Date(settings.open_at).toLocaleString("th-TH")}
          </p>
        )}
      </Card>
    </div>
  );
}
