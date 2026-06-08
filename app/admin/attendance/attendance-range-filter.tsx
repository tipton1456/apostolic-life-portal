"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AttendanceRangePreset } from "@/lib/elvanto-attendance";

const PRESETS: Array<{ label: string; value: AttendanceRangePreset }> = [
  { label: "Previous Sunday", value: "previous-sunday" },
  { label: "Month to Date", value: "month-to-date" },
  { label: "Year to Date", value: "year-to-date" },
  { label: "This Year", value: "this-year" },
  { label: "Last Year", value: "last-year" },
];

export default function AttendanceRangeFilter({
  currentPreset,
  end,
  start,
}: {
  currentPreset: AttendanceRangePreset;
  end: string;
  start: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingPreset, setPendingPreset] =
    useState<AttendanceRangePreset | null>(null);
  const [customStart, setCustomStart] = useState(start);
  const [customEnd, setCustomEnd] = useState(end);
  const activePreset = pendingPreset ?? currentPreset;
  const isNavigating = isPending || pendingPreset !== null;

  function navigateToPreset(preset: AttendanceRangePreset) {
    if (preset === currentPreset || isNavigating) {
      return;
    }

    setPendingPreset(preset);
    startTransition(() => {
      router.push(`/admin/attendance?range=${preset}`);
    });
  }

  function applyCustomRange() {
    if (!customStart || !customEnd || isNavigating) {
      return;
    }

    setPendingPreset("custom");
    startTransition(() => {
      router.push(
        `/admin/attendance?range=custom&start=${customStart}&end=${customEnd}`,
      );
    });
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((option) => {
          const isActive = option.value === activePreset;
          const isLoading = option.value === pendingPreset;

          return (
            <button
              key={option.value}
              type="button"
              disabled={isNavigating}
              onClick={() => navigateToPreset(option.value)}
              className={
                isActive
                  ? "inline-flex items-center justify-center gap-2 rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-neutral-950 transition disabled:cursor-wait"
                  : "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-200 transition hover:border-lime-400/60 hover:text-lime-300 disabled:cursor-wait disabled:opacity-60"
              }
            >
              {isLoading ? <Spinner /> : null}
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:flex-row md:items-end">
        <Field
          label="Start"
          value={customStart}
          onChange={(value) => setCustomStart(value)}
        />
        <Field
          label="End"
          value={customEnd}
          onChange={(value) => setCustomEnd(value)}
        />
        <button
          type="button"
          disabled={isNavigating || !customStart || !customEnd}
          onClick={applyCustomRange}
          className={
            activePreset === "custom"
              ? "inline-flex items-center justify-center gap-2 rounded-xl bg-lime-400 px-4 py-3 text-sm font-semibold text-neutral-950 transition disabled:cursor-wait disabled:opacity-70"
              : "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:border-lime-400/60 hover:text-lime-300 disabled:cursor-wait disabled:opacity-60"
          }
        >
          {pendingPreset === "custom" ? <Spinner /> : null}
          Apply Custom Range
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="text-sm font-medium text-neutral-300">
      {label}
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 block w-full rounded-xl border border-white/10 bg-neutral-900 px-3 py-3 text-neutral-100 outline-none ring-lime-400 transition focus:ring-2 md:w-44"
      />
    </label>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-950/30 border-t-neutral-950"
    />
  );
}
