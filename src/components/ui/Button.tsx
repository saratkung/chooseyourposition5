"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover disabled:bg-accent/40",
  secondary: "bg-surface-2 text-foreground hover:bg-border disabled:opacity-40",
  outline: "border border-border text-foreground hover:border-muted disabled:opacity-40",
  ghost: "text-foreground hover:bg-surface-2 disabled:opacity-40",
  danger: "bg-status-taken text-white hover:brightness-110 disabled:opacity-40",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-6 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md font-semibold uppercase tracking-wide transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed",
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className,
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
