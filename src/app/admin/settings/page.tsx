"use client";

import { useState } from "react";
import { Play, Pause, RotateCcw, Square, SkipForward, ListOrdered, Shuffle, UserPlus, Lock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SystemStatusPill } from "@/components/system/SystemStatusPill";
import { useToast } from "@/components/ui/Toast";
import { useRealtimeSystem } from "@/hooks/useRealtimeSystem";
import { useCurrentTurn } from "@/hooks/useCurrentTurn";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toFriendlyMessage } from "@/lib/utils/errors";
import type { SystemStatus, SelectionMode, SelectPositionResult } from "@/types/database";

const ACTIONS: { status: SystemStatus; label: string; icon: typeof Play; from: SystemStatus[] }[] = [
  { status: "live", label: "OPEN SYSTEM", icon: Play, from: ["waiting", "paused"] },
  { status: "paused", label: "PAUSE SYSTEM", icon: Pause, from: ["live"] },
  { status: "live", label: "RESUME SYSTEM", icon: RotateCcw, from: ["paused"] },
  { status: "finished", label: "FINISH SYSTEM", icon: Square, from: ["live", "paused", "waiting"] },
];

export default function AdminSettingsPage() {
  const { settings } = useRealtimeSystem();
  const { turn } = useCurrentTurn(settings);
  const { push } = useToast();
  const [pending, setPending] = useState(false);
  const [openAt, setOpenAt] = useState("");
  const [manualSeniority, setManualSeniority] = useState("");

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

  async function handleSelectionMode(mode: SelectionMode) {
    setPending(true);
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("set_selection_mode", { p_mode: mode });
    setPending(false);
    if (error) {
      push(toFriendlyMessage(error), "error");
      return;
    }
    const result = data as unknown as SelectPositionResult;
    if (!result.success) {
      push(result.message ?? "ไม่สามารถเปลี่ยนโหมดการเลือกได้", "error");
      return;
    }
    push(mode === "seniority" ? "เปิดใช้งานคิวอาวุโสแล้ว" : "เปลี่ยนเป็นโหมดเปิดอิสระแล้ว", "success");
  }

  async function handleAdvanceTurn(toSeniority: number | null) {
    setPending(true);
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("advance_turn", { p_to_seniority_order: toSeniority });
    setPending(false);
    if (error) {
      push(toFriendlyMessage(error), "error");
      return;
    }
    const result = data as unknown as SelectPositionResult;
    if (!result.success) {
      push(result.message ?? "ไม่สามารถเปลี่ยนคิวได้", "error");
      return;
    }
    setManualSeniority("");
    push(
      result.current_turn_seniority_order != null
        ? `เปลี่ยนคิวเป็นลำดับอาวุโสที่ ${result.current_turn_seniority_order}`
        : "ไม่มีลำดับอาวุโสถัดไป (คิวสิ้นสุดแล้ว)",
      "success",
    );
  }

  async function handleRegistrationToggle(open: boolean) {
    setPending(true);
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("set_registration_open", { p_open: open });
    setPending(false);
    if (error) {
      push(toFriendlyMessage(error), "error");
      return;
    }
    const result = data as unknown as SelectPositionResult;
    if (!result.success) {
      push(result.message ?? "ไม่สามารถเปลี่ยนสถานะการลงทะเบียนได้", "error");
      return;
    }
    push(open ? "เปิดรับสมัครแล้ว" : "ปิดรับสมัครแล้ว", "success");
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
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Registration</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm">
            {settings?.registration_open ?? true ? (
              <>
                <UserPlus className="h-4 w-4 text-status-available" />
                <span className="text-status-available">เปิดรับสมัครอยู่</span> — ใครก็เข้ามาสมัครที่ /register ได้
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 text-status-taken" />
                <span className="text-status-taken">ปิดรับสมัครแล้ว</span> — สมัครใหม่ไม่ได้ (บัญชีเดิมยังล็อกอินได้ตามปกติ)
              </>
            )}
          </p>
          <Button
            variant={(settings?.registration_open ?? true) ? "danger" : "primary"}
            size="sm"
            disabled={pending}
            onClick={() => handleRegistrationToggle(!(settings?.registration_open ?? true))}
          >
            {(settings?.registration_open ?? true) ? "CLOSE REGISTRATION" : "OPEN REGISTRATION"}
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
          Selection Mode — ลำดับอาวุโส
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant={settings?.selection_mode === "open" ? "primary" : "outline"}
            disabled={pending}
            onClick={() => handleSelectionMode("open")}
            className="flex-col gap-1.5 py-4"
          >
            <Shuffle className="h-4 w-4" />
            OPEN (เลือกพร้อมกัน)
          </Button>
          <Button
            variant={settings?.selection_mode === "seniority" ? "primary" : "outline"}
            disabled={pending}
            onClick={() => handleSelectionMode("seniority")}
            className="flex-col gap-1.5 py-4"
          >
            <ListOrdered className="h-4 w-4" />
            SENIORITY QUEUE (ทีละคิว)
          </Button>
        </div>

        {settings?.selection_mode === "seniority" && (
          <div className="flex flex-col gap-3 rounded-md border border-border bg-surface-2 p-4">
            <p className="text-sm">
              คิวปัจจุบัน:{" "}
              {turn.active ? (
                <span className="font-semibold text-status-available">
                  ลำดับที่ {turn.seniority_order} — {turn.first_name ?? "-"} {turn.last_name ?? ""}
                </span>
              ) : (
                <span className="text-muted">ไม่มี (คิวยังไม่เริ่ม หรือสิ้นสุดแล้ว)</span>
              )}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => handleAdvanceTurn(null)}
              >
                <SkipForward className="h-3.5 w-3.5" />
                ข้ามไปคิวถัดไป
              </Button>
              <Input
                type="number"
                min={1}
                label="ตั้งคิวเป็นลำดับอาวุโสที่..."
                value={manualSeniority}
                onChange={(e) => setManualSeniority(e.target.value)}
                className="sm:w-48"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={pending || !manualSeniority}
                onClick={() => handleAdvanceTurn(Number(manualSeniority))}
              >
                ตั้งคิว
              </Button>
            </div>
          </div>
        )}
      </Card>

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
