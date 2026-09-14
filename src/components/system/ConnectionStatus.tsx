"use client";

import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function ConnectionStatus() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[200] flex items-center justify-center gap-2 bg-accent px-4 py-2 text-sm font-medium text-white shadow-lg">
      <WifiOff className="h-4 w-4 animate-pulse-dot" />
      CONNECTION LOST — กำลังเชื่อมต่อใหม่...
    </div>
  );
}
