"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/layout/AuthShell";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";
import { toFriendlyMessage } from "@/lib/utils/errors";

const EMPTY: RegisterInput = {
  firstName: "",
  lastName: "",
  userCode: "",
  batch: "",
  classYear: "",
  groupName: "",
  email: "",
  password: "",
  confirmPassword: "",
};

export default function RegisterPage() {
  const router = useRouter();
  const { push } = useToast();
  const [form, setForm] = useState<RegisterInput>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterInput, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof RegisterInput>(key: K, value: RegisterInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = registerSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof RegisterInput, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof RegisterInput;
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
          user_code: result.data.userCode,
          batch: result.data.batch,
          class_year: result.data.classYear,
          group_name: result.data.groupName,
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
          label="รหัสประจำตัว"
          value={form.userCode}
          onChange={(e) => update("userCode", e.target.value)}
          error={errors.userCode}
        />
        <Input
          label="รุ่น"
          value={form.batch}
          onChange={(e) => update("batch", e.target.value)}
          error={errors.batch}
        />
        <Input
          label="ชั้นปี"
          value={form.classYear}
          onChange={(e) => update("classYear", e.target.value)}
          error={errors.classYear}
        />
        <Input
          label="หมวด / กลุ่ม"
          value={form.groupName}
          onChange={(e) => update("groupName", e.target.value)}
          error={errors.groupName}
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
