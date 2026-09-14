import { redirect } from "next/navigation";
import { LayoutDashboard, ListChecks, Settings, Activity, Users, ListOrdered } from "lucide-react";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell, type NavItem } from "@/components/layout/AppShell";

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/admin/positions", label: "Positions", icon: <ListChecks className="h-4 w-4" /> },
  { href: "/admin/users", label: "Users", icon: <Users className="h-4 w-4" /> },
  { href: "/admin/settings", label: "System", icon: <Settings className="h-4 w-4" /> },
  { href: "/admin/monitor", label: "Monitor", icon: <Activity className="h-4 w-4" /> },
  { href: "/results", label: "Results", icon: <ListOrdered className="h-4 w-4" /> },
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
