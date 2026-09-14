"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/layout/AuthShell";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { toFriendlyMessage } from "@/lib/utils/errors";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { push } = useToast();
  const [form, setForm] = useState<LoginInput>({ email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginInput, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = loginSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof LoginInput, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof LoginInput;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword(result.data);

    if (error) {
      setSubmitting(false);
      push(toFriendlyMessage(error), "error");
      return;
    }

    await supabase.from("activity_logs").insert({
      user_id: data.user.id,
      action: "LOGIN",
      metadata: {},
    });

    const redirectTo = searchParams.get("redirectTo");
    router.push(redirectTo && redirectTo !== "/login" ? redirectTo : "/");
    router.refresh();
  }

  return (
    <AuthShell title="LOGIN" subtitle="เข้าสู่ระบบเลือกตำแหน่งออนไลน์">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          error={errors.email}
          autoComplete="email"
          autoFocus
        />
        <Input
          label="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
          error={errors.password}
          autoComplete="current-password"
        />

        <div className="flex items-center justify-end">
          <Link href="/forgot-password" className="text-xs text-muted hover:text-foreground">
            Forgot Password?
          </Link>
        </div>

        <Button type="submit" size="lg" loading={submitting}>
          LOGIN
        </Button>
        <Link href="/register">
          <Button type="button" variant="outline" size="lg" className="w-full">
            REGISTER
          </Button>
        </Link>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
