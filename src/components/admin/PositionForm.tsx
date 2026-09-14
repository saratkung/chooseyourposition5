"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { positionSchema, type PositionInput } from "@/lib/validation/position";
import type { PositionRow } from "@/types/database";

const EMPTY: PositionInput = {
  positionCode: "",
  department: "",
  division: "",
  location: "",
  description: "",
  capacity: 1,
  status: "available",
};

function fromRow(row: PositionRow): PositionInput {
  return {
    positionCode: row.position_code,
    department: row.department,
    division: row.division,
    location: row.location,
    description: row.description ?? "",
    capacity: row.capacity,
    status: row.status,
  };
}

export function PositionForm({
  open,
  editing,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: PositionRow | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (input: PositionInput) => void;
}) {
  const [form, setForm] = useState<PositionInput>(editing ? fromRow(editing) : EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof PositionInput, string>>>({});
  const [lastEditingId, setLastEditingId] = useState<string | null>(editing?.id ?? null);

  if ((editing?.id ?? null) !== lastEditingId) {
    setLastEditingId(editing?.id ?? null);
    setForm(editing ? fromRow(editing) : EMPTY);
    setErrors({});
  }

  function update<K extends keyof PositionInput>(key: K, value: PositionInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = positionSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof PositionInput, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof PositionInput;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    onSubmit(result.data);
  }

  return (
    <Modal open={open} onClose={onClose} className="max-w-lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">{editing ? "EDIT POSITION" : "ADD POSITION"}</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Position Code"
            value={form.positionCode}
            onChange={(e) => update("positionCode", e.target.value)}
            error={errors.positionCode}
          />
          <Input
            label="Capacity"
            type="number"
            min={1}
            value={form.capacity}
            onChange={(e) => update("capacity", Number(e.target.value))}
            error={errors.capacity}
          />
          <Input
            label="Department"
            value={form.department}
            onChange={(e) => update("department", e.target.value)}
            error={errors.department}
          />
          <Input
            label="Division"
            value={form.division}
            onChange={(e) => update("division", e.target.value)}
            error={errors.division}
          />
          <Input
            label="Location"
            value={form.location}
            onChange={(e) => update("location", e.target.value)}
            error={errors.location}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => update("status", e.target.value as PositionInput["status"])}
          >
            <option value="available">Available</option>
            <option value="selecting">Selecting</option>
            <option value="taken">Taken</option>
            <option value="disabled">Disabled</option>
          </Select>
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            error={errors.description}
            className="sm:col-span-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            CANCEL
          </Button>
          <Button type="submit" loading={saving}>
            {editing ? "SAVE CHANGES" : "ADD POSITION"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
