type ClassValue = string | number | null | undefined | false | ClassValue[];

function flatten(input: ClassValue, out: string[]) {
  if (!input) return;
  if (Array.isArray(input)) {
    input.forEach((v) => flatten(v, out));
    return;
  }
  out.push(String(input));
}

/** Minimal className joiner — avoids pulling in clsx/tailwind-merge for this project. */
export function cn(...inputs: ClassValue[]) {
  const out: string[] = [];
  inputs.forEach((v) => flatten(v, out));
  return out.join(" ");
}
