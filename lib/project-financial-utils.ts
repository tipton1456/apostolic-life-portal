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
  totalRevenue: number;
  totalExpense: number;
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

  const totalRevenue = revenueStats.totalAmount;
  const totalExpense = expenseStats.totalAmount;
  const outstandingExpenses = expenseStats.outstandingAmount;
  const netRevenue = totalRevenue - totalExpense + outstandingExpenses;

  return {
    totalRevenue,
    totalExpense,
    outstandingExpenses,
    netRevenue,
    expenseStats,
    revenueStats,
  };
}

export { formatCurrency };