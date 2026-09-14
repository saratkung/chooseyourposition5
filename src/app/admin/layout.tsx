import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { ADMIN_NAV_ITEMS } from "@/components/layout/nav-items";

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
    <AppShell navItems={ADMIN_NAV_ITEMS} eyebrow="Admin Console">
      {children}
    </AppShell>
  );
}
