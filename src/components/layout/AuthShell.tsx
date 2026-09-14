import { ShieldCheck } from "lucide-react";

export function AuthShell({
  title,
  subtitle,
  children,
  wide = false,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[640px] -translate-x-1/2 rounded-full bg-accent/20 blur-[120px]"
      />

      <div className={`relative z-10 w-full ${wide ? "max-w-2xl" : "max-w-md"}`}>
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-surface">
            <ShieldCheck className="h-5 w-5 text-accent" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>

        <div className="rounded-xl border border-border bg-surface/80 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}
