export const EXPENSE_CATEGORY_OPTIONS = [
  { value: "labor", label: "Labor" },
  { value: "materials", label: "Materials" },
  { value: "equipment", label: "Equipment" },
  { value: "travel", label: "Travel" },
  { value: "fees", label: "Fees" },
  { value: "other", label: "Other" },
] as const;

export const EXPENSE_STATUS_OPTIONS = [
  { value: "committed", label: "Committed" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
] as const;