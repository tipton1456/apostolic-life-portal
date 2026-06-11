"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  notifyProjectManagersTaskCompleted,
  notifyProjectParticipantTaskAssigned,
} from "@/lib/project-notifications";
import { getCurrentPortalUser } from "@/lib/portal-users";
import { createAdminClient } from "@/lib/supabase/admin";
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

export type ProjectMember = {
  id: string;
  projectId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  addedBy: string;
  createdAt: string;
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
  assignedName: string | null;
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
  members: ProjectMember[];
  tasks: ProjectTask[];
  stats: {
    totalTasks: number;
    completedTasks: number;
    outstandingTasks: number;
    overdueTasks: number;
    completionPercent: number;
  };
  permissions: {
    isManager: boolean;
    isParticipant: boolean;
    canManageProject: boolean;
    canManageMembers: boolean;
    canManageTasks: boolean;
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

type ProjectMemberRow = {
  id: string;
  project_id: string;
  user_id: string;
  added_by: string;
  created_at: string;
};

type PortalUserRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
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

export async function isCurrentUserProjectParticipant() {
  const currentUser = await getCurrentPortalUser().catch((error) => {
    console.error("Project participant check failed:", error);
    return null;
  });

  if (!currentUser) return false;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("id")
    .eq("user_id", currentUser.id)
    .limit(1);

  if (error) {
    console.error("Project participant lookup failed:", error);
    return false;
  }

  return Boolean(data?.length);
}

export async function canCurrentUserAccessProjects() {
  return (
    (await isCurrentUserProjectManager()) || (await isCurrentUserProjectParticipant())
  );
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const currentUser = await requireProjectAreaAccess();
  const isManager = currentUser.isAdmin || currentUser.canAccessProjects;
  const supabase = await createClient();

  let projectQuery = supabase
    .from("projects")
    .select(
      "id,name,description,status,start_date,target_end_date,created_by,created_at,updated_at",
    )
    .order("created_at", { ascending: false });

  if (!isManager) {
    const { data: memberships, error: membershipError } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("user_id", currentUser.id);

    if (membershipError) {
      console.error("Project membership lookup failed:", membershipError);
      throw new Error("Unable to load project memberships.");
    }

    const projectIds = (memberships ?? []).map((membership) => membership.project_id);

    if (projectIds.length === 0) return [];

    projectQuery = projectQuery.in("id", projectIds);
  }

  const [{ data: projects, error: projectError }, { data: tasks, error: taskError }] =
    await Promise.all([
      projectQuery,
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

export async function listAssignablePortalUsers(): Promise<
  Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    fullName: string;
  }>
> {
  await requireProjectManager();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("portal_users")
    .select("id,email,first_name,last_name")
    .order("email", { ascending: true });

  if (error) {
    console.error("Assignable portal user lookup failed:", error);
    throw new Error("Unable to load portal users.");
  }

  return ((data ?? []) as PortalUserRow[]).map((user) => ({
    id: user.id,
    email: user.email,
    firstName: user.first_name ?? "",
    lastName: user.last_name ?? "",
    fullName:
      [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email,
  }));
}

export async function getProjectDashboard(
  projectId: string,
): Promise<ProjectDashboard | null> {
  const currentUser = await requireProjectAreaAccess();
  const access = await getProjectPermissions(projectId, currentUser);
  const supabase = await createClient();
  const [{ data: project, error: projectError }, { data: tasks, error: taskError }, members] =
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
      loadProjectMembers(projectId),
    ]);

  if (projectError) {
    console.error("Project lookup failed:", projectError);
    throw new Error("Unable to load project.");
  }

  if (taskError) {
    console.error("Project tasks lookup failed:", taskError);
    throw new Error("Unable to load project tasks.");
  }

  if (!project || !access.canView) return null;

  const memberNameById = new Map(
    members.map((member) => [member.userId, member.fullName]),
  );
  const mappedTasks = ((tasks ?? []) as ProjectTaskRow[]).map((task) =>
    mapTask(task, memberNameById.get(task.assigned_to ?? "") ?? null),
  );
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
    members,
    tasks: mappedTasks,
    stats,
    permissions: {
      isManager: access.isManager,
      isParticipant: access.isParticipant,
      canManageProject: access.isManager,
      canManageMembers: access.isManager,
      canManageTasks: access.isManager,
    },
  };
}

export async function createProject(formData: FormData) {
  const currentUser = await requireProjectManager();
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
  await requireProjectManager();

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
  await requireProjectManager();

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

export async function addProjectMember(formData: FormData) {
  const currentUser = await requireProjectManager();

  const projectId = String(formData.get("projectId") || "");
  const userId = String(formData.get("userId") || "");

  if (!projectId || !userId) {
    throw new Error("Project ID and user ID are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("project_members").insert({
    project_id: projectId,
    user_id: userId,
    added_by: currentUser.id,
  });

  if (error) {
    console.error("Project member insert failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function removeProjectMember(formData: FormData) {
  await requireProjectManager();

  const projectId = String(formData.get("projectId") || "");
  const userId = String(formData.get("userId") || "");

  if (!projectId || !userId) {
    throw new Error("Project ID and user ID are required.");
  }

  const supabase = await createClient();
  const { error: unassignError } = await supabase
    .from("project_tasks")
    .update({ assigned_to: null })
    .eq("project_id", projectId)
    .eq("assigned_to", userId);

  if (unassignError) {
    console.error("Project member task unassign failed:", unassignError);
    throw new Error(unassignError.message);
  }

  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);

  if (error) {
    console.error("Project member delete failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function createProjectTask(formData: FormData) {
  const currentUser = await requireProjectManager();

  const projectId = String(formData.get("projectId") || "");
  const title = normalizeText(formData.get("title"));
  const description = normalizeText(formData.get("description"));
  const status = parseTaskStatus(formData.get("status"));
  const priority = parseTaskPriority(formData.get("priority"));
  const startDate = parseOptionalDate(formData.get("startDate"));
  const dueDate = parseOptionalDate(formData.get("dueDate"));
  const assignedTo = parseOptionalUserId(formData.get("assignedTo"));

  if (!projectId || !title) {
    throw new Error("Project ID and task title are required.");
  }

  await ensureAssigneeIsProjectMember(projectId, assignedTo);

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
    assigned_to: assignedTo,
    created_by: currentUser.id,
    completed_at: status === "completed" ? new Date().toISOString() : null,
  };

  const { data: createdTask, error } = await supabase
    .from("project_tasks")
    .insert(payload)
    .select("id,title,status,assigned_to")
    .single();

  if (error || !createdTask) {
    console.error("Task creation failed:", error);
    throw new Error(error?.message ?? "Unable to create task.");
  }

  const project = await getProjectRecord(projectId);

  if (assignedTo) {
    await notifyProjectParticipantTaskAssigned({
      assigneeUserId: assignedTo,
      projectId,
      projectName: project.name,
      senderEmail: currentUser.email,
      senderUserId: currentUser.id,
      taskId: createdTask.id,
      taskTitle: createdTask.title,
    });
  }

  if (createdTask.status === "completed") {
    await notifyProjectManagersTaskCompleted({
      completedByName: formatUserName(currentUser),
      projectId,
      projectName: project.name,
      senderEmail: currentUser.email,
      senderUserId: currentUser.id,
      taskTitle: createdTask.title,
    });
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function updateProjectTask(formData: FormData) {
  const currentUser = await requireProjectAreaAccess();
  const id = String(formData.get("id") || "");
  const projectId = String(formData.get("projectId") || "");
  const access = await getProjectPermissions(projectId, currentUser);

  if (!access.canView) {
    redirect("/projects");
  }

  const supabase = await createClient();
  const { data: existingTask, error: existingError } = await supabase
    .from("project_tasks")
    .select("id,title,status,assigned_to")
    .eq("id", id)
    .eq("project_id", projectId)
    .maybeSingle<Pick<ProjectTaskRow, "id" | "title" | "status" | "assigned_to">>();

  if (existingError || !existingTask) {
    throw new Error("Task not found.");
  }

  const isManager = access.isManager;
  const isAssignee = existingTask.assigned_to === currentUser.id;

  if (!isManager && !isAssignee) {
    redirect("/dashboard");
  }

  const title = isManager
    ? normalizeText(formData.get("title"))
    : existingTask.title;
  const description = isManager
    ? normalizeText(formData.get("description"))
    : undefined;
  const status = parseTaskStatus(formData.get("status"));
  const priority = isManager
    ? parseTaskPriority(formData.get("priority"))
    : undefined;
  const startDate = isManager
    ? parseOptionalDate(formData.get("startDate"))
    : undefined;
  const dueDate = isManager ? parseOptionalDate(formData.get("dueDate")) : undefined;
  const assignedTo = isManager
    ? parseOptionalUserId(formData.get("assignedTo"))
    : existingTask.assigned_to;

  if (!id || !projectId || !title) {
    throw new Error("Task ID, project ID, and title are required.");
  }

  if (isManager) {
    await ensureAssigneeIsProjectMember(projectId, assignedTo);
  }

  const updatePayload: Record<string, string | null> = {
    status,
    completed_at: status === "completed" ? new Date().toISOString() : null,
  };

  if (isManager) {
    updatePayload.title = title;
    updatePayload.description = description ?? "";
    updatePayload.priority = priority ?? "medium";
    updatePayload.start_date = startDate ?? null;
    updatePayload.due_date = dueDate ?? null;
    updatePayload.assigned_to = assignedTo ?? null;
  }

  const { error } = await supabase
    .from("project_tasks")
    .update(updatePayload)
    .eq("id", id);

  if (error) {
    console.error("Task update failed:", error);
    throw new Error(error.message);
  }

  const project = await getProjectRecord(projectId);
  const assignmentChanged =
    isManager && assignedTo && assignedTo !== existingTask.assigned_to;
  const completedNow =
    status === "completed" && existingTask.status !== "completed";

  if (assignmentChanged && assignedTo) {
    await notifyProjectParticipantTaskAssigned({
      assigneeUserId: assignedTo,
      projectId,
      projectName: project.name,
      senderEmail: currentUser.email,
      senderUserId: currentUser.id,
      taskId: id,
      taskTitle: title,
    });
  }

  if (completedNow) {
    await notifyProjectManagersTaskCompleted({
      completedByName: formatUserName(currentUser),
      projectId,
      projectName: project.name,
      senderEmail: currentUser.email,
      senderUserId: currentUser.id,
      taskTitle: title,
    });
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function deleteProjectTask(formData: FormData) {
  await requireProjectManager();

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

async function loadProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const supabase = await createClient();
  const { data: memberRows, error } = await supabase
    .from("project_members")
    .select("id,project_id,user_id,added_by,created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Project members lookup failed:", error);
    throw new Error("Unable to load project members.");
  }

  const userIds = (memberRows ?? []).map((member) => member.user_id);

  if (userIds.length === 0) return [];

  const admin = createAdminClient();
  const { data: profiles, error: profileError } = await admin
    .from("portal_users")
    .select("id,email,first_name,last_name")
    .in("id", userIds);

  if (profileError) {
    console.error("Project member profile lookup failed:", profileError);
    throw new Error("Unable to load project member profiles.");
  }

  const profilesById = new Map(
    ((profiles ?? []) as PortalUserRow[]).map((profile) => [profile.id, profile]),
  );

  return ((memberRows ?? []) as ProjectMemberRow[]).map((member) => {
    const profile = profilesById.get(member.user_id);

    return {
      id: member.id,
      projectId: member.project_id,
      userId: member.user_id,
      email: profile?.email ?? "",
      firstName: profile?.first_name ?? "",
      lastName: profile?.last_name ?? "",
      fullName:
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
        profile?.email ||
        "Unknown member",
      addedBy: member.added_by,
      createdAt: member.created_at,
    };
  });
}

async function getProjectRecord(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id,name")
    .eq("id", projectId)
    .single<Pick<ProjectRow, "id" | "name">>();

  if (error || !data) {
    throw new Error("Project not found.");
  }

  return data;
}

async function ensureAssigneeIsProjectMember(
  projectId: string,
  userId: string | null,
) {
  if (!userId) return;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Project member validation failed:", error);
    throw new Error("Unable to validate project member.");
  }

  if (!data) {
    throw new Error("Tasks can only be assigned to people on this project.");
  }
}

async function getProjectPermissions(
  projectId: string,
  currentUser: NonNullable<Awaited<ReturnType<typeof getCurrentPortalUser>>>,
) {
  const isManager = currentUser.isAdmin || currentUser.canAccessProjects;

  if (isManager) {
    return {
      canView: true,
      isManager: true,
      isParticipant: false,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Project permission lookup failed:", error);
    return {
      canView: false,
      isManager: false,
      isParticipant: false,
    };
  }

  return {
    canView: Boolean(data),
    isManager: false,
    isParticipant: Boolean(data),
  };
}

async function requireProjectManager() {
  const currentUser = await getCurrentPortalUser();

  if (!currentUser) {
    redirect("/login?next=/projects");
  }

  if (!currentUser.isAdmin && !currentUser.canAccessProjects) {
    redirect("/dashboard");
  }

  return currentUser;
}

async function requireProjectAreaAccess() {
  const currentUser = await getCurrentPortalUser();

  if (!currentUser) {
    redirect("/login?next=/projects");
  }

  if (currentUser.isAdmin || currentUser.canAccessProjects) {
    return currentUser;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("id")
    .eq("user_id", currentUser.id)
    .limit(1);

  if (error) {
    console.error("Project area access lookup failed:", error);
    redirect("/dashboard");
  }

  if (!data?.length) {
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

function mapTask(row: ProjectTaskRow, assignedName: string | null): ProjectTask {
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
    assignedName,
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

function formatUserName(user: {
  firstName: string;
  lastName: string;
  email: string;
}) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return fullName || user.email;
}

function normalizeText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function parseOptionalDate(value: FormDataEntryValue | null) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function parseOptionalUserId(value: FormDataEntryValue | null) {
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