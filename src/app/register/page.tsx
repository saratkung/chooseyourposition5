"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/layout/AuthShell";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { registerSchema } from "@/lib/validation/auth";
import { toFriendlyMessage } from "@/lib/utils/errors";

const EMPTY = {
  firstName: "",
  lastName: "",
  seniorityOrder: "",
  email: "",
  password: "",
  confirmPassword: "",
};

type RegisterFormState = typeof EMPTY;

export default function RegisterPage() {
  const router = useRouter();
  const { push } = useToast();
  const [form, setForm] = useState<RegisterFormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterFormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof RegisterFormState>(key: K, value: RegisterFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = registerSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof RegisterFormState, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof RegisterFormState;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email: result.data.email,
      password: result.data.password,
      options: {
        data: {
          first_name: result.data.firstName,
          last_name: result.data.lastName,
          seniority_order: result.data.seniorityOrder,
        },
      },
    });

    if (error) {
      setSubmitting(false);
      push(toFriendlyMessage(error), "error");
      return;
    }

    if (!data.session) {
      // Email confirmation is required by this Supabase project's auth settings.
      setSubmitting(false);
      push("สมัครสมาชิกสำเร็จ กรุณายืนยันอีเมลของคุณก่อนเข้าสู่ระบบ", "success");
      router.push("/login");
      return;
    }

    await supabase.from("activity_logs").insert({
      user_id: data.user!.id,
      action: "REGISTER",
      metadata: { email: result.data.email },
    });

    push("สมัครสมาชิกสำเร็จ", "success");
    router.push("/waiting");
    router.refresh();
  }

  return (
    <AuthShell title="REGISTER" subtitle="สร้างบัญชีเพื่อเข้าร่วมระบบเลือกตำแหน่ง" wide>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="ชื่อ"
          value={form.firstName}
          onChange={(e) => update("firstName", e.target.value)}
          error={errors.firstName}
          autoComplete="given-name"
        />
        <Input
          label="นามสกุล"
          value={form.lastName}
          onChange={(e) => update("lastName", e.target.value)}
          error={errors.lastName}
          autoComplete="family-name"
        />
        <Input
          label="ลำดับอาวุโส"
          type="number"
          min={1}
          value={form.seniorityOrder}
          onChange={(e) => update("seniorityOrder", e.target.value)}
          error={errors.seniorityOrder}
          className="sm:col-span-2"
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          error={errors.email}
          autoComplete="email"
          className="sm:col-span-2"
        />
        <Input
          label="Password"
          type="password"
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          error={errors.password}
          autoComplete="new-password"
        />
        <Input
          label="Confirm Password"
          type="password"
          value={form.confirmPassword}
          onChange={(e) => update("confirmPassword", e.target.value)}
          error={errors.confirmPassword}
          autoComplete="new-password"
        />

        <Button type="submit" size="lg" loading={submitting} className="sm:col-span-2 mt-2">
          REGISTER
        </Button>

        <p className="text-center text-sm text-muted sm:col-span-2">
          มีบัญชีอยู่แล้ว?{" "}
          <Link href="/login" className="font-semibold text-foreground hover:text-accent">
            เข้าสู่ระบบ
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
