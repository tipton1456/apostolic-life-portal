"use client";

import { useState } from "react";
import ProjectExpenseGrid from "@/app/projects/project-expense-grid";
import ProjectRevenueGrid from "@/app/projects/project-revenue-grid";
import type { ProjectExpense } from "@/lib/project-expense-utils";
import type { ProjectRevenue } from "@/lib/project-revenue-utils";

type FinancialView = "expenses" | "revenue";

export default function ProjectFinancialsSection({
  expenses,
  revenue,
  projectId,
  canManageFinancials,
  isProjectCompleted,
}: {
  expenses: ProjectExpense[];
  revenue: ProjectRevenue[];
  projectId: string;
  canManageFinancials: boolean;
  isProjectCompleted: boolean;
}) {
  const [view, setView] = useState<FinancialView>("expenses");

  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-lime-200">Financials</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Track project expenses and revenue in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "expenses", label: "Expenses" },
              { id: "revenue", label: "Revenue" },
            ] as const
          ).map((option) => {
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
        </div>
      </div>

      {view === "expenses" ? (
        <ProjectExpenseGrid
          canManageExpenses={canManageFinancials}
          expenses={expenses}
          isProjectCompleted={isProjectCompleted}
          projectId={projectId}
        />
      ) : (
        <ProjectRevenueGrid
          canManageRevenue={canManageFinancials}
          isProjectCompleted={isProjectCompleted}
          projectId={projectId}
          revenue={revenue}
        />
      )}
    </section>
  );
}