"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/lib/supabase/auth-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface NavItem {
  href: string;
  label: string;
  // A rendered element (e.g. `<LayoutDashboard className="h-4 w-4" />`),
  // NOT a component reference. NavItem[] is passed from server components
  // (admin/layout.tsx) into this client component, and only serializable
  // values — plain data and React elements — can cross that boundary; a
  // bare component/function reference cannot.
  icon: React.ReactNode;
}

export function AppShell({
  navItems,
  eyebrow,
  children,
}: {
  navItems: NavItem[];
  eyebrow: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useAuth();

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface/60 lg:flex">
        <div className="flex items-center gap-2.5 border-b border-border px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface">
            <ShieldCheck className="h-4.5 w-4.5 text-accent" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{eyebrow}</p>
            <p className="text-sm font-bold">Command Center</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-white shadow-lg shadow-accent/30"
                    : "text-muted hover:bg-surface-2 hover:text-foreground",
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border px-4 py-4">
          {profile && (
            <div className="mb-3 flex items-center gap-2.5">
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                {(profile.first_name[0] ?? "").toUpperCase()}
                {(profile.last_name[0] ?? "").toUpperCase()}
                <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-status-available" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground">
                  {profile.first_name} {profile.last_name}
                </p>
                <p className="truncate text-[11px] text-muted">
                  {profile.role === "admin" ? "System Administrator" : "Participant"}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-border bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-accent" />
          <span className="text-sm font-bold">{eyebrow}</span>
        </div>
        <button onClick={handleSignOut} aria-label="ออกจากระบบ" className="text-muted">
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <main className="flex-1 pb-20 pt-16 lg:pb-0 lg:pt-0">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface/95 backdrop-blur lg:hidden">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-wide",
                active ? "text-accent" : "text-muted",
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
