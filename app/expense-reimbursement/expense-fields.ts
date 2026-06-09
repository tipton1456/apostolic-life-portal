export const REPORT_TYPE_FIELD =
  "SelectTheTypeOfReportDoNotSelectMoreThanOneTypePerSubmission";

export const REPORT_TYPES = [
  "Requisition",
  "Deposit",
  "Expense Report",
  "Reimbursement",
  "Admin Reimbursement",
] as const;

export const EXPENSE_LINES = [
  { amount: "Amount", department: "Department2", description: "Text" },
  { amount: "Amount2", department: "Department3", description: "Description" },
  { amount: "Amount3", department: "Department4", description: "Description2" },
  { amount: "Amount4", department: "Department5", description: "Description3" },
  { amount: "Amount5", department: "Department6", description: "Description4" },
  { amount: "Amount6", department: "Department7", description: "Description5" },
  { amount: "Amount7", department: "Department", description: "Description6" },
] as const;
