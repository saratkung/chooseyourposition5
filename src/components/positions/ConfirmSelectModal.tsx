"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toFriendlyMessage, SELECTION_ERROR_MESSAGES } from "@/lib/utils/errors";
import type { PositionRow, SelectPositionResult } from "@/types/database";

type Step = "confirm" | "allocating" | "success" | "failure";

export function ConfirmSelectModal({
  position,
  preview = false,
  onClose,
}: {
  position: PositionRow;
  preview?: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("confirm");
  const [result, setResult] = useState<SelectPositionResult | null>(null);
  const [failureMessage, setFailureMessage] = useState<string>("");

  async function handleConfirm() {
    setStep("allocating");

    // Preview mode (admin browsing as a participant): simulate the flow
    // without touching `selections` — never call select_position for real.
    if (preview) {
      setTimeout(() => {
        setResult({
          success: true,
          position_code: position.position_code,
          reference_code: "PREVIEW",
        });
        setStep("success");
        setTimeout(onClose, 1400);
      }, 700);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("select_position", { p_position_id: position.id });

    if (error) {
      setFailureMessage(toFriendlyMessage(error));
      setStep("failure");
      return;
    }

    const outcome = data as unknown as SelectPositionResult;
    setResult(outcome);

    if (outcome.success) {
      setStep("success");
      setTimeout(() => {
        router.push("/my-position");
        router.refresh();
      }, 1400);
    } else {
      setFailureMessage(
        (outcome.error_code && SELECTION_ERROR_MESSAGES[outcome.error_code]) ||
          outcome.message ||
          "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
      );
      setStep("failure");
    }
  }

  const dismissible = step === "confirm" || step === "failure";

  return (
    <Modal open onClose={onClose} dismissible={dismissible}>
      {step === "confirm" && (
        <div className="flex flex-col gap-5">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">Confirm Position</p>
            <p className="mt-3 font-mono text-4xl font-bold text-foreground">{position.position_code}</p>
            <p className="mt-1 text-sm text-muted">{position.department} · {position.location}</p>
          </div>
          <p className="text-center text-sm text-foreground/90">คุณต้องการเลือกตำแหน่งนี้หรือไม่?</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={onClose}>
              CANCEL
            </Button>
            <Button variant="primary" onClick={handleConfirm}>
              CONFIRM SELECTION
            </Button>
          </div>
        </div>
      )}

      {step === "allocating" && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-accent" />
          <p className="text-sm font-semibold uppercase tracking-widest text-foreground">
            Allocating Position...
          </p>
          <p className="text-xs text-muted">กรุณารอสักครู่ ระบบกำลังยืนยันตำแหน่งกับฐานข้อมูล</p>
        </div>
      )}

      {step === "success" && result?.success && (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="h-12 w-12 text-status-available" />
          <p className="text-sm font-bold uppercase tracking-widest text-status-available">
            Position Confirmed
          </p>
          <p className="font-mono text-3xl font-bold text-foreground">{result.position_code}</p>
          <p className="text-sm text-muted">{position.department}</p>
          <div className="mt-2 rounded-md border border-border bg-surface-2 px-4 py-2">
            <p className="text-[10px] uppercase tracking-widest text-muted">Reference</p>
            <p className="font-mono text-sm font-semibold text-foreground">{result.reference_code}</p>
          </div>
        </div>
      )}

      {step === "failure" && (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <XCircle className="h-12 w-12 text-status-taken" />
          <p className="text-sm font-bold uppercase tracking-widest text-status-taken">
            Position No Longer Available
          </p>
          <p className="text-sm text-muted">{failureMessage}</p>
          <Button variant="outline" onClick={onClose} className="mt-2 w-full">
            BACK TO POSITIONS
          </Button>
        </div>
      )}
    </Modal>
  );
}
