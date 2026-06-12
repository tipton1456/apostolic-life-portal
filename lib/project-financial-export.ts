import ExcelJS from "exceljs";
import {
  normalizeProjectRow,
  PROJECT_SELECT_WITH_ARCHIVE,
} from "@/lib/project-db-compat";
import { canUserViewProject } from "@/lib/project-access";
import type { ProjectExpense } from "@/lib/project-expense-utils";
import type { ProjectRevenue } from "@/lib/project-revenue-utils";
import { getCurrentPortalUser } from "@/lib/portal-users";
import { createClient } from "@/lib/supabase/server";

type FinancialExportRow = {
  date: string;
  type: "Expense" | "Income";
  description: string;
  status: string;
  amount: number;
  sortTimestamp: number;
};

export class ProjectFinancialExportError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function buildProjectFinancialExportWorkbook(projectId: string) {
  const context = await loadProjectFinancialExportContext(projectId);
  const buffer = await renderProjectFinancialExportWorkbook(context);
  const fileName = `${sanitizeFileName(context.projectName)} - Financial Details.xlsx`;

  return { buffer, fileName };
}

async function loadProjectFinancialExportContext(projectId: string) {
  const currentUser = await getCurrentPortalUser();

  if (!currentUser) {
    throw new ProjectFinancialExportError(
      "You must be signed in to download this export.",
      401,
    );
  }

  const canView = await canUserViewProject(projectId, currentUser);

  if (!canView) {
    throw new ProjectFinancialExportError("You do not have access to this project.", 403);
  }

  const supabase = await createClient();
  const [
    { data: projectRow, error: projectError },
    { data: expenseRows, error: expenseError },
    { data: revenueRows, error: revenueError },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select(PROJECT_SELECT_WITH_ARCHIVE)
      .eq("id", projectId)
      .maybeSingle(),
    supabase
      .from("project_expenses")
      .select("description,amount,expense_date,status")
      .eq("project_id", projectId)
      .neq("status", "cancelled")
      .order("expense_date", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("project_revenue")
      .select("description,amount,revenue_date,status")
      .eq("project_id", projectId)
      .neq("status", "cancelled")
      .order("revenue_date", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (projectError || !projectRow) {
    throw new ProjectFinancialExportError("Project not found.", 404);
  }

  if (expenseError) {
    throw new ProjectFinancialExportError("Unable to load project expenses.", 500);
  }

  if (revenueError) {
    throw new ProjectFinancialExportError("Unable to load project revenue.", 500);
  }

  const project = normalizeProjectRow(projectRow);
  const rows = buildFinancialExportRows(
    (expenseRows ?? []) as Array<{
      description: string;
      amount: number | string;
      expense_date: string;
      status: ProjectExpense["status"];
    }>,
    (revenueRows ?? []) as Array<{
      description: string;
      amount: number | string;
      revenue_date: string;
      status: ProjectRevenue["status"];
    }>,
  );

  return {
    projectName: project.name,
    rows,
  };
}

function buildFinancialExportRows(
  expenses: Array<{
    description: string;
    amount: number | string;
    expense_date: string;
    status: ProjectExpense["status"];
  }>,
  revenue: Array<{
    description: string;
    amount: number | string;
    revenue_date: string;
    status: ProjectRevenue["status"];
  }>,
) {
  const expenseRows: FinancialExportRow[] = expenses.map((expense) => ({
    date: expense.expense_date,
    type: "Expense",
    description: expense.description,
    status: formatExpenseExportStatus(expense.status),
    amount: -Math.abs(Number(expense.amount)),
    sortTimestamp: Date.parse(expense.expense_date),
  }));

  const revenueRows: FinancialExportRow[] = revenue.map((entry) => ({
    date: entry.revenue_date,
    type: "Income",
    description: entry.description,
    status: formatRevenueExportStatus(entry.status),
    amount: Math.abs(Number(entry.amount)),
    sortTimestamp: Date.parse(entry.revenue_date),
  }));

  return [...expenseRows, ...revenueRows].sort((left, right) => {
    if (left.sortTimestamp !== right.sortTimestamp) {
      return left.sortTimestamp - right.sortTimestamp;
    }

    if (left.type !== right.type) {
      return left.type.localeCompare(right.type);
    }

    return left.description.localeCompare(right.description);
  });
}

function formatExpenseExportStatus(status: ProjectExpense["status"]) {
  if (status === "paid") return "Paid";
  return "Outstanding";
}

function formatRevenueExportStatus(status: ProjectRevenue["status"]) {
  if (status === "received") return "Received";
  return "Committed";
}

async function renderProjectFinancialExportWorkbook(context: {
  projectName: string;
  rows: FinancialExportRow[];
}) {
  const workbook = new ExcelJS.Workbook();
  const detailsSheet = workbook.addWorksheet("Details");
  const summarySheet = workbook.addWorksheet("Summary");

  detailsSheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Type", key: "type", width: 12 },
    { header: "Description", key: "description", width: 42 },
    { header: "Status", key: "status", width: 16 },
    { header: "Amount", key: "amount", width: 14 },
  ];

  for (const row of context.rows) {
    detailsSheet.addRow({
      date: row.date,
      type: row.type,
      description: row.description,
      status: row.status,
      amount: row.amount,
    });
  }

  const lastDetailsRow = Math.max(detailsSheet.rowCount, 2);
  const amountColumn = "E";
  const typeColumn = "B";
  const statusColumn = "D";
  const detailsRange = `Details!$${amountColumn}$2:$${amountColumn}$${lastDetailsRow}`;
  const typeRange = `Details!$${typeColumn}$2:$${typeColumn}$${lastDetailsRow}`;
  const statusRange = `Details!$${statusColumn}$2:$${statusColumn}$${lastDetailsRow}`;

  detailsSheet.getRow(1).font = { name: "Arial", bold: true };
  detailsSheet.getColumn("amount").numFmt = "$#,##0.00;($#,##0.00);-";
  detailsSheet.getColumn("date").numFmt = "mm/dd/yyyy";

  for (let rowIndex = 2; rowIndex <= lastDetailsRow; rowIndex += 1) {
    const dateCell = detailsSheet.getCell(`A${rowIndex}`);
    if (dateCell.value) {
      dateCell.value = new Date(`${dateCell.value}T12:00:00`);
    }
  }

  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 28 },
    { header: "Amount", key: "amount", width: 16 },
  ];

  summarySheet.getRow(1).font = { name: "Arial", bold: true };
  summarySheet.getColumn("amount").numFmt = "$#,##0.00;($#,##0.00);-";

  summarySheet.addRow({ metric: "Total Expenses" });
  summarySheet.addRow({ metric: "Total Outstanding Expenses" });
  summarySheet.addRow({ metric: "Total Received Revenue" });
  summarySheet.addRow({ metric: "Net Revenue" });

  summarySheet.getCell("B2").value = {
    formula: `-SUMIFS(${detailsRange},${typeRange},"Expense",${statusRange},"Paid")`,
  };
  summarySheet.getCell("B3").value = {
    formula: `-SUMIFS(${detailsRange},${typeRange},"Expense",${statusRange},"Outstanding")`,
  };
  summarySheet.getCell("B4").value = {
    formula: `SUMIFS(${detailsRange},${typeRange},"Income",${statusRange},"Received")`,
  };
  summarySheet.getCell("B5").value = {
    formula: `SUMIF(${typeRange},"Income",${detailsRange})-B2+B3-SUMIFS(${detailsRange},${typeRange},"Income",${statusRange},"Committed")`,
  };

  summarySheet.getCell("B5").font = { name: "Arial", bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "").trim() || "Project";
}