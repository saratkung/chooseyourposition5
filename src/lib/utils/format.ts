const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

/** e.g. "14 September 2026 21:03:22" (matches the spec's My Position display). */
export function formatDateTime(iso: string) {
  const d = new Date(iso);
  const day = d.getDate();
  const month = d.toLocaleString("en-US", { month: "long" });
  const year = d.getFullYear();
  const time = d.toLocaleTimeString("en-GB", { hour12: false });
  return `${day} ${month} ${year} ${time}`;
}

/** Thai-localized variant, e.g. "14 กันยายน 2569 21:03:22". */
export function formatDateTimeThai(iso: string) {
  const d = new Date(iso);
  const day = d.getDate();
  const month = THAI_MONTHS[d.getMonth()];
  const year = d.getFullYear() + 543;
  const time = d.toLocaleTimeString("en-GB", { hour12: false });
  return `${day} ${month} ${year} ${time}`;
}

export function formatCountdown(msRemaining: number) {
  const clamped = Math.max(0, msRemaining);
  const totalSeconds = Math.floor(clamped / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)} : ${pad(minutes)} : ${pad(seconds)}`;
}
