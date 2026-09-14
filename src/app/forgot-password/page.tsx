"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/layout/AuthShell";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { toFriendlyMessage } from "@/lib/utils/errors";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    setSubmitting(true);
    const supabase = getSupabaseBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(result.data.email, {
      redirectTo:
        typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
    });
    setSubmitting(false);
    if (resetError) {
      setError(toFriendlyMessage(resetError));
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <AuthShell title="CHECK YOUR EMAIL" subtitle="เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปที่อีเมลของคุณแล้ว">
        <Link href="/login">
          <Button variant="outline" size="lg" className="w-full">
            BACK TO LOGIN
          </Button>
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="FORGOT PASSWORD" subtitle="กรอกอีเมลเพื่อรับลิงก์ตั้งรหัสผ่านใหม่">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
          autoFocus
        />
        <Button type="submit" size="lg" loading={submitting}>
          SEND RESET LINK
        </Button>
        <Link href="/login" className="text-center text-sm text-muted hover:text-foreground">
          BACK TO LOGIN
        </Link>
      </form>
    </AuthShell>
  );
}
