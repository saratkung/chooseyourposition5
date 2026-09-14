import { z } from "zod";

const password = z
  .string()
  .min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
  .regex(/[A-Za-z]/, "รหัสผ่านต้องมีตัวอักษรอย่างน้อย 1 ตัว")
  .regex(/[0-9]/, "รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว");

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, "กรุณากรอกชื่อ").max(100),
    lastName: z.string().trim().min(1, "กรุณากรอกนามสกุล").max(100),
    userCode: z.string().trim().min(1, "กรุณากรอกรหัสประจำตัว").max(50),
    batch: z.string().trim().min(1, "กรุณากรอกรุ่น").max(50),
    classYear: z.string().trim().min(1, "กรุณากรอกชั้นปี").max(50),
    groupName: z.string().trim().min(1, "กรุณากรอกหมวด/กลุ่ม").max(100),
    email: z.email("อีเมลไม่ถูกต้อง"),
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "รหัสผ่านไม่ตรงกัน",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email("อีเมลไม่ถูกต้อง"),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.email("อีเมลไม่ถูกต้อง"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
