"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ExpenseStatus, ProjectExpense } from "@/lib/project-expense-utils";
import {
  formatCurrency,
  formatExpenseCategory,
  formatExpenseStatus,
} from "@/lib/project-expense-utils";
import { formatDisplayDate } from "@/lib/project-management-utils";

const EXPENSE_GRID_COLUMNS =
  "grid-cols-[minmax(0,1.4fr)_0.8fr_0.7fr_0.7fr_0.8fr_auto]";

type SortKey = "description" | "category" | "amount" | "date" | "status";
type SortDirection = "asc" | "desc";

const STATUS_RANK: Record<ExpenseStatus, number> = {
  planned: 0,
  committed: 1,
  paid: 2,
  cancelled: 3,
};

export default function ExpenseListTable({
  expenses,
  projectId,
  canManageExpenses,
}: {
  expenses: ProjectExpense[];
  projectId: string;
  canManageExpenses: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedExpenses = useMemo(
    () => sortExpenses(expenses, sortKey, sortDirection),
    [expenses, sortKey, sortDirection],
  );

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextKey === "date" || nextKey === "amount" ? "desc" : "asc");
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div
          className={`grid ${EXPENSE_GRID_COLUMNS} items-center gap-x-3 border-b border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500`}
        >
          <SortableHeader
            active={sortKey === "description"}
            direction={sortDirection}
            label="Expense"
            onClick={() => handleSort("description")}
          />
          <SortableHeader
            active={sortKey === "category"}
            direction={sortDirection}
            label="Category"
            onClick={() => handleSort("category")}
          />
          <SortableHeader
            active={sortKey === "amount"}
            align="right"
            direction={sortDirection}
            label="Amount"
            onClick={() => handleSort("amount")}
          />
          <SortableHeader
            active={sortKey === "date"}
            align="right"
            direction={sortDirection}
            label="Date"
            onClick={() => handleSort("date")}
          />
          <SortableHeader
            active={sortKey === "status"}
            direction={sortDirection}
            label="Status"
            onClick={() => handleSort("status")}
          />
          <span className="text-right">Action</span>
        </div>
        <div className="divide-y divide-white/10">
          {sortedExpenses.map((expense) => (
            <div
              key={expense.id}
              className={`grid ${EXPENSE_GRID_COLUMNS} items-center gap-x-3 px-4 py-3 text-sm transition hover:bg-white/[0.04]`}
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-neutral-100">
                  {expense.description}
                </p>
                {expense.vendor ? (
                  <p className="mt-1 truncate text-xs text-neutral-500">
                    {expense.vendor}
                  </p>
                ) : null}
              </div>
              <p className="truncate text-neutral-300">
                {formatExpenseCategory(expense.category)}
              </p>
              <p className="text-right font-medium tabular-nums text-neutral-100">
                {formatCurrency(expense.amount)}
              </p>
              <p className="text-right text-neutral-300">
                {formatDisplayDate(expense.expenseDate)}
              </p>
              <ExpenseStatusBadge status={expense.status} />
              <div className="text-right">
                <Link
                  href={`/projects/${projectId}?expense=${expense.id}`}
                  className="inline-flex rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-lime-300 transition hover:border-lime-300/60 hover:bg-lime-400/10"
                >
                  {canManageExpenses ? "Update Expense" : "View Expense"}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  active,
  direction,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        align === "right"
          ? "inline-flex items-center justify-end gap-1 text-right transition hover:text-lime-300"
          : "inline-flex items-center gap-1 text-left transition hover:text-lime-300"
      }
    >
      <span>{label}</span>
      <span className="text-[9px] text-lime-400">
        {active ? (direction === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </button>
  );
}

function sortExpenses(
  expenses: ProjectExpense[],
  sortKey: SortKey,
  sortDirection: SortDirection,
) {
  const multiplier = sortDirection === "asc" ? 1 : -1;

  return [...expenses].sort((left, right) => {
    const comparison = compareExpenses(left, right, sortKey);
    return comparison * multiplier;
  });
}

function compareExpenses(
  left: ProjectExpense,
  right: ProjectExpense,
  sortKey: SortKey,
) {
  switch (sortKey) {
    case "description":
      return left.description.localeCompare(right.description, undefined, {
        sensitivity: "base",
      });
    case "category":
      return formatExpenseCategory(left.category).localeCompare(
        formatExpenseCategory(right.category),
        undefined,
        { sensitivity: "base" },
      );
    case "amount":
      return left.amount - right.amount;
    case "date":
      return Date.parse(left.expenseDate) - Date.parse(right.expenseDate);
    case "status":
      return STATUS_RANK[left.status] - STATUS_RANK[right.status];
    default:
      return 0;
  }
}

function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  const styles: Record<ExpenseStatus, string> = {
    planned: "border-white/10 bg-white/[0.04] text-neutral-300",
    committed: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    paid: "border-lime-400/30 bg-lime-400/10 text-lime-200",
    cancelled: "border-red-400/30 bg-red-400/10 text-red-200",
  };

  return (
    <span
      className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {formatExpenseStatus(status)}
    </span>
  );
}