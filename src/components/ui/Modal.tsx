"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Modal({
  open,
  onClose,
  children,
  className,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  dismissible?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose, dismissible]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={dismissible ? onClose : undefined}
      />
      <div
        className={cn(
          "relative w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-2xl shadow-black/60",
          className,
        )}
      >
        {dismissible && (
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="absolute right-4 top-4 text-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
