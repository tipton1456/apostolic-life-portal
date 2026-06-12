"use client";

import { useMemo, useState } from "react";
import AdminFormButton from "@/app/admin/admin-form-button";
import RevenueListTable from "@/app/projects/revenue-list-table";
import { formatCurrency } from "@/lib/project-expense-utils";
import {
  REVENUE_CATEGORY_OPTIONS,
  REVENUE_STATUS_OPTIONS,
} from "@/lib/project-revenue-options";
import { createProjectRevenue } from "@/lib/project-revenue";
import type { ProjectRevenue } from "@/lib/project-revenue-utils";

type RevenueView = "active" | "committed" | "received" | "cancelled" | "all";

const REVENUE_VIEWS: Array<{ id: RevenueView; label: string }> = [
  { id: "active", label: "Active" },
  { id: "committed", label: "Committed" },
  { id: "received", label: "Received" },
  { id: "cancelled", label: "Cancelled" },
  { id: "all", label: "All Income" },
];

const EMPTY_MESSAGES: Record<RevenueView, string> = {
  active: "No active income entries. Add revenue to start tracking project income.",
  committed: "No committed income.",
  received: "No received income yet.",
  cancelled: "No cancelled income.",
  all: "No revenue has been added to this project yet.",
};

export default function ProjectRevenueGrid({
  revenue,
  projectId,
  canManageRevenue,
  isProjectCompleted,
}: {
  revenue: ProjectRevenue[];
  projectId: string;
  canManageRevenue: boolean;
  isProjectCompleted: boolean;
}) {
  const [view, setView] = useState<RevenueView>("active");
  const [showAddRevenue, setShowAddRevenue] = useState(false);

  const filteredRevenue = useMemo(
    () => filterRevenue(revenue, view),
    [revenue, view],
  );
  const canAddRevenue = canManageRevenue && !isProjectCompleted;
  const viewTotal = filteredRevenue
    .filter((entry) => entry.status !== "cancelled" || view === "cancelled" || view === "all")
    .reduce((total, entry) => {
      if (entry.status === "cancelled" && view !== "cancelled" && view !== "all") {
        return total;
      }

      return total + entry.amount;
    }, 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-lime-200">Revenue</h2>
          <p className="mt-1 text-sm text-neutral-400">
            {filteredRevenue.length} entr{filteredRevenue.length === 1 ? "y" : "ies"} shown
            {view !== "cancelled" ? ` · ${formatCurrency(viewTotal)} total` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {REVENUE_VIEWS.map((option) => {
            const isActive = view === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setView(option.id)}
                className={
                  isActive
                    ? "rounded-lg bg-lime-400 px-3 py-2 text-xs font-semibold text-neutral-950 transition"
                    : "rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-neutral-300 transition hover:border-lime-300/40 hover:bg-lime-400/10 hover:text-lime-200"
                }
              >
                {option.label}
              </button>
            );
          })}
          {canAddRevenue ? (
            <button
              type="button"
              onClick={() => setShowAddRevenue((current) => !current)}
              className="rounded-lg bg-lime-400 px-3 py-2 text-xs font-semibold text-neutral-950 transition hover:bg-lime-300"
            >
              {showAddRevenue ? "Close" : "New Income"}
            </button>
          ) : null}
        </div>
      </div>

      {showAddRevenue && canAddRevenue ? (
        <form
          action={createProjectRevenue}
          className="grid gap-4 border-b border-white/10 px-5 py-5 md:grid-cols-2 xl:grid-cols-[1.2fr_0.8fr_0.7fr_0.7fr_0.8fr_0.8fr_auto]"
        >
          <input type="hidden" name="projectId" value={projectId} />
          <Field label="Description" name="description" required />
          <SelectField
            label="Category"
            name="category"
            defaultValue="other"
            options={REVENUE_CATEGORY_OPTIONS}
          />
          <Field
            label="Amount"
            name="amount"
            type="number"
            required
            step="0.01"
            min="0"
          />
          <Field
            label="Revenue date"
            name="revenueDate"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
          <Field label="Source" name="source" />
          <SelectField
            label="Status"
            name="status"
            defaultValue="committed"
            options={REVENUE_STATUS_OPTIONS}
          />
          <div className="md:col-span-2 xl:col-span-6">
            <label className="block text-sm font-medium text-neutral-300">
              Notes
              <textarea
                name="notes"
                rows={2}
                className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
              />
            </label>
          </div>
          <AdminFormButton pendingLabel="Adding..." className="md:col-start-2 xl:col-start-7">
            Add Income
          </AdminFormButton>
        </form>
      ) : null}

      {filteredRevenue.length > 0 ? (
        <RevenueListTable
          canManageRevenue={canManageRevenue}
          projectId={projectId}
          revenue={filteredRevenue}
        />
      ) : (
        <p className="px-5 py-4 text-sm text-neutral-400">{EMPTY_MESSAGES[view]}</p>
      )}
    </section>
  );
}

function filterRevenue(revenue: ProjectRevenue[], view: RevenueView) {
  switch (view) {
    case "active":
      return revenue.filter((entry) => entry.status !== "cancelled");
    case "committed":
      return revenue.filter((entry) => entry.status === "committed");
    case "received":
      return revenue.filter((entry) => entry.status === "received");
    case "cancelled":
      return revenue.filter((entry) => entry.status === "cancelled");
    case "all":
      return revenue;
    default:
      return revenue;
  }
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  step,
  min,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  step?: string;
  min?: string;
}) {
  return (
    <label className="block text-sm font-medium text-neutral-300">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        step={step}
        min={min}
        className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <label className="block text-sm font-medium text-neutral-300">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}