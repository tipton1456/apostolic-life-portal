import {
  calculateProjectExpenseStats,
  formatCurrency,
  type ProjectExpense,
} from "@/lib/project-expense-utils";
import {
  calculateProjectRevenueStats,
  type ProjectRevenue,
} from "@/lib/project-revenue-utils";

export type ProjectFinancialStats = {
  grossRevenue: number;
  committedRevenue: number;
  expenses: number;
  outstandingExpenses: number;
  netRevenue: number;
  expenseStats: ReturnType<typeof calculateProjectExpenseStats>;
  revenueStats: ReturnType<typeof calculateProjectRevenueStats>;
};

export function calculateProjectFinancialStats(
  expenses: ProjectExpense[],
  revenue: ProjectRevenue[],
): ProjectFinancialStats {
  const expenseStats = calculateProjectExpenseStats(expenses);
  const revenueStats = calculateProjectRevenueStats(revenue);

  const grossRevenue = revenueStats.totalAmount;
  const committedRevenue = revenueStats.committedAmount;
  const expensesTotal = expenseStats.totalAmount;
  const outstandingExpenses = expenseStats.outstandingAmount;
  const netRevenue =
    grossRevenue - expensesTotal - committedRevenue + outstandingExpenses;

  return {
    grossRevenue,
    committedRevenue,
    expenses: expensesTotal,
    outstandingExpenses,
    netRevenue,
    expenseStats,
    revenueStats,
  };
}

export { formatCurrency };