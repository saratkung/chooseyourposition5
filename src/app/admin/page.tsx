"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users2, UserCheck, UserX, ShieldCheck, CircleCheck, CircleX, CircleSlash, ArrowRight } from "lucide-react";
import { DashboardStatCard } from "@/components/admin/DashboardStatCard";
import { SystemStatusPill } from "@/components/system/SystemStatusPill";
import { useRealtimePositions } from "@/hooks/useRealtimePositions";
import { useRealtimeProfiles } from "@/hooks/useRealtimeProfiles";
import { useRealtimeSystem } from "@/hooks/useRealtimeSystem";

function SectionHeader({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-2.5 text-sm font-bold uppercase tracking-widest text-foreground">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white shadow-[0_0_16px_rgba(139,92,246,0.7)]">
          {icon}
        </span>
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
      <Link
        href={href}
        className="flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-hover"
      >
        View All
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function pct(part: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export default function AdminDashboardPage() {
  const { positions, loading: loadingPositions } = useRealtimePositions();
  const { profiles, loading: loadingProfiles } = useRealtimeProfiles();
  const { settings } = useRealtimeSystem();
  const [now, setNow] = useState<Date | null>(() => (typeof window === "undefined" ? null : new Date()));

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    const participants = profiles.filter((p) => p.role === "user");
    const available = positions.filter((p) => p.status === "available").length;
    const taken = positions.filter((p) => p.status === "taken").length;
    const disabled = positions.filter((p) => p.status === "disabled").length;
    return {
      totalUsers: participants.length,
      selected: taken, // 1 confirmed selection <-> 1 taken position, enforced by the DB
      notSelected: Math.max(0, participants.length - taken),
      totalPositions: positions.length,
      available,
      taken,
      disabled,
    };
  }, [positions, profiles]);

  const loading = loadingPositions || loadingProfiles;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">— Royal Thai Police —</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            ADMIN <span className="bg-gradient-to-r from-accent to-accent-hover bg-clip-text text-transparent">DASHBOARD</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <SystemStatusPill status={settings?.system_status ?? "waiting"} />
          {now && (
            <span className="hidden text-xs text-muted sm:block">
              {now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}{" "}
              {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-surface" />
          ))}
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <SectionHeader icon={<Users2 className="h-4 w-4" />} label="Users" href="/admin/users" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <DashboardStatCard
                label="Total Users"
                value={stats.totalUsers}
                icon={<Users2 className="h-5 w-5" />}
                variant="violet"
                subtext="ผู้ลงทะเบียนทั้งหมด"
              />
              <DashboardStatCard
                label="Selected"
                value={stats.selected}
                icon={<UserCheck className="h-5 w-5" />}
                variant="emerald"
                subtext={pct(stats.selected, stats.totalUsers) + " เลือกแล้ว"}
              />
              <DashboardStatCard
                label="Not Selected"
                value={stats.notSelected}
                icon={<UserX className="h-5 w-5" />}
                variant="amber"
                subtext={pct(stats.notSelected, stats.totalUsers) + " ยังไม่เลือก"}
              />
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <SectionHeader
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Positions"
              href="/admin/positions"
            />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <DashboardStatCard
                label="Total Positions"
                value={stats.totalPositions}
                icon={<ShieldCheck className="h-5 w-5" />}
                variant="violet"
              />
              <DashboardStatCard
                label="Available"
                value={stats.available}
                icon={<CircleCheck className="h-5 w-5" />}
                variant="emerald"
                subtext={pct(stats.available, stats.totalPositions)}
              />
              <DashboardStatCard
                label="Taken"
                value={stats.taken}
                icon={<CircleX className="h-5 w-5" />}
                variant="rose"
                subtext={pct(stats.taken, stats.totalPositions)}
              />
              <DashboardStatCard
                label="Disabled"
                value={stats.disabled}
                icon={<CircleSlash className="h-5 w-5" />}
                variant="slate"
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
