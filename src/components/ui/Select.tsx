"use client";

import { forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-xs font-medium uppercase tracking-wide text-muted">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={!!error}
            className={cn(
              "h-11 w-full appearance-none rounded-md border border-border bg-surface px-3.5 pr-9 text-sm text-foreground",
              "outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent",
              error && "border-status-taken focus:border-status-taken focus:ring-status-taken",
              className,
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        </div>
        {error && <p className="text-xs text-status-taken">{error}</p>}
      </div>
    );
  },
);
Select.displayName = "Select";
