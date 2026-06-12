"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import AdminFormButton from "@/app/admin/admin-form-button";
import { formatCurrency } from "@/lib/project-expense-utils";
import {
  REVENUE_CATEGORY_OPTIONS,
  REVENUE_STATUS_OPTIONS,
} from "@/lib/project-revenue-options";
import {
  deleteProjectRevenue,
  updateProjectRevenue,
} from "@/lib/project-revenue";
import type { ProjectRevenue } from "@/lib/project-revenue-utils";
import {
  formatRevenueCategory,
  formatRevenueStatus,
} from "@/lib/project-revenue-utils";
import { formatDisplayDate } from "@/lib/project-management-utils";

export default function ProjectRevenueModals({
  projectId,
  revenue,
  canManageRevenue,
  isProjectCompleted,
}: {
  projectId: string;
  revenue: ProjectRevenue[];
  canManageRevenue: boolean;
  isProjectCompleted: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeRevenueId = searchParams.get("revenue");
  const activeRevenue =
    revenue.find((entry) => entry.id === activeRevenueId) ?? null;

  useEffect(() => {
    if (!activeRevenue) return;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [activeRevenue]);

  if (!activeRevenue) {
    return null;
  }

  const canEdit = canManageRevenue && !isProjectCompleted;
  const closeHref = `/projects/${projectId}`;

  function closeAll() {
    router.push(closeHref);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 p-4 backdrop-blur-sm"
      onClick={closeAll}
    >
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-neutral-950/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-lime-400">
              Income Workspace
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-neutral-100">
              {activeRevenue.description}
            </h2>
            <p className="mt-2 text-sm text-neutral-400">
              {formatRevenueCategory(activeRevenue.category)} ·{" "}
              {formatRevenueStatus(activeRevenue.status)} ·{" "}
              {formatCurrency(activeRevenue.amount)} ·{" "}
              {formatDisplayDate(activeRevenue.revenueDate)}
            </p>
          </div>
          <button
            type="button"
            onClick={closeAll}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-neutral-300 transition hover:bg-white/10"
          >
            Close
          </button>
        </div>

        <div className="space-y-6 px-5 py-5">
          {canEdit ? (
            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Income Details
              </h3>
              <form
                action={updateProjectRevenue}
                className="mt-4 grid gap-4 md:grid-cols-2"
              >
                <input type="hidden" name="id" value={activeRevenue.id} />
                <input type="hidden" name="projectId" value={projectId} />
                <ModalField
                  label="Description"
                  name="description"
                  required
                  defaultValue={activeRevenue.description}
                />
                <ModalSelectField
                  label="Category"
                  name="category"
                  defaultValue={activeRevenue.category}
                  options={REVENUE_CATEGORY_OPTIONS}
                />
                <ModalField
                  label="Amount"
                  name="amount"
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  defaultValue={String(activeRevenue.amount)}
                />
                <ModalField
                  label="Revenue date"
                  name="revenueDate"
                  type="date"
                  required
                  defaultValue={activeRevenue.revenueDate}
                />
                <ModalField
                  label="Source"
                  name="source"
                  defaultValue={activeRevenue.source}
                />
                <ModalSelectField
                  label="Status"
                  name="status"
                  defaultValue={activeRevenue.status}
                  options={REVENUE_STATUS_OPTIONS}
                />
                <label className="block text-sm font-medium text-neutral-300 md:col-span-2">
                  Notes
                  <textarea
                    name="notes"
                    rows={4}
                    defaultValue={activeRevenue.notes}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none ring-lime-400 transition focus:ring-2"
                  />
                </label>
                <div className="flex justify-end md:col-span-2">
                  <AdminFormButton pendingLabel="Saving...">Save Income</AdminFormButton>
                </div>
              </form>
              <form action={deleteProjectRevenue} className="mt-3 flex justify-end">
                <input type="hidden" name="id" value={activeRevenue.id} />
                <input type="hidden" name="projectId" value={projectId} />
                <AdminFormButton pendingLabel="Deleting..." variant="danger" className="rounded-lg px-3 py-2">
                  Delete Income
                </AdminFormButton>
              </form>
            </section>
          ) : (
            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Income Details
              </h3>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <DetailItem label="Amount" value={formatCurrency(activeRevenue.amount)} />
                <DetailItem
                  label="Category"
                  value={formatRevenueCategory(activeRevenue.category)}
                />
                <DetailItem
                  label="Status"
                  value={formatRevenueStatus(activeRevenue.status)}
                />
                <DetailItem
                  label="Revenue Date"
                  value={formatDisplayDate(activeRevenue.revenueDate)}
                />
                <DetailItem label="Source" value={activeRevenue.source || "—"} />
                <DetailItem
                  label="Notes"
                  value={activeRevenue.notes || "—"}
                  className="sm:col-span-2"
                />
              </dl>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function ModalField({
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

function ModalSelectField({
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

function DetailItem({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs uppercase tracking-[0.18em] text-neutral-500">{label}</dt>
      <dd className="mt-2 text-sm text-neutral-200">{value}</dd>
    </div>
  );
}