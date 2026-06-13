export type ExpenseCategory =
  | "labor"
  | "materials"
  | "equipment"
  | "travel"
  | "fees"
  | "other";

export type ExpenseStatus = "committed" | "paid" | "cancelled";

export type ProjectExpense = {
  id: string;
  projectId: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  vendor: string;
  notes: string;
  status: ExpenseStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** Cognito Forms entry ID (e.g. "3-12345") when imported from a reimbursement that specified a project. */
  cognitoEntryId?: string | null;
  /** 'manual' | 'cognito-reimbursement' | 'portal-reimbursement' */
  source?: string;
};

export type ProjectExpenseStats = {
  totalExpenses: number;
  activeExpenses: number;
  totalAmount: number;
  paidAmount: number;
  committedAmount: number;
  outstandingAmount: number;
};

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  labor: "Labor",
  materials: "Materials",
  equipment: "Equipment",
  travel: "Travel",
  fees: "Fees",
  other: "Other",
};

const STATUS_LABELS: Record<ExpenseStatus, string> = {
  committed: "Committed",
  paid: "Paid",
  cancelled: "Cancelled",
};

export function formatExpenseCategory(category: ExpenseCategory) {
  return CATEGORY_LABELS[category];
}

export function formatExpenseStatus(status: ExpenseStatus) {
  return STATUS_LABELS[status];
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function calculateProjectExpenseStats(
  expenses: ProjectExpense[],
): ProjectExpenseStats {
  const activeExpenses = expenses.filter((expense) => expense.status !== "cancelled");
  const sumByStatus = (status: ExpenseStatus) =>
    activeExpenses
      .filter((expense) => expense.status === status)
      .reduce((total, expense) => total + expense.amount, 0);

  const paidAmount = sumByStatus("paid");
  const committedAmount = sumByStatus("committed");
  const totalAmount = activeExpenses.reduce((total, expense) => total + expense.amount, 0);

  return {
    totalExpenses: expenses.length,
    activeExpenses: activeExpenses.length,
    totalAmount,
    paidAmount,
    committedAmount,
    outstandingAmount: committedAmount,
  };
}