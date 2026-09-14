import { z } from "zod";

export const positionSchema = z.object({
  positionCode: z.string().trim().min(1, "กรุณากรอกรหัสตำแหน่ง").max(50),
  department: z.string().trim().min(1, "กรุณากรอกกอง").max(150),
  division: z.string().trim().min(1, "กรุณากรอกกลุ่มงาน").max(150),
  location: z.string().trim().min(1, "กรุณากรอกที่ตั้ง").max(150),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  capacity: z.coerce.number().int().min(1, "ต้องมีอย่างน้อย 1 ที่นั่ง").max(999),
  status: z.enum(["available", "selecting", "taken", "disabled"]),
});

export type PositionInput = z.infer<typeof positionSchema>;

export const CSV_HEADERS = [
  "position_code",
  "department",
  "division",
  "location",
  "description",
  "capacity",
  "status",
] as const;
