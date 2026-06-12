"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import AdminFormButton from "@/app/admin/admin-form-button";
import {
  deleteProjectExpense,
  updateProjectExpense,
} from "@/lib/project-expenses";
import {
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_STATUS_OPTIONS,
} from "@/lib/project-expense-options";
import type { ProjectExpense } from "@/lib/project-expense-utils";
import {
  formatCurrency,
  formatExpenseCategory,
  formatExpenseStatus,
} from "@/lib/project-expense-utils";
import { formatDisplayDate } from "@/lib/project-management-utils";

export default function ProjectExpenseModals({
  projectId,
  expenses,
  canManageExpenses,
  isProjectCompleted,
}: {
  projectId: string;
  expenses: ProjectExpense[];
  canManageExpenses: boolean;
  isProjectCompleted: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeExpenseId = searchParams.get("expense");
  const activeExpense =
    expenses.find((expense) => expense.id === activeExpenseId) ?? null;

  useEffect(() => {
    if (!activeExpense) return;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [activeExpense]);

  if (!activeExpense) {
    return null;
  }

  const canEdit = canManageExpenses && !isProjectCompleted;
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
              Expense Workspace
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-neutral-100">
              {activeExpense.description}
            </h2>
            <p className="mt-2 text-sm text-neutral-400">
              {formatExpenseCategory(activeExpense.category)} ·{" "}
              {formatExpenseStatus(activeExpense.status)} ·{" "}
              {formatCurrency(activeExpense.amount)} ·{" "}
              {formatDisplayDate(activeExpense.expenseDate)}
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
                Expense Details
              </h3>
              <form
                action={updateProjectExpense}
                className="mt-4 grid gap-4 md:grid-cols-2"
              >
                <input type="hidden" name="id" value={activeExpense.id} />
                <input type="hidden" name="projectId" value={projectId} />
                <ModalField
                  label="Description"
                  name="description"
                  required
                  defaultValue={activeExpense.description}
                />
                <ModalSelectField
                  label="Category"
                  name="category"
                  defaultValue={activeExpense.category}
                  options={EXPENSE_CATEGORY_OPTIONS}
                />
                <ModalField
                  label="Amount"
                  name="amount"
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  defaultValue={String(activeExpense.amount)}
                />
                <ModalField
                  label="Expense date"
                  name="expenseDate"
                  type="date"
                  required
                  defaultValue={activeExpense.expenseDate}
                />
                <ModalField
                  label="Vendor"
                  name="vendor"
                  defaultValue={activeExpense.vendor}
                />
                <ModalSelectField
                  label="Status"
                  name="status"
                  defaultValue={activeExpense.status}
                  options={EXPENSE_STATUS_OPTIONS}
                />
                <label className="block text-sm font-medium text-neutral-300 md:col-span-2">
                  Notes
                  <textarea
                    name="notes"
                    rows={4}
                    defaultValue={activeExpense.notes}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none ring-lime-400 transition focus:ring-2"
                  />
                </label>
                <div className="flex justify-end md:col-span-2">
                  <AdminFormButton pendingLabel="Saving...">Save Expense</AdminFormButton>
                </div>
              </form>
              <form action={deleteProjectExpense} className="mt-3 flex justify-end">
                <input type="hidden" name="id" value={activeExpense.id} />
                <input type="hidden" name="projectId" value={projectId} />
                <AdminFormButton pendingLabel="Deleting..." variant="danger" className="rounded-lg px-3 py-2">
                  Delete Expense
                </AdminFormButton>
              </form>
            </section>
          ) : (
            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Expense Details
              </h3>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <DetailItem label="Amount" value={formatCurrency(activeExpense.amount)} />
                <DetailItem
                  label="Category"
                  value={formatExpenseCategory(activeExpense.category)}
                />
                <DetailItem
                  label="Status"
                  value={formatExpenseStatus(activeExpense.status)}
                />
                <DetailItem
                  label="Expense Date"
                  value={formatDisplayDate(activeExpense.expenseDate)}
                />
                <DetailItem label="Vendor" value={activeExpense.vendor || "—"} />
                <DetailItem
                  label="Notes"
                  value={activeExpense.notes || "—"}
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