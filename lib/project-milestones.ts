"use server";

import { revalidatePath } from "next/cache";
import {
  assertDateWithinProjectRange,
  type ProjectMilestone,
} from "@/lib/project-milestone-utils";
import { requireProjectManageAccess } from "@/lib/project-access";
import { createClient } from "@/lib/supabase/server";

type ProjectMilestoneRow = {
  id: string;
  project_id: string;
  name: string;
  milestone_date: string;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

function mapMilestone(row: ProjectMilestoneRow): ProjectMilestone {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    milestoneDate: row.milestone_date,
    sortOrder: row.sort_order,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listProjectMilestones(projectId: string): Promise<ProjectMilestone[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_milestones")
    .select(
      "id,project_id,name,milestone_date,sort_order,created_by,created_at,updated_at",
    )
    .eq("project_id", projectId)
    .order("milestone_date", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Project milestones lookup failed:", error);
    throw new Error("Unable to load project milestones.");
  }

  return ((data ?? []) as ProjectMilestoneRow[]).map(mapMilestone);
}

export async function createProjectMilestone(formData: FormData) {
  const currentUser = await requireProjectManageAccess(String(formData.get("projectId") || ""));
  const projectId = String(formData.get("projectId") || "");
  const name = String(formData.get("name") || "").trim();
  const milestoneDate = String(formData.get("milestoneDate") || "").trim();

  if (!projectId || !name || !milestoneDate) {
    throw new Error("Project ID, milestone name, and date are required.");
  }

  const supabase = await createClient();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("start_date,target_end_date")
    .eq("id", projectId)
    .maybeSingle<{ start_date: string | null; target_end_date: string | null }>();

  if (projectError || !project) {
    throw new Error("Project not found.");
  }

  assertDateWithinProjectRange(
    { startDate: project.start_date, targetEndDate: project.target_end_date },
    milestoneDate,
    "Milestone date",
  );

  const { data: existingMilestones, error: sortError } = await supabase
    .from("project_milestones")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (sortError) {
    console.error("Milestone sort lookup failed:", sortError);
    throw new Error("Unable to create milestone.");
  }

  const nextSortOrder =
    ((existingMilestones?.[0]?.sort_order as number | undefined) ?? -1) + 1;

  const { error } = await supabase.from("project_milestones").insert({
    project_id: projectId,
    name,
    milestone_date: milestoneDate,
    sort_order: nextSortOrder,
    created_by: currentUser.id,
  });

  if (error) {
    console.error("Milestone creation failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${projectId}`);
}

export async function deleteProjectMilestone(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");
  const milestoneId = String(formData.get("milestoneId") || "");

  await requireProjectManageAccess(projectId);

  if (!projectId || !milestoneId) {
    throw new Error("Project ID and milestone ID are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_milestones")
    .delete()
    .eq("id", milestoneId)
    .eq("project_id", projectId);

  if (error) {
    console.error("Milestone delete failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${projectId}`);
}