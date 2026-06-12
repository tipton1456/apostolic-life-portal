"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type {
  ProjectRevenue,
  RevenueCategory,
  RevenueStatus,
} from "@/lib/project-revenue-utils";
import { isPortalProjectManager } from "@/lib/portal-project-roles";
import { getCurrentPortalUser } from "@/lib/portal-users";
import { createClient } from "@/lib/supabase/server";

export type {
  ProjectRevenue,
  ProjectRevenueStats,
  RevenueCategory,
  RevenueStatus,
} from "@/lib/project-revenue-utils";

type ProjectRevenueRow = {
  id: string;
  project_id: string;
  description: string;
  category: RevenueCategory;
  amount: number | string;
  revenue_date: string;
  source: string;
  notes: string;
  status: RevenueStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
};

const REVENUE_CATEGORIES = new Set<RevenueCategory>([
  "donations",
  "grants",
  "sales",
  "sponsorship",
  "services",
  "other",
]);

const REVENUE_STATUSES = new Set<RevenueStatus>([
  "planned",
  "committed",
  "received",
  "cancelled",
]);

export async function listProjectRevenue(projectId: string): Promise<ProjectRevenue[]> {
  await requireProjectRevenueAccess(projectId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_revenue")
    .select(
      "id,project_id,description,category,amount,revenue_date,source,notes,status,created_by,created_at,updated_at",
    )
    .eq("project_id", projectId)
    .order("revenue_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Project revenue lookup failed:", error);
    throw new Error("Unable to load project revenue.");
  }

  return ((data ?? []) as ProjectRevenueRow[]).map(mapRevenue);
}

export async function createProjectRevenue(formData: FormData) {
  const currentUser = await requireProjectRevenueManager();
  const projectId = String(formData.get("projectId") || "");
  const description = normalizeText(formData.get("description"));
  const category = parseRevenueCategory(formData.get("category"));
  const amount = parseRevenueAmount(formData.get("amount"));
  const revenueDate = parseRequiredDate(formData.get("revenueDate"));
  const source = normalizeText(formData.get("source"));
  const notes = normalizeText(formData.get("notes"));
  const status = parseRevenueStatus(formData.get("status"));

  if (!projectId || !description || amount === null || !revenueDate) {
    throw new Error("Project, description, amount, and revenue date are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("project_revenue").insert({
    project_id: projectId,
    description,
    category,
    amount,
    revenue_date: revenueDate,
    source,
    notes,
    status,
    created_by: currentUser.id,
  });

  if (error) {
    console.error("Revenue creation failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function updateProjectRevenue(formData: FormData) {
  await requireProjectRevenueManager();

  const id = String(formData.get("id") || "");
  const projectId = String(formData.get("projectId") || "");
  const description = normalizeText(formData.get("description"));
  const category = parseRevenueCategory(formData.get("category"));
  const amount = parseRevenueAmount(formData.get("amount"));
  const revenueDate = parseRequiredDate(formData.get("revenueDate"));
  const source = normalizeText(formData.get("source"));
  const notes = normalizeText(formData.get("notes"));
  const status = parseRevenueStatus(formData.get("status"));

  if (!id || !projectId || !description || amount === null || !revenueDate) {
    throw new Error("Revenue ID, project, description, amount, and date are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_revenue")
    .update({
      description,
      category,
      amount,
      revenue_date: revenueDate,
      source,
      notes,
      status,
    })
    .eq("id", id)
    .eq("project_id", projectId);

  if (error) {
    console.error("Revenue update failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  redirect(`/projects/${projectId}`);
}

export async function deleteProjectRevenue(formData: FormData) {
  await requireProjectRevenueManager();

  const id = String(formData.get("id") || "");
  const projectId = String(formData.get("projectId") || "");

  if (!id || !projectId) {
    throw new Error("Revenue ID and project ID are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_revenue")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId);

  if (error) {
    console.error("Revenue delete failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  redirect(`/projects/${projectId}`);
}

function mapRevenue(row: ProjectRevenueRow): ProjectRevenue {
  return {
    id: row.id,
    projectId: row.project_id,
    description: row.description,
    category: row.category,
    amount: Number(row.amount),
    revenueDate: row.revenue_date,
    source: row.source,
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

function parseRevenueAmount(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim().replace(/[$,]/g, "");

  if (!normalized) return null;

  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Revenue amount must be a valid non-negative number.");
  }

  return Math.round(amount * 100) / 100;
}

function parseRequiredDate(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function parseRevenueCategory(value: FormDataEntryValue | null): RevenueCategory {
  const category = String(value ?? "other").trim() as RevenueCategory;
  return REVENUE_CATEGORIES.has(category) ? category : "other";
}

function parseRevenueStatus(value: FormDataEntryValue | null): RevenueStatus {
  const status = String(value ?? "planned").trim() as RevenueStatus;
  return REVENUE_STATUSES.has(status) ? status : "planned";
}

async function requireProjectRevenueAccess(projectId: string) {
  const currentUser = await requireProjectRevenueAreaAccess();

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

async function requireProjectRevenueAreaAccess() {
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
    console.error("Project revenue access lookup failed:", error);
    redirect("/dashboard");
  }

  if (!data?.length) {
    redirect("/dashboard");
  }

  return currentUser;
}

async function requireProjectRevenueManager() {
  const currentUser = await getCurrentPortalUser();

  if (!currentUser) {
    redirect("/login?next=/projects");
  }

  if (!isPortalProjectManager(currentUser)) {
    redirect("/dashboard");
  }

  return currentUser;
}