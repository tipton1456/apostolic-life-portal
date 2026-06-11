"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentPortalUser } from "@/lib/portal-users";
import { createClient } from "@/lib/supabase/server";

export type ProjectStatus = "active" | "on_hold" | "completed" | "cancelled";
export type TaskStatus = "todo" | "in_progress" | "completed" | "blocked";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type Project = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: string | null;
  targetEndDate: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectTask = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  sortOrder: number;
  assignedTo: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectSummary = Project & {
  totalTasks: number;
  completedTasks: number;
  outstandingTasks: number;
  overdueTasks: number;
  completionPercent: number;
};

export type ProjectDashboard = {
  project: Project;
  tasks: ProjectTask[];
  stats: {
    totalTasks: number;
    completedTasks: number;
    outstandingTasks: number;
    overdueTasks: number;
    completionPercent: number;
  };
};

type ProjectRow = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  start_date: string | null;
  target_end_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type ProjectTaskRow = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  sort_order: number;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export async function isCurrentUserProjectManager() {
  const currentUser = await getCurrentPortalUser().catch((error) => {
    console.error("Project manager check failed:", error);
    return null;
  });

  if (!currentUser) return false;

  return currentUser.isAdmin || currentUser.canAccessProjects;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  await requireProjectAccess();

  const supabase = await createClient();
  const [{ data: projects, error: projectError }, { data: tasks, error: taskError }] =
    await Promise.all([
      supabase
        .from("projects")
        .select(
          "id,name,description,status,start_date,target_end_date,created_by,created_at,updated_at",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("project_tasks")
        .select("id,project_id,status,due_date"),
    ]);

  if (projectError) {
    console.error("Project list failed:", projectError);
    throw new Error("Unable to load projects.");
  }

  if (taskError) {
    console.error("Project task list failed:", taskError);
    throw new Error("Unable to load project tasks.");
  }

  const tasksByProject = groupTasksByProject((tasks ?? []) as Array<{
    id: string;
    project_id: string;
    status: TaskStatus;
    due_date: string | null;
  }>);

  return ((projects ?? []) as ProjectRow[]).map((project) => {
    const projectTasks = tasksByProject.get(project.id) ?? [];
    const stats = calculateTaskStats(projectTasks);

    return {
      ...mapProject(project),
      ...stats,
    };
  });
}

export async function getProjectDashboard(
  projectId: string,
): Promise<ProjectDashboard | null> {
  await requireProjectAccess();

  const supabase = await createClient();
  const [{ data: project, error: projectError }, { data: tasks, error: taskError }] =
    await Promise.all([
      supabase
        .from("projects")
        .select(
          "id,name,description,status,start_date,target_end_date,created_by,created_at,updated_at",
        )
        .eq("id", projectId)
        .maybeSingle<ProjectRow>(),
      supabase
        .from("project_tasks")
        .select(
          "id,project_id,title,description,status,priority,start_date,due_date,completed_at,sort_order,assigned_to,created_by,created_at,updated_at",
        )
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

  if (projectError) {
    console.error("Project lookup failed:", projectError);
    throw new Error("Unable to load project.");
  }

  if (taskError) {
    console.error("Project tasks lookup failed:", taskError);
    throw new Error("Unable to load project tasks.");
  }

  if (!project) return null;

  const mappedTasks = ((tasks ?? []) as ProjectTaskRow[]).map(mapTask);
  const stats = calculateTaskStats(
    mappedTasks.map((task) => ({
      id: task.id,
      project_id: task.projectId,
      status: task.status,
      due_date: task.dueDate,
    })),
  );

  return {
    project: mapProject(project),
    tasks: mappedTasks,
    stats,
  };
}

export async function createProject(formData: FormData) {
  const currentUser = await requireProjectAccess();
  const name = normalizeText(formData.get("name"));
  const description = normalizeText(formData.get("description"));
  const status = parseProjectStatus(formData.get("status"));
  const startDate = parseOptionalDate(formData.get("startDate"));
  const targetEndDate = parseOptionalDate(formData.get("targetEndDate"));

  if (!name) {
    throw new Error("Project name is required.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      name,
      description,
      status,
      start_date: startDate,
      target_end_date: targetEndDate,
      created_by: currentUser.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Project creation failed:", error);
    throw new Error(error?.message ?? "Unable to create project.");
  }

  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}

export async function updateProject(formData: FormData) {
  await requireProjectAccess();

  const id = String(formData.get("id") || "");
  const name = normalizeText(formData.get("name"));
  const description = normalizeText(formData.get("description"));
  const status = parseProjectStatus(formData.get("status"));
  const startDate = parseOptionalDate(formData.get("startDate"));
  const targetEndDate = parseOptionalDate(formData.get("targetEndDate"));

  if (!id || !name) {
    throw new Error("Project ID and name are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      name,
      description,
      status,
      start_date: startDate,
      target_end_date: targetEndDate,
    })
    .eq("id", id);

  if (error) {
    console.error("Project update failed:", error);
    throw new Error(error.message);
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
}

export async function deleteProject(formData: FormData) {
  await requireProjectAccess();

  const id = String(formData.get("id") || "");

  if (!id) {
    throw new Error("Project ID is required.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);

  if (error) {
    console.error("Project delete failed:", error);
    throw new Error(error.message);
  }

  revalidatePath("/projects");
  redirect("/projects");
}

export async function createProjectTask(formData: FormData) {
  const currentUser = await requireProjectAccess();

  const projectId = String(formData.get("projectId") || "");
  const title = normalizeText(formData.get("title"));
  const description = normalizeText(formData.get("description"));
  const status = parseTaskStatus(formData.get("status"));
  const priority = parseTaskPriority(formData.get("priority"));
  const startDate = parseOptionalDate(formData.get("startDate"));
  const dueDate = parseOptionalDate(formData.get("dueDate"));

  if (!projectId || !title) {
    throw new Error("Project ID and task title are required.");
  }

  const supabase = await createClient();
  const { data: existingTasks, error: sortError } = await supabase
    .from("project_tasks")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (sortError) {
    console.error("Task sort lookup failed:", sortError);
    throw new Error("Unable to create task.");
  }

  const nextSortOrder = ((existingTasks?.[0]?.sort_order as number | undefined) ?? -1) + 1;
  const payload = {
    project_id: projectId,
    title,
    description,
    status,
    priority,
    start_date: startDate,
    due_date: dueDate,
    sort_order: nextSortOrder,
    created_by: currentUser.id,
    completed_at: status === "completed" ? new Date().toISOString() : null,
  };

  const { error } = await supabase.from("project_tasks").insert(payload);

  if (error) {
    console.error("Task creation failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function updateProjectTask(formData: FormData) {
  await requireProjectAccess();

  const id = String(formData.get("id") || "");
  const projectId = String(formData.get("projectId") || "");
  const title = normalizeText(formData.get("title"));
  const description = normalizeText(formData.get("description"));
  const status = parseTaskStatus(formData.get("status"));
  const priority = parseTaskPriority(formData.get("priority"));
  const startDate = parseOptionalDate(formData.get("startDate"));
  const dueDate = parseOptionalDate(formData.get("dueDate"));

  if (!id || !projectId || !title) {
    throw new Error("Task ID, project ID, and title are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_tasks")
    .update({
      title,
      description,
      status,
      priority,
      start_date: startDate,
      due_date: dueDate,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) {
    console.error("Task update failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function deleteProjectTask(formData: FormData) {
  await requireProjectAccess();

  const id = String(formData.get("id") || "");
  const projectId = String(formData.get("projectId") || "");

  if (!id || !projectId) {
    throw new Error("Task ID and project ID are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("project_tasks").delete().eq("id", id);

  if (error) {
    console.error("Task delete failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

async function requireProjectAccess() {
  const currentUser = await getCurrentPortalUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (!currentUser.isAdmin && !currentUser.canAccessProjects) {
    redirect("/dashboard");
  }

  return currentUser;
}

function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    startDate: row.start_date,
    targetEndDate: row.target_end_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTask(row: ProjectTaskRow): ProjectTask {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    startDate: row.start_date,
    dueDate: row.due_date,
    completedAt: row.completed_at,
    sortOrder: row.sort_order,
    assignedTo: row.assigned_to,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function groupTasksByProject(
  tasks: Array<{
    id: string;
    project_id: string;
    status: TaskStatus;
    due_date: string | null;
  }>,
) {
  const tasksByProject = new Map<
    string,
    Array<{
      id: string;
      project_id: string;
      status: TaskStatus;
      due_date: string | null;
    }>
  >();

  for (const task of tasks) {
    const existing = tasksByProject.get(task.project_id) ?? [];
    existing.push(task);
    tasksByProject.set(task.project_id, existing);
  }

  return tasksByProject;
}

function calculateTaskStats(
  tasks: Array<{
    id: string;
    project_id: string;
    status: TaskStatus;
    due_date: string | null;
  }>,
) {
  const today = startOfToday();
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.status === "completed").length;
  const outstandingTasks = totalTasks - completedTasks;
  const overdueTasks = tasks.filter(
    (task) =>
      task.status !== "completed" &&
      task.due_date &&
      startOfDay(new Date(task.due_date)) < today,
  ).length;
  const completionPercent =
    totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  return {
    totalTasks,
    completedTasks,
    outstandingTasks,
    overdueTasks,
    completionPercent,
  };
}

function normalizeText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function parseOptionalDate(value: FormDataEntryValue | null) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function parseProjectStatus(value: FormDataEntryValue | null): ProjectStatus {
  const status = normalizeText(value);

  if (
    status === "active" ||
    status === "on_hold" ||
    status === "completed" ||
    status === "cancelled"
  ) {
    return status;
  }

  return "active";
}

function parseTaskStatus(value: FormDataEntryValue | null): TaskStatus {
  const status = normalizeText(value);

  if (
    status === "todo" ||
    status === "in_progress" ||
    status === "completed" ||
    status === "blocked"
  ) {
    return status;
  }

  return "todo";
}

function parseTaskPriority(value: FormDataEntryValue | null): TaskPriority {
  const priority = normalizeText(value);

  if (
    priority === "low" ||
    priority === "medium" ||
    priority === "high" ||
    priority === "urgent"
  ) {
    return priority;
  }

  return "medium";
}

function startOfToday() {
  return startOfDay(new Date());
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

