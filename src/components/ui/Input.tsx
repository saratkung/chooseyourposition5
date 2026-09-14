"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils/cn";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium uppercase tracking-wide text-muted">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          className={cn(
            "h-11 w-full rounded-md border border-border bg-surface px-3.5 text-sm text-foreground placeholder:text-muted/60",
            "outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent",
            error && "border-status-taken focus:border-status-taken focus:ring-status-taken",
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-status-taken">{error}</p>}
      </div>
    );
  },
);
Input.displayName = "Input";
