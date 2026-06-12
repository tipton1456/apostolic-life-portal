"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type {
  ExpenseCategory,
  ExpenseStatus,
  ProjectExpense,
} from "@/lib/project-expense-utils";
import { isPortalProjectManager } from "@/lib/portal-project-roles";
import { getCurrentPortalUser } from "@/lib/portal-users";
import { createClient } from "@/lib/supabase/server";

export type {
  ExpenseCategory,
  ExpenseStatus,
  ProjectExpense,
  ProjectExpenseStats,
} from "@/lib/project-expense-utils";

type ProjectExpenseRow = {
  id: string;
  project_id: string;
  description: string;
  category: ExpenseCategory;
  amount: number | string;
  expense_date: string;
  vendor: string;
  notes: string;
  status: ExpenseStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
};

const EXPENSE_CATEGORIES = new Set<ExpenseCategory>([
  "labor",
  "materials",
  "equipment",
  "travel",
  "fees",
  "other",
]);

const EXPENSE_STATUSES = new Set<ExpenseStatus>([
  "committed",
  "paid",
  "cancelled",
]);

export async function listProjectExpenses(
  projectId: string,
): Promise<ProjectExpense[]> {
  await requireProjectExpenseAccess(projectId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_expenses")
    .select(
      "id,project_id,description,category,amount,expense_date,vendor,notes,status,created_by,created_at,updated_at",
    )
    .eq("project_id", projectId)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Project expenses lookup failed:", error);
    throw new Error("Unable to load project expenses.");
  }

  return ((data ?? []) as ProjectExpenseRow[]).map(mapExpense);
}

export async function createProjectExpense(formData: FormData) {
  const currentUser = await requireProjectExpenseManager();
  const projectId = String(formData.get("projectId") || "");
  const description = normalizeText(formData.get("description"));
  const category = parseExpenseCategory(formData.get("category"));
  const amount = parseExpenseAmount(formData.get("amount"));
  const expenseDate = parseRequiredDate(formData.get("expenseDate"));
  const vendor = normalizeText(formData.get("vendor"));
  const notes = normalizeText(formData.get("notes"));
  const status = parseExpenseStatus(formData.get("status"));

  if (!projectId || !description || amount === null || !expenseDate) {
    throw new Error("Project, description, amount, and expense date are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("project_expenses").insert({
    project_id: projectId,
    description,
    category,
    amount,
    expense_date: expenseDate,
    vendor,
    notes,
    status,
    created_by: currentUser.id,
  });

  if (error) {
    console.error("Expense creation failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function updateProjectExpense(formData: FormData) {
  await requireProjectExpenseManager();

  const id = String(formData.get("id") || "");
  const projectId = String(formData.get("projectId") || "");
  const description = normalizeText(formData.get("description"));
  const category = parseExpenseCategory(formData.get("category"));
  const amount = parseExpenseAmount(formData.get("amount"));
  const expenseDate = parseRequiredDate(formData.get("expenseDate"));
  const vendor = normalizeText(formData.get("vendor"));
  const notes = normalizeText(formData.get("notes"));
  const status = parseExpenseStatus(formData.get("status"));

  if (!id || !projectId || !description || amount === null || !expenseDate) {
    throw new Error("Expense ID, project, description, amount, and date are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_expenses")
    .update({
      description,
      category,
      amount,
      expense_date: expenseDate,
      vendor,
      notes,
      status,
    })
    .eq("id", id)
    .eq("project_id", projectId);

  if (error) {
    console.error("Expense update failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  redirect(`/projects/${projectId}`);
}

export async function deleteProjectExpense(formData: FormData) {
  await requireProjectExpenseManager();

  const id = String(formData.get("id") || "");
  const projectId = String(formData.get("projectId") || "");

  if (!id || !projectId) {
    throw new Error("Expense ID and project ID are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_expenses")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId);

  if (error) {
    console.error("Expense delete failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  redirect(`/projects/${projectId}`);
}

function mapExpense(row: ProjectExpenseRow): ProjectExpense {
  return {
    id: row.id,
    projectId: row.project_id,
    description: row.description,
    category: row.category,
    amount: Number(row.amount),
    expenseDate: row.expense_date,
    vendor: row.vendor,
    notes: row.notes,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function parseExpenseAmount(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim().replace(/[$,]/g, "");

  if (!normalized) return null;

  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Expense amount must be a valid non-negative number.");
  }

  return Math.round(amount * 100) / 100;
}

function parseRequiredDate(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function parseExpenseCategory(value: FormDataEntryValue | null): ExpenseCategory {
  const category = String(value ?? "other").trim() as ExpenseCategory;
  return EXPENSE_CATEGORIES.has(category) ? category : "other";
}

function parseExpenseStatus(value: FormDataEntryValue | null): ExpenseStatus {
  const normalized = String(value ?? "committed")
    .trim()
    .replace(/^planned$/i, "committed") as ExpenseStatus;
  return EXPENSE_STATUSES.has(normalized) ? normalized : "committed";
}

async function requireProjectExpenseAccess(projectId: string) {
  const currentUser = await requireProjectExpenseAreaAccess();

  if (isPortalProjectManager(currentUser)) {
    return currentUser;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error || !data) {
    redirect("/projects");
  }

  return currentUser;
}

async function requireProjectExpenseAreaAccess() {
  const currentUser = await getCurrentPortalUser();

  if (!currentUser) {
    redirect("/login?next=/projects");
  }

  if (isPortalProjectManager(currentUser)) {
    return currentUser;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("id")
    .eq("user_id", currentUser.id)
    .limit(1);

  if (error) {
    console.error("Project expense access lookup failed:", error);
    redirect("/dashboard");
  }

  if (!data?.length) {
    redirect("/dashboard");
  }

  return currentUser;
}

async function requireProjectExpenseManager() {
  const currentUser = await getCurrentPortalUser();

  if (!currentUser) {
    redirect("/login?next=/projects");
  }

  if (!isPortalProjectManager(currentUser)) {
    redirect("/dashboard");
  }

  return currentUser;
}