"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { PositionStatus } from "@/types/database";

export interface PositionFilterState {
  query: string;
  department: string;
  division: string;
  status: PositionStatus | "all";
}

export function PositionFilters({
  filters,
  departments,
  divisions,
  onChange,
}: {
  filters: PositionFilterState;
  departments: string[];
  divisions: string[];
  onChange: (next: PositionFilterState) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          placeholder="Search position..."
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          className="pl-10"
        />
      </div>

      <Select
        value={filters.department}
        onChange={(e) => onChange({ ...filters, department: e.target.value })}
        className="sm:w-44"
      >
        <option value="all">Department: All</option>
        {departments.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </Select>

      <Select
        value={filters.division}
        onChange={(e) => onChange({ ...filters, division: e.target.value })}
        className="sm:w-44"
      >
        <option value="all">Division: All</option>
        {divisions.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </Select>

      <Select
        value={filters.status}
        onChange={(e) => onChange({ ...filters, status: e.target.value as PositionFilterState["status"] })}
        className="sm:w-40"
      >
        <option value="all">Status: All</option>
        <option value="available">Available</option>
        <option value="selecting">Selecting</option>
        <option value="taken">Taken</option>
        <option value="disabled">Disabled</option>
      </Select>
    </div>
  );
}
