/**
 * Maps Supabase/Postgres/network errors to plain, non-technical Thai
 * messages. Never surface raw error codes or stack traces to the user.
 */
export function toFriendlyMessage(error: unknown): string {
  const raw =
    (typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message)
      : String(error)) ?? "";

  const lower = raw.toLowerCase();

  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("network request failed")) {
    return "การเชื่อมต่อขัดข้อง กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง";
  }
  if (lower.includes("invalid login credentials")) {
    return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  }
  if (lower.includes("user already registered") || lower.includes("already registered") || lower.includes("duplicate key")) {
    return "อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ";
  }
  if (lower.includes("email not confirmed")) {
    return "กรุณายืนยันอีเมลของคุณก่อนเข้าสู่ระบบ";
  }
  if (lower.includes("jwt") || lower.includes("session") || lower.includes("unauthorized") || lower.includes("not authenticated")) {
    return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง";
  }
  if (lower.includes("rate limit")) {
    return "มีการทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่";
  }

  return "เกิดข้อผิดพลาดบางอย่าง กรุณาลองใหม่อีกครั้ง";
}

export const SELECTION_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "กรุณาเข้าสู่ระบบก่อนทำรายการ",
  SYSTEM_NOT_LIVE: "ระบบยังไม่เปิดให้เลือกตำแหน่งในขณะนี้",
  NOT_YOUR_TURN: "ยังไม่ถึงคิวของคุณ กรุณารอจนกว่าจะถึงลำดับอาวุโสของคุณ",
  ALREADY_SELECTED: "คุณได้เลือกตำแหน่งไปแล้ว ไม่สามารถเลือกซ้ำได้",
  POSITION_NOT_FOUND: "ไม่พบตำแหน่งนี้ในระบบ",
  POSITION_TAKEN: "ตำแหน่งนี้ถูกเลือกโดยผู้ใช้อื่นแล้ว",
  POSITION_DISABLED: "ตำแหน่งนี้ถูกปิดใช้งานชั่วคราว",
  SERVER_ERROR: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง",
};
