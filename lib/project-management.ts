"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  notifyProjectManagersTaskCompleted,
} from "@/lib/project-notifications";
import {
  isMissingColumnError,
  normalizeProjectRow,
  PROJECT_BASE_SELECT,
  PROJECT_SELECT_WITH_ARCHIVE,
} from "@/lib/project-db-compat";
import {
  attachExistingPortalUserToProject,
  createOrAttachProjectParticipantFromForm,
  resolveTaskAssigneeFromForm,
  sendTaskAssignmentNotifications,
} from "@/lib/project-participant-onboarding";
import { buildAssigneeNameById } from "@/lib/project-assignee-options";
import { CREATE_NEW_ASSIGNEE_VALUE } from "@/lib/project-participant-constants";
import {
  isTaskAtRisk,
  isTaskOpenOutstanding,
  isTaskOverdue,
} from "@/lib/project-management-utils";
import {
  canUserManageProject,
  canUserViewProject,
  isAssignedProjectManager,
  loadAccessibleProjectIds,
  requireEligibleProjectManager,
  requireProjectAreaAccess as requireProjectAreaAccessFromAccess,
  requireProjectManageAccess,
} from "@/lib/project-access";
import {
  assertDateWithinProjectRange,
  type ProjectMilestone,
  type TaskDueDateMode,
} from "@/lib/project-milestone-utils";
import { listProjectMilestones } from "@/lib/project-milestones";
import { isPortalProjectManager } from "@/lib/portal-project-roles";
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
  imageUrl: string | null;
  archivedFilesUrl: string | null;
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

export type ProjectManager = {
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
  dueDateMode: TaskDueDateMode;
  milestoneId: string | null;
  milestoneName: string | null;
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
  atRiskTasks: number;
  openOutstandingTasks: number;
  completionPercent: number;
};

export type AccessibleProjectTask = {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  isOverdue: boolean;
};

export type ProjectDashboard = {
  project: Project;
  members: ProjectMember[];
  managers: ProjectManager[];
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
  stats: {
    totalTasks: number;
    completedTasks: number;
    outstandingTasks: number;
    overdueTasks: number;
    atRiskTasks: number;
    openOutstandingTasks: number;
    completionPercent: number;
  };
  permissions: {
    isManager: boolean;
    isParticipant: boolean;
    canManageProject: boolean;
    canManageMembers: boolean;
    canManageTasks: boolean;
    canReassignTasks: boolean;
  };
};

type ProjectRow = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  start_date: string | null;
  target_end_date: string | null;
  image_url: string | null;
  archived_files_url: string | null;
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

type ProjectManagerRow = {
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
  due_date_mode?: TaskDueDateMode;
  milestone_id?: string | null;
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

  return isPortalProjectManager(currentUser);
}

export async function isCurrentUserProjectParticipant() {
  const currentUser = await getCurrentPortalUser().catch((error) => {
    console.error("Project participant check failed:", error);
    return null;
  });

  if (!currentUser) return false;

  if (currentUser.projectRole === "project_participant") {
    return true;
  }

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
  const currentUser = await requireProjectAreaAccessFromAccess();
  const supabase = await createClient();
  const projectIds = await loadAccessibleProjectIds(currentUser);

  if (projectIds && projectIds.length === 0) {
    return [];
  }

  const [{ data: projects, error: projectError }, { data: tasks, error: taskError }] =
    await Promise.all([
      fetchProjects(supabase, projectIds),
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

  return ((projects ?? []) as ProjectRow[])
    .map((project) => {
      const projectTasks = tasksByProject.get(project.id) ?? [];
      const stats = calculateTaskStats(projectTasks);

      return {
        ...mapProject(normalizeProjectRow(project)),
        ...stats,
      };
    })
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
}

export async function listAccessibleProjectTasks(
  limit = 8,
): Promise<AccessibleProjectTask[]> {
  if (!(await canCurrentUserAccessProjects())) {
    return [];
  }

  const currentUser = await getCurrentPortalUser();

  if (!currentUser) {
    return [];
  }

  const supabase = await createClient();
  const projectIds = await loadAccessibleProjectIds(currentUser);

  if (projectIds && projectIds.length === 0) {
    return [];
  }

  let query = supabase
    .from("project_tasks")
    .select("id,project_id,title,status,priority,due_date")
    .eq("assigned_to", currentUser.id)
    .neq("status", "completed")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(limit);

  if (projectIds) {
    query = query.in("project_id", projectIds);
  }

  const { data: tasks, error: taskError } = await query;

  if (taskError) {
    console.error("Accessible project task lookup failed:", taskError);
    throw new Error("Unable to load project tasks.");
  }

  const taskRows = (tasks ?? []) as Array<{
    id: string;
    project_id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string | null;
  }>;

  if (taskRows.length === 0) {
    return [];
  }

  const uniqueProjectIds = [...new Set(taskRows.map((task) => task.project_id))];
  const { data: projects, error: projectError } = await supabase
    .from("projects")
    .select("id,name")
    .in("id", uniqueProjectIds);

  if (projectError) {
    console.error("Accessible project task project lookup failed:", projectError);
    throw new Error("Unable to load project tasks.");
  }

  const projectNameById = new Map(
    (projects ?? []).map((project) => [project.id, project.name as string]),
  );

  return taskRows
    .map((task) => {
      const mappedTask: ProjectTask = {
        id: task.id,
        projectId: task.project_id,
        title: task.title,
        description: "",
        status: task.status,
        priority: task.priority,
        startDate: null,
        dueDate: task.due_date,
        dueDateMode: "custom",
        milestoneId: null,
        milestoneName: null,
        completedAt: null,
        sortOrder: 0,
        assignedTo: currentUser.id,
        assignedName: null,
        createdBy: "",
        createdAt: "",
        updatedAt: "",
      };

      return {
        id: task.id,
        projectId: task.project_id,
        projectName: projectNameById.get(task.project_id) ?? "Unknown project",
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.due_date,
        isOverdue: isTaskOverdue(mappedTask),
      };
    })
    .sort((left, right) => {
      if (left.isOverdue !== right.isOverdue) {
        return left.isOverdue ? -1 : 1;
      }

      if (left.dueDate && right.dueDate) {
        return left.dueDate.localeCompare(right.dueDate);
      }

      if (left.dueDate) return -1;
      if (right.dueDate) return 1;

      return left.title.localeCompare(right.title);
    });
}

export async function listProjectManagersForAssignee(): Promise<
  Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    fullName: string;
  }>
> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("portal_users")
    .select("id,email,first_name,last_name,is_admin,project_role,can_access_projects")
    .or(
      "is_admin.eq.true,project_role.eq.project_manager,can_access_projects.eq.true",
    )
    .order("email", { ascending: true });

  if (error) {
    console.error("Project manager assignee lookup failed:", error);
    throw new Error("Unable to load project managers.");
  }

  return ((data ?? []) as Array<PortalUserRow & {
    is_admin: boolean | null;
    project_role: string | null;
    can_access_projects: boolean | null;
  }>)
    .filter(
      (user) =>
        user.is_admin ||
        user.project_role === "project_manager" ||
        user.can_access_projects,
    )
    .map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.first_name ?? "",
      lastName: user.last_name ?? "",
      fullName:
        [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email,
    }));
}

type PortalUserOption = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
};

function mapPortalUserOption(
  user: Pick<PortalUserRow, "id" | "email" | "first_name" | "last_name">,
): PortalUserOption {
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name ?? "",
    lastName: user.last_name ?? "",
    fullName:
      [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email,
  };
}

function isManagerPortalUser(profile: {
  is_admin: boolean | null;
  project_role: string | null;
  can_access_projects: boolean | null;
}) {
  return isPortalProjectManager({
    isAdmin: Boolean(profile.is_admin),
    projectRole:
      profile.project_role === "project_manager" ||
      profile.project_role === "project_participant"
        ? profile.project_role
        : null,
    canAccessProjects: Boolean(profile.can_access_projects),
  });
}

export async function listPortalParticipantRoleUsers(): Promise<PortalUserOption[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("portal_users")
    .select("id,email,first_name,last_name,is_admin,project_role,can_access_projects")
    .eq("project_role", "project_participant")
    .order("email", { ascending: true });

  if (error) {
    console.error("Portal participant role lookup failed:", error);
    throw new Error("Unable to load portal participants.");
  }

  return ((data ?? []) as Array<
    PortalUserRow & {
      is_admin: boolean | null;
      project_role: string | null;
      can_access_projects: boolean | null;
    }
  >)
    .filter((user) => !isManagerPortalUser(user))
    .map(mapPortalUserOption);
}

export async function listAssignablePortalUsers(): Promise<PortalUserOption[]> {
  await requireEligibleProjectManager();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("portal_users")
    .select("id,email,first_name,last_name,is_admin,project_role,can_access_projects")
    .order("email", { ascending: true });

  if (error) {
    console.error("Assignable portal user lookup failed:", error);
    throw new Error("Unable to load portal users.");
  }

  return ((data ?? []) as Array<
    PortalUserRow & {
      is_admin: boolean | null;
      project_role: string | null;
      can_access_projects: boolean | null;
    }
  >)
    .filter((user) => !isManagerPortalUser(user))
    .map(mapPortalUserOption);
}

export async function listProjectManagers(projectId: string): Promise<ProjectManager[]> {
  return loadProjectManagers(projectId);
}

export async function listEligibleManagersToAdd(
  projectId: string,
): Promise<PortalUserOption[]> {
  await requireProjectManageAccess(projectId);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("portal_users")
    .select("id,email,first_name,last_name,is_admin,project_role,can_access_projects")
    .or(
      "is_admin.eq.true,project_role.eq.project_manager,can_access_projects.eq.true",
    )
    .order("email", { ascending: true });

  if (error) {
    console.error("Eligible project manager lookup failed:", error);
    throw new Error("Unable to load eligible project managers.");
  }

  const assignedManagerIds = new Set(
    (await loadProjectManagers(projectId)).map((manager) => manager.userId),
  );

  return ((data ?? []) as Array<
    PortalUserRow & {
      is_admin: boolean | null;
      project_role: string | null;
      can_access_projects: boolean | null;
    }
  >)
    .filter(
      (user) =>
        user.is_admin ||
        user.project_role === "project_manager" ||
        user.can_access_projects,
    )
    .filter((user) => !assignedManagerIds.has(user.id))
    .map(mapPortalUserOption);
}

export async function addProjectManager(formData: FormData) {
  const currentUser = await requireProjectManageAccess(
    String(formData.get("projectId") || ""),
  );
  const projectId = String(formData.get("projectId") || "");
  const userId = String(formData.get("userId") || "");

  if (!projectId || !userId) {
    throw new Error("Project ID and user ID are required.");
  }

  const profile = await getPortalUserAssigneeProfile(userId);

  if (!isManagerPortalUser(profile)) {
    throw new Error("Only eligible portal project managers can be added.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("project_managers").insert({
    project_id: projectId,
    user_id: userId,
    added_by: currentUser.id,
  });

  if (error) {
    console.error("Project manager add failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function removeProjectManager(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");
  const userId = String(formData.get("userId") || "");

  await requireProjectManageAccess(projectId);

  if (!projectId || !userId) {
    throw new Error("Project ID and user ID are required.");
  }

  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from("project_managers")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  if (countError) {
    console.error("Project manager count failed:", countError);
    throw new Error("Unable to remove project manager.");
  }

  if ((count ?? 0) <= 1) {
    throw new Error("Each project must keep at least one project manager.");
  }

  const { error } = await supabase
    .from("project_managers")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);

  if (error) {
    console.error("Project manager remove failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function listPortalUsersAvailableForProject(
  projectId: string,
): Promise<PortalUserOption[]> {
  await requireProjectManageAccess(projectId);

  const [portalUsers, memberIds] = await Promise.all([
    listAssignablePortalUsers(),
    loadProjectMemberIds(projectId),
  ]);

  return portalUsers.filter((user) => !memberIds.has(user.id));
}

export async function getProjectDashboard(
  projectId: string,
): Promise<ProjectDashboard | null> {
  const currentUser = await requireProjectAreaAccessFromAccess();
  const access = await getProjectPermissions(projectId, currentUser);
  const supabase = await createClient();
  const [
    { data: project, error: projectError },
    { data: tasks, error: taskError },
    members,
    managers,
    milestones,
    portalParticipants,
  ] = await Promise.all([
    fetchProjectById(supabase, projectId),
    supabase
      .from("project_tasks")
      .select(
        "id,project_id,title,description,status,priority,start_date,due_date,due_date_mode,milestone_id,completed_at,sort_order,assigned_to,created_by,created_at,updated_at",
      )
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    loadProjectMembers(projectId),
    loadProjectManagers(projectId).catch((error) => {
      console.error("Project dashboard manager lookup failed:", error);
      return [];
    }),
    listProjectMilestones(projectId).catch((error) => {
      console.error("Project dashboard milestone lookup failed:", error);
      return [];
    }),
    listPortalParticipantRoleUsers().catch((error) => {
      console.error("Project dashboard participant lookup failed:", error);
      return [];
    }),
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

  const milestoneNameById = new Map(
    milestones.map((milestone) => [milestone.id, milestone.name]),
  );
  const assigneeNameById = buildAssigneeNameById({
    members: members.map((member) => ({
      id: member.userId,
      fullName: member.fullName,
    })),
    managers: managers.map((manager) => ({
      id: manager.userId,
      fullName: manager.fullName,
    })),
    portalParticipants: portalParticipants.map((participant) => ({
      id: participant.id,
      fullName: participant.fullName,
    })),
  });
  const mappedTasks = ((tasks ?? []) as ProjectTaskRow[]).map((task) =>
    mapTask(
      task,
      assigneeNameById.get(task.assigned_to ?? "") ?? null,
      milestoneNameById.get(task.milestone_id ?? "") ?? null,
    ),
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
    project: mapProject(normalizeProjectRow(project)),
    members,
    managers,
    milestones,
    tasks: mappedTasks,
    stats,
    permissions: {
      isManager: access.isManager,
      isParticipant: access.isParticipant,
      canManageProject: access.isManager,
      canManageMembers: access.isManager,
      canManageTasks: access.isManager,
      canReassignTasks: access.isParticipant,
    },
  };
}

export async function createProject(formData: FormData) {
  const currentUser = await requireEligibleProjectManager();
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

  const { error: managerError } = await supabase.from("project_managers").insert({
    project_id: data.id,
    user_id: currentUser.id,
    added_by: currentUser.id,
  });

  if (managerError) {
    console.error("Project manager assignment failed:", managerError);
    await supabase.from("projects").delete().eq("id", data.id);
    throw new Error(managerError.message);
  }

  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}

export async function updateProject(formData: FormData) {
  const id = String(formData.get("id") || "");
  await requireProjectManageAccess(id);
  const name = normalizeText(formData.get("name"));
  const description = normalizeText(formData.get("description"));
  const status = parseProjectStatus(formData.get("status"));
  const startDate = parseOptionalDate(formData.get("startDate"));
  const targetEndDate = parseOptionalDate(formData.get("targetEndDate"));
  if (!id || !name) {
    throw new Error("Project ID and name are required.");
  }

  const supabase = await createClient();
  const updatePayload: Record<string, string | null> = {
    name,
    description,
    status,
    start_date: startDate,
    target_end_date: targetEndDate,
  };

  if (status === "completed" && formData.has("archivedFilesUrl")) {
    updatePayload.archived_files_url = parseOptionalUrl(
      formData.get("archivedFilesUrl"),
    );
  }

  let { error } = await supabase.from("projects").update(updatePayload).eq("id", id);

  if (error && isMissingColumnError(error, "archived_files_url")) {
    delete updatePayload.archived_files_url;
    ({ error } = await supabase.from("projects").update(updatePayload).eq("id", id));
  }

  if (error) {
    console.error("Project update failed:", error);
    throw new Error(error.message);
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  redirect(`/projects/${id}`);
}

export async function uploadProjectImage(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");
  await requireProjectManageAccess(projectId);
  const imageFile = getProjectImageFile(formData.get("projectImage"));
  const removeImage = formData.get("removeImage") === "on";

  if (!projectId) {
    throw new Error("Project ID is required.");
  }

  const supabase = await createClient();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("image_url")
    .eq("id", projectId)
    .maybeSingle<{ image_url: string | null }>();

  if (projectError || !project) {
    throw new Error("Project not found.");
  }

  if (removeImage) {
    await deleteProjectImageFile(project.image_url);
    const { error } = await supabase
      .from("projects")
      .update({ image_url: null })
      .eq("id", projectId);

    if (error) {
      console.error("Project image removal failed:", error);
      throw new Error(error.message);
    }

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/projects");
    redirect(`/projects/${projectId}`);
  }

  if (!imageFile) {
    throw new Error("Choose a project image to upload.");
  }

  if (project.image_url) {
    await deleteProjectImageFile(project.image_url);
  }

  const storagePath = buildProjectImageStoragePath(projectId, imageFile.name);
  const fileBuffer = Buffer.from(await imageFile.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("project-images")
    .upload(storagePath, fileBuffer, {
      contentType: imageFile.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("Project image upload failed:", uploadError);
    throw new Error(uploadError.message);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("project-images").getPublicUrl(storagePath);

  const { error: updateError } = await supabase
    .from("projects")
    .update({ image_url: publicUrl })
    .eq("id", projectId);

  if (updateError) {
    console.error("Project image URL save failed:", updateError);
    throw new Error(updateError.message);
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  redirect(`/projects/${projectId}`);
}

export async function deleteProject(formData: FormData) {
  const id = String(formData.get("id") || "");
  await requireProjectManageAccess(id);

  if (!id) {
    throw new Error("Project ID is required.");
  }

  const supabase = await createClient();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("image_url")
    .eq("id", id)
    .maybeSingle<{ image_url: string | null }>();

  if (projectError) {
    console.error("Project lookup failed:", projectError);
    throw new Error(projectError.message);
  }

  if (project?.image_url) {
    await deleteProjectImageFile(project.image_url);
  }

  const { error } = await supabase.from("projects").delete().eq("id", id);

  if (error) {
    console.error("Project delete failed:", error);
    throw new Error(error.message);
  }

  revalidatePath("/projects");
  redirect("/projects");
}

export async function addProjectMember(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");
  const currentUser = await requireProjectManageAccess(projectId);
  const userId = String(formData.get("userId") || "");

  if (!projectId || !userId) {
    throw new Error("Project ID and user ID are required.");
  }

  await attachExistingPortalUserToProject(projectId, userId, currentUser.id);

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function addNewProjectParticipant(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");
  const currentUser = await requireProjectManageAccess(projectId);

  if (!projectId) {
    throw new Error("Project ID is required.");
  }

  const onboardingForm = new FormData();
  onboardingForm.set("assignedTo", CREATE_NEW_ASSIGNEE_VALUE);
  onboardingForm.set("newParticipantEmail", String(formData.get("newParticipantEmail") || ""));
  onboardingForm.set("newParticipantPhone", String(formData.get("newParticipantPhone") || ""));
  onboardingForm.set(
    "newParticipantFirstName",
    String(formData.get("newParticipantFirstName") || ""),
  );
  onboardingForm.set(
    "newParticipantLastName",
    String(formData.get("newParticipantLastName") || ""),
  );

  await createOrAttachProjectParticipantFromForm(
    onboardingForm,
    projectId,
    currentUser,
  );

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function removeProjectMember(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");
  await requireProjectManageAccess(projectId);
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
  const projectId = String(formData.get("projectId") || "");
  const currentUser = await requireProjectManageAccess(projectId);
  const title = normalizeText(formData.get("title"));
  const description = normalizeText(formData.get("description"));
  const status = parseTaskStatus(formData.get("status"));
  const priority = parseTaskPriority(formData.get("priority"));
  const startDate = parseOptionalDate(formData.get("startDate"));
  const assignee = await resolveTaskAssigneeFromForm(formData, projectId, currentUser);
  const assignedTo = assignee.userId;

  if (!projectId || !title) {
    throw new Error("Project ID and task title are required.");
  }

  const supabase = await createClient();
  const { data: projectRow, error: projectError } = await supabase
    .from("projects")
    .select("start_date,target_end_date")
    .eq("id", projectId)
    .maybeSingle<{ start_date: string | null; target_end_date: string | null }>();

  if (projectError || !projectRow) {
    throw new Error("Project not found.");
  }

  const projectDates = {
    startDate: projectRow.start_date,
    targetEndDate: projectRow.target_end_date,
  };
  const milestones = await listProjectMilestones(projectId);
  const resolvedDue = resolveTaskDueDateFromForm(formData, milestones);

  assertDateWithinProjectRange(projectDates, startDate, "Task start date");
  assertDateWithinProjectRange(projectDates, resolvedDue.dueDate, "Task due date");

  await ensureAssigneeCanReceiveTask(projectId, assignedTo, currentUser.id);
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
    due_date: resolvedDue.dueDate,
    due_date_mode: resolvedDue.dueDateMode,
    milestone_id: resolvedDue.milestoneId,
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
    await sendTaskAssignmentNotifications({
      assignee,
      assigneeUserId: assignedTo,
      projectId,
      projectName: project.name,
      senderEmail: currentUser.email,
      senderUserId: currentUser.id,
      taskId: createdTask.id,
      taskTitle: createdTask.title,
    });
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");

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

}

export async function updateProjectTask(formData: FormData) {
  const currentUser = await requireProjectAreaAccessFromAccess();
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
  const canReassignAsParticipant = access.isParticipant && isAssignee;

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
  let resolvedDue:
    | {
        dueDate: string | null;
        dueDateMode: TaskDueDateMode;
        milestoneId: string | null;
      }
    | undefined;

  if (isManager) {
    const milestones = await listProjectMilestones(projectId);
    resolvedDue = resolveTaskDueDateFromForm(formData, milestones);
  }

  let assignee: Awaited<ReturnType<typeof resolveTaskAssigneeFromForm>> = {
    userId: existingTask.assigned_to,
    isNewAccount: false,
  };
  let assignedTo = existingTask.assigned_to;

  if (isManager) {
    assignee = await resolveTaskAssigneeFromForm(formData, projectId, currentUser);
    assignedTo = assignee.userId;
  } else if (canReassignAsParticipant) {
    const nextAssignee = String(formData.get("assignedTo") || "").trim();

    if (!nextAssignee) {
      throw new Error("Choose a project manager or participant to hand off this task.");
    }

    assignedTo = nextAssignee;
    assignee = { userId: assignedTo, isNewAccount: false };
    await ensureAssigneeIsValidParticipantHandoff(
      projectId,
      assignedTo,
      currentUser.id,
    );
  }

  if (!id || !projectId || !title) {
    throw new Error("Task ID, project ID, and title are required.");
  }

  if (isManager) {
    await ensureAssigneeCanReceiveTask(projectId, assignedTo, currentUser.id);

    const { data: projectRow, error: projectError } = await supabase
      .from("projects")
      .select("start_date,target_end_date")
      .eq("id", projectId)
      .maybeSingle<{ start_date: string | null; target_end_date: string | null }>();

    if (projectError || !projectRow) {
      throw new Error("Project not found.");
    }

    const projectDates = {
      startDate: projectRow.start_date,
      targetEndDate: projectRow.target_end_date,
    };

    assertDateWithinProjectRange(projectDates, startDate ?? null, "Task start date");
    assertDateWithinProjectRange(
      projectDates,
      resolvedDue?.dueDate ?? null,
      "Task due date",
    );
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
    updatePayload.due_date = resolvedDue?.dueDate ?? null;
    updatePayload.due_date_mode = resolvedDue?.dueDateMode ?? "custom";
    updatePayload.milestone_id = resolvedDue?.milestoneId ?? null;
    updatePayload.assigned_to = assignedTo ?? null;
  } else if (canReassignAsParticipant && assignedTo !== existingTask.assigned_to) {
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
    assignedTo && assignedTo !== existingTask.assigned_to;
  const completedNow =
    status === "completed" && existingTask.status !== "completed";

  if (assignmentChanged && assignedTo) {
    await sendTaskAssignmentNotifications({
      assignee,
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
  redirect(`/projects/${projectId}`);
}

export async function deleteProjectTask(formData: FormData) {
  const id = String(formData.get("id") || "");
  const projectId = String(formData.get("projectId") || "");
  await requireProjectManageAccess(projectId);

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
  redirect(`/projects/${projectId}`);
}

async function loadProjectManagers(projectId: string): Promise<ProjectManager[]> {
  const supabase = await createClient();
  const { data: managerRows, error } = await supabase
    .from("project_managers")
    .select("id,project_id,user_id,added_by,created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Project managers lookup failed:", error);
    throw new Error("Unable to load project managers.");
  }

  const userIds = (managerRows ?? []).map((manager) => manager.user_id);
  if (userIds.length === 0) return [];

  const admin = createAdminClient();
  const { data: profiles, error: profileError } = await admin
    .from("portal_users")
    .select("id,email,first_name,last_name")
    .in("id", userIds);

  if (profileError) {
    console.error("Project manager profile lookup failed:", profileError);
    throw new Error("Unable to load project manager profiles.");
  }

  const profilesById = new Map(
    ((profiles ?? []) as PortalUserRow[]).map((profile) => [profile.id, profile]),
  );

  return ((managerRows ?? []) as ProjectManagerRow[]).map((manager) => {
    const profile = profilesById.get(manager.user_id);

    return {
      id: manager.id,
      projectId: manager.project_id,
      userId: manager.user_id,
      email: profile?.email ?? "",
      firstName: profile?.first_name ?? "",
      lastName: profile?.last_name ?? "",
      fullName:
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
        profile?.email ||
        "Unknown manager",
      addedBy: manager.added_by,
      createdAt: manager.created_at,
    };
  });
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

async function loadProjectMemberIds(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);

  if (error) {
    console.error("Project member id lookup failed:", error);
    throw new Error("Unable to load project members.");
  }

  return new Set((data ?? []).map((row) => row.user_id as string));
}

async function getPortalUserAssigneeProfile(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("portal_users")
    .select("is_admin,project_role,can_access_projects")
    .eq("id", userId)
    .maybeSingle<{
      is_admin: boolean | null;
      project_role: string | null;
      can_access_projects: boolean | null;
    }>();

  if (error || !data) {
    console.error("Assignee profile lookup failed:", error);
    throw new Error("Unable to validate assignee.");
  }

  return data;
}

async function ensureProjectMemberRecord(
  projectId: string,
  userId: string,
  addedBy: string,
) {
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

  if (data) return;

  const { error: insertError } = await supabase.from("project_members").insert({
    project_id: projectId,
    user_id: userId,
    added_by: addedBy,
  });

  if (insertError) {
    console.error("Project member auto-add failed:", insertError);
    throw new Error(insertError.message);
  }
}

async function ensureAssigneeCanReceiveTask(
  projectId: string,
  userId: string | null,
  addedBy: string,
) {
  if (!userId) return;

  if (await isAssignedProjectManager(projectId, userId)) {
    return;
  }

  const profile = await getPortalUserAssigneeProfile(userId);

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

  if (data) return;

  if (profile.project_role === "project_participant") {
    await ensureProjectMemberRecord(projectId, userId, addedBy);
    return;
  }

  throw new Error(
    "Tasks can only be assigned to this project's managers, portal participants, or people already on this project.",
  );
}

async function ensureAssigneeIsValidParticipantHandoff(
  projectId: string,
  userId: string | null,
  addedBy: string,
) {
  if (!userId) {
    throw new Error("Choose a project manager or participant to hand off this task.");
  }

  if (await isAssignedProjectManager(projectId, userId)) {
    return;
  }

  const profile = await getPortalUserAssigneeProfile(userId);

  if (profile.project_role === "project_participant") {
    await ensureProjectMemberRecord(projectId, userId, addedBy);
    return;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Participant handoff member validation failed:", error);
    throw new Error("Unable to validate project member.");
  }

  if (!data) {
    throw new Error(
      "Participants can only hand tasks to a project manager, a portal participant, or someone already on this project.",
    );
  }
}

async function getProjectPermissions(
  projectId: string,
  currentUser: NonNullable<Awaited<ReturnType<typeof getCurrentPortalUser>>>,
) {
  const canView = await canUserViewProject(projectId, currentUser);

  if (!canView) {
    return {
      canView: false,
      isManager: false,
      isParticipant: false,
    };
  }

  const isManager = await canUserManageProject(projectId, currentUser);

  if (isManager) {
    return {
      canView: true,
      isManager: true,
      isParticipant: false,
    };
  }

  return {
    canView: true,
    isManager: false,
    isParticipant: true,
  };
}

async function fetchProjects(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectIds: string[] | null,
) {
  const buildQuery = (select: string) => {
    let query = supabase.from("projects").select(select).order("created_at", {
      ascending: false,
    });

    if (projectIds) {
      query = query.in("id", projectIds);
    }

    return query;
  };

  const primary = await buildQuery(PROJECT_SELECT_WITH_ARCHIVE);

  if (primary.error && isMissingColumnError(primary.error, "archived_files_url")) {
    const fallback = await buildQuery(PROJECT_BASE_SELECT);

    return {
      data: ((fallback.data ?? []) as unknown as ProjectRow[]).map((row) =>
        normalizeProjectRow(row),
      ),
      error: fallback.error,
    };
  }

  return {
    data: (primary.data ?? []) as unknown as ProjectRow[] | null,
    error: primary.error,
  };
}

async function fetchProjectById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
) {
  let { data, error } = await supabase
    .from("projects")
    .select(PROJECT_SELECT_WITH_ARCHIVE)
    .eq("id", projectId)
    .maybeSingle<ProjectRow>();

  if (error && isMissingColumnError(error, "archived_files_url")) {
    const fallback = await supabase
      .from("projects")
      .select(PROJECT_BASE_SELECT)
      .eq("id", projectId)
      .maybeSingle();

    data = fallback.data ? normalizeProjectRow(fallback.data as ProjectRow) : null;
    error = fallback.error;
  }

  return { data: data as ProjectRow | null, error };
}

function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    startDate: row.start_date,
    targetEndDate: row.target_end_date,
    imageUrl: row.image_url,
    archivedFilesUrl: row.archived_files_url,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseOptionalUrl(value: FormDataEntryValue | null) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Archived files URL must start with http:// or https://");
    }

    return url.toString();
  } catch {
    throw new Error("Archived files URL must be a valid http:// or https:// link.");
  }
}

function mapTask(
  row: ProjectTaskRow,
  assignedName: string | null,
  milestoneName: string | null = null,
): ProjectTask {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    startDate: row.start_date,
    dueDate: row.due_date,
    dueDateMode: row.due_date_mode ?? "custom",
    milestoneId: row.milestone_id ?? null,
    milestoneName,
    completedAt: row.completed_at,
    sortOrder: row.sort_order,
    assignedTo: row.assigned_to,
    assignedName,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function resolveTaskDueDateFromForm(
  formData: FormData,
  milestones: ProjectMilestone[],
) {
  const dueDateMode = parseTaskDueDateMode(formData.get("dueDateMode"));
  const milestoneId = normalizeText(formData.get("milestoneId")) || null;
  const customDueDate = parseOptionalDate(formData.get("dueDate"));

  if (dueDateMode === "milestone") {
    if (!milestoneId) {
      throw new Error("Choose a milestone for the task due date.");
    }

    const milestone = milestones.find((entry) => entry.id === milestoneId);

    if (!milestone) {
      throw new Error("Selected milestone was not found on this project.");
    }

    return {
      dueDate: milestone.milestoneDate,
      dueDateMode: "milestone" as const,
      milestoneId,
    };
  }

  return {
    dueDate: customDueDate,
    dueDateMode: "custom" as const,
    milestoneId: null,
  };
}

function parseTaskDueDateMode(value: FormDataEntryValue | null): TaskDueDateMode {
  const mode = normalizeText(value);
  return mode === "milestone" ? "milestone" : "custom";
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
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.status === "completed").length;
  const outstandingTasks = totalTasks - completedTasks;
  const overdueTasks = tasks.filter((task) =>
    isTaskOverdue({ status: task.status, dueDate: task.due_date }),
  ).length;
  const atRiskTasks = tasks.filter((task) =>
    isTaskAtRisk({ status: task.status, dueDate: task.due_date }),
  ).length;
  const openOutstandingTasks = tasks.filter((task) =>
    isTaskOpenOutstanding({ status: task.status, dueDate: task.due_date }),
  ).length;
  const completionPercent =
    totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  return {
    totalTasks,
    completedTasks,
    outstandingTasks,
    overdueTasks,
    atRiskTasks,
    openOutstandingTasks,
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

const PROJECT_IMAGE_BUCKET = "project-images";
const PROJECT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const PROJECT_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function getProjectImageFile(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) return null;

  if (!PROJECT_IMAGE_TYPES.has(value.type)) {
    throw new Error("Project image must be a JPG, PNG, or WebP file.");
  }

  if (value.size > PROJECT_IMAGE_MAX_BYTES) {
    throw new Error("Project image must be smaller than 5MB.");
  }

  return value;
}

function buildProjectImageStoragePath(projectId: string, filename: string) {
  const extension = getProjectImageExtension(filename);

  return `${projectId}/cover-${Date.now()}.${extension}`;
}

function getProjectImageExtension(filename: string) {
  const normalized = filename.trim().toLowerCase();

  if (normalized.endsWith(".png")) return "png";
  if (normalized.endsWith(".webp")) return "webp";

  return "jpg";
}

function getProjectImageStoragePath(imageUrl: string | null) {
  if (!imageUrl) return null;

  const marker = `/storage/v1/object/public/${PROJECT_IMAGE_BUCKET}/`;

  if (!imageUrl.includes(marker)) return null;

  return imageUrl.split(marker)[1] ?? null;
}

async function deleteProjectImageFile(imageUrl: string | null) {
  const storagePath = getProjectImageStoragePath(imageUrl);

  if (!storagePath) return;

  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(PROJECT_IMAGE_BUCKET)
    .remove([storagePath]);

  if (error) {
    console.error("Project image delete failed:", error);
  }
}