"use client";

import { useMemo, useState } from "react";
import AdminFormButton from "@/app/admin/admin-form-button";
import ExpenseListTable from "@/app/projects/expense-list-table";
import { createProjectExpense } from "@/lib/project-expenses";
import {
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_STATUS_OPTIONS,
} from "@/lib/project-expense-options";
import type { ProjectExpense } from "@/lib/project-expense-utils";
import { formatCurrency } from "@/lib/project-expense-utils";

type ExpenseView = "active" | "planned" | "committed" | "paid" | "cancelled" | "all";

const EXPENSE_VIEWS: Array<{ id: ExpenseView; label: string }> = [
  { id: "active", label: "Active" },
  { id: "planned", label: "Planned" },
  { id: "committed", label: "Committed" },
  { id: "paid", label: "Paid" },
  { id: "cancelled", label: "Cancelled" },
  { id: "all", label: "All Costs" },
];

const EMPTY_MESSAGES: Record<ExpenseView, string> = {
  active: "No active expenses. Add a cost to start tracking project spending.",
  planned: "No planned expenses.",
  committed: "No committed expenses.",
  paid: "No paid expenses yet.",
  cancelled: "No cancelled expenses.",
  all: "No expenses have been added to this project yet.",
};

export default function ProjectExpenseGrid({
  expenses,
  projectId,
  canManageExpenses,
  isProjectCompleted,
}: {
  expenses: ProjectExpense[];
  projectId: string;
  canManageExpenses: boolean;
  isProjectCompleted: boolean;
}) {
  const [view, setView] = useState<ExpenseView>("active");
  const [showAddExpense, setShowAddExpense] = useState(false);

  const filteredExpenses = useMemo(
    () => filterExpenses(expenses, view),
    [expenses, view],
  );
  const canAddExpenses = canManageExpenses && !isProjectCompleted;
  const viewTotal = filteredExpenses
    .filter((expense) => expense.status !== "cancelled" || view === "cancelled" || view === "all")
    .reduce((total, expense) => {
      if (expense.status === "cancelled" && view !== "cancelled" && view !== "all") {
        return total;
      }

      return total + expense.amount;
    }, 0);

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-lime-200">Project Costs</h2>
          <p className="mt-1 text-sm text-neutral-400">
            {filteredExpenses.length} expense
            {filteredExpenses.length === 1 ? "" : "s"} shown
            {view !== "cancelled" ? ` · ${formatCurrency(viewTotal)} total` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {EXPENSE_VIEWS.map((option) => {
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
          {canAddExpenses ? (
            <button
              type="button"
              onClick={() => setShowAddExpense((current) => !current)}
              className="rounded-lg bg-lime-400 px-3 py-2 text-xs font-semibold text-neutral-950 transition hover:bg-lime-300"
            >
              {showAddExpense ? "Close" : "New Expense"}
            </button>
          ) : null}
        </div>
      </div>

      {showAddExpense && canAddExpenses ? (
        <form
          action={createProjectExpense}
          className="grid gap-4 border-b border-white/10 px-5 py-5 md:grid-cols-2 xl:grid-cols-[1.2fr_0.8fr_0.7fr_0.7fr_0.8fr_0.8fr_auto]"
        >
          <input type="hidden" name="projectId" value={projectId} />
          <Field label="Description" name="description" required />
          <SelectField
            label="Category"
            name="category"
            defaultValue="other"
            options={EXPENSE_CATEGORY_OPTIONS}
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
            label="Expense date"
            name="expenseDate"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
          <Field label="Vendor" name="vendor" />
          <SelectField
            label="Status"
            name="status"
            defaultValue="planned"
            options={EXPENSE_STATUS_OPTIONS}
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
            Add Expense
          </AdminFormButton>
        </form>
      ) : null}

      {filteredExpenses.length > 0 ? (
        <ExpenseListTable
          canManageExpenses={canManageExpenses}
          expenses={filteredExpenses}
          projectId={projectId}
        />
      ) : (
        <p className="px-5 py-4 text-sm text-neutral-400">{EMPTY_MESSAGES[view]}</p>
      )}
    </section>
  );
}

function filterExpenses(expenses: ProjectExpense[], view: ExpenseView) {
  switch (view) {
    case "active":
      return expenses.filter((expense) => expense.status !== "cancelled");
    case "planned":
      return expenses.filter((expense) => expense.status === "planned");
    case "committed":
      return expenses.filter((expense) => expense.status === "committed");
    case "paid":
      return expenses.filter((expense) => expense.status === "paid");
    case "cancelled":
      return expenses.filter((expense) => expense.status === "cancelled");
    case "all":
      return expenses;
    default:
      return expenses;
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