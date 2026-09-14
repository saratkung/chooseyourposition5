import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Entry point. Proxy already guarantees an authenticated user reaches here
 * (unauthenticated visitors are redirected to /login before this renders).
 * This resolves REGISTER -> LOGIN -> WAITING -> POSITIONS -> MY POSITION.
 */
export default async function RootPage() {
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

  if (profile?.role === "admin") redirect("/admin");

  const { data: selection } = await supabase
    .from("selections")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "confirmed")
    .maybeSingle();

  if (selection) redirect("/my-position");

  const { data: system } = await supabase
    .from("system_settings")
    .select("system_status")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (system?.system_status === "live") redirect("/positions");

  redirect("/waiting");
}
