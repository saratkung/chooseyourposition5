"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutGrid, User as UserIcon, MapPin, Building2, BadgeCheck } from "lucide-react";
import { AppShell, type NavItem } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/supabase/auth-context";
import { useRealtimeSelections } from "@/hooks/useRealtimeSelections";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils/format";
import type { PositionRow } from "@/types/database";

const NAV_ITEMS: NavItem[] = [
  { href: "/positions", label: "Positions", icon: <LayoutGrid className="h-4 w-4" /> },
  { href: "/my-position", label: "My Position", icon: <UserIcon className="h-4 w-4" /> },
];

export default function MyPositionPage() {
  const { user } = useAuth();
  const { selection, loading } = useRealtimeSelections(user?.id);
  const [position, setPosition] = useState<PositionRow | null>(null);
  const [loadedForSelectionId, setLoadedForSelectionId] = useState<string | null>(null);

  if ((selection?.id ?? null) !== loadedForSelectionId) {
    setLoadedForSelectionId(selection?.id ?? null);
    setPosition(null);
  }

  useEffect(() => {
    if (!selection) return;
    const supabase = getSupabaseBrowserClient();
    supabase
      .from("positions")
      .select("*")
      .eq("id", selection.position_id)
      .maybeSingle()
      .then(({ data }) => setPosition(data ?? null));
  }, [selection]);

  return (
    <AppShell navItems={NAV_ITEMS} eyebrow="Position Selection">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6 lg:py-16">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">MY POSITION</h1>

        {loading ? (
          <div className="h-64 animate-pulse rounded-xl border border-border bg-surface" />
        ) : !selection || !position ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface px-6 py-14 text-center">
            <p className="text-sm text-muted">คุณยังไม่ได้เลือกตำแหน่ง</p>
            <Link href="/positions">
              <Button>ไปเลือกตำแหน่ง</Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="flex flex-col items-center gap-3 border-b border-border bg-status-available/10 px-6 py-8 text-center">
              <BadgeCheck className="h-10 w-10 text-status-available" />
              <p className="text-xs font-bold uppercase tracking-widest text-status-available">Confirmed</p>
              <p className="font-mono text-4xl font-bold text-foreground">{position.position_code}</p>
            </div>

            <div className="flex flex-col divide-y divide-border">
              <Row icon={Building2} label="Department" value={position.department} />
              <Row icon={MapPin} label="Location" value={position.location} />
              <Row label="Division" value={position.division} />
              <Row label="Selected At" value={formatDateTime(selection.selected_at)} />
              <div className="flex items-center justify-between px-6 py-4">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted">
                  Reference Code
                </span>
                <span className="font-mono text-sm font-bold text-foreground">
                  {selection.reference_code}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
