"use client";

import { useState } from "react";
import { EXPENSE_LINES, REPORT_TYPES } from "./expense-fields";

export default function ExpenseLines() {
  const [visibleLineCount, setVisibleLineCount] = useState(1);

  const visibleLines = EXPENSE_LINES.slice(0, visibleLineCount);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Expense Lines</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Add another line only when you need it. The first line is required.
          </p>
        </div>
      </div>

      <label className="mt-5 block text-sm font-semibold text-neutral-200">
        <span>
          Select the type of report. Do not select more than one type per
          submission.
        </span>
        <select
          className="mt-3 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2 md:max-w-sm"
          defaultValue="Reimbursement"
          name="reportType"
          required
        >
          {REPORT_TYPES.map((reportType) => (
            <option key={reportType} value={reportType}>
              {reportType}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-6 overflow-x-auto">
        <div className="min-w-[44rem] space-y-3">
          <div className="grid grid-cols-[1.5fr_1fr_10rem] gap-3 px-1 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
            <span>Description</span>
            <span>Department</span>
            <span>Amount</span>
          </div>

          {visibleLines.map((line, index) => (
            <div
              key={line.amount}
              className="grid grid-cols-[1.5fr_1fr_10rem] gap-3 rounded-xl border border-white/10 bg-neutral-950/40 p-3"
            >
              <input
                aria-label={`Description ${index + 1}`}
                className="w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2.5 text-white outline-none ring-lime-400 transition focus:ring-2"
                name={line.description}
                placeholder="Description"
                required={index === 0}
                type="text"
              />
              <input
                aria-label={`Department ${index + 1}`}
                className="w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2.5 text-white outline-none ring-lime-400 transition focus:ring-2"
                name={line.department}
                placeholder="Department"
                required={index === 0}
                type="text"
              />
              <input
                aria-label={`Amount ${index + 1}`}
                className="w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2.5 text-white outline-none ring-lime-400 transition focus:ring-2"
                name={line.amount}
                placeholder="0.00"
                required={index === 0}
                step="0.01"
                type="number"
              />
            </div>
          ))}
        </div>
      </div>

      {visibleLineCount < EXPENSE_LINES.length ? (
        <button
          className="mt-4 rounded-xl border border-lime-400/40 px-4 py-3 text-sm font-semibold text-lime-300 transition hover:bg-lime-400/10"
          onClick={() =>
            setVisibleLineCount((currentCount) =>
              Math.min(currentCount + 1, EXPENSE_LINES.length),
            )
          }
          type="button"
        >
          Add Expense Line
        </button>
      ) : null}
    </section>
  );
}
