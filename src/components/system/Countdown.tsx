"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/utils/format";

export function Countdown({ targetIso }: { targetIso: string | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!targetIso) {
    return <div className="font-mono text-5xl font-bold tracking-widest text-foreground sm:text-6xl">-- : -- : --</div>;
  }

  const remaining = new Date(targetIso).getTime() - now;

  return (
    <div className="font-mono text-5xl font-bold tracking-widest text-foreground tabular-nums sm:text-6xl">
      {formatCountdown(remaining)}
    </div>
  );
}
