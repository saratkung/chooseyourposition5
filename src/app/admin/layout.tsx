import { redirect } from "next/navigation";
import { LayoutDashboard, ListChecks, Settings, Activity } from "lucide-react";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell, type NavItem } from "@/components/layout/AppShell";

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/positions", label: "Positions", icon: ListChecks },
  { href: "/admin/settings", label: "System", icon: Settings },
  { href: "/admin/monitor", label: "Monitor", icon: Activity },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") redirect("/");

  return (
    <AppShell navItems={ADMIN_NAV} eyebrow="Admin Console">
      {children}
    </AppShell>
  );
}
