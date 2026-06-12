import {
  normalizeProjectRow,
  PROJECT_SELECT_WITH_ARCHIVE,
} from "@/lib/project-db-compat";
import {
  canUserViewProject,
  loadProjectManagerNamesForProject,
} from "@/lib/project-access";
import { formatDisplayDate } from "@/lib/project-management-utils";
import type { Project, ProjectStatus, ProjectTask } from "@/lib/project-management";
import { listProjectMilestones } from "@/lib/project-milestones";
import { getCurrentPortalUser } from "@/lib/portal-users";
import { createClient } from "@/lib/supabase/server";

export type LoadedProjectTask = {
  id: string;
  title: string;
  status: ProjectTask["status"];
  dueDate: string | null;
  dueDateMode: ProjectTask["dueDateMode"];
  milestoneId: string | null;
  assignedTo: string | null;
  assignedName: string;
  milestoneName: string | null;
  dueLabel: string;
};

export class ProjectTaskReportError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function loadAuthorizedProjectTaskReportData(projectId: string) {
  const currentUser = await getCurrentPortalUser();

  if (!currentUser) {
    throw new ProjectTaskReportError("Authentication required.", 401);
  }

  const canView = await canUserViewProject(projectId, currentUser);

  if (!canView) {
    throw new ProjectTaskReportError("You do not have access to this project.", 403);
  }

  const supabase = await createClient();
  const [
    { data: projectRow, error: projectError },
    { data: taskRows, error: taskError },
    milestones,
    managerNames,
    memberNames,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select(PROJECT_SELECT_WITH_ARCHIVE)
      .eq("id", projectId)
      .maybeSingle(),
    supabase
      .from("project_tasks")
      .select(
        "id,title,status,due_date,due_date_mode,milestone_id,assigned_to,created_at",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    listProjectMilestones(projectId),
    loadProjectManagerNamesForProject(projectId),
    loadProjectMemberNames(projectId),
  ]);

  if (projectError || !projectRow) {
    throw new ProjectTaskReportError("Project not found.", 404);
  }

  if (taskError) {
    throw new ProjectTaskReportError("Unable to load project tasks.", 500);
  }

  const project = mapProject(normalizeProjectRow(projectRow));
  const milestoneNameById = new Map(
    milestones.map((milestone) => [milestone.id, milestone.name]),
  );
  const assigneeNameById = await loadAssigneeNameById(
    supabase,
    ((taskRows ?? []) as Array<{ assigned_to: string | null }>).map(
      (task) => task.assigned_to,
    ),
  );

  const tasks = ((taskRows ?? []) as Array<{
    id: string;
    title: string;
    status: ProjectTask["status"];
    due_date: string | null;
    due_date_mode: ProjectTask["dueDateMode"] | null;
    milestone_id: string | null;
    assigned_to: string | null;
  }>).map((task) => {
    const dueDateMode = task.due_date_mode ?? "custom";
    const milestoneName = milestoneNameById.get(task.milestone_id ?? "") ?? null;

    return {
      id: task.id,
      title: task.title,
      status: task.status,
      dueDate: task.due_date,
      dueDateMode,
      milestoneId: task.milestone_id,
      assignedTo: task.assigned_to,
      assignedName: assigneeNameById.get(task.assigned_to ?? "") ?? "Unassigned",
      milestoneName,
      dueLabel:
        dueDateMode === "milestone" && milestoneName
          ? milestoneName
          : formatDisplayDate(task.due_date),
    } satisfies LoadedProjectTask;
  });

  return {
    currentUser,
    project,
    milestones,
    tasks,
    managerNames,
    participantNames: memberNames.map((member) => member.fullName),
    generatedBy:
      [currentUser.firstName, currentUser.lastName].filter(Boolean).join(" ") ||
      currentUser.email,
  };
}

async function loadProjectMemberNames(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);

  if (error) {
    console.error("Task report members lookup failed:", error);
    return [];
  }

  const userIds = (data ?? []).map((row) => row.user_id as string);
  if (userIds.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from("portal_users")
    .select("id,email,first_name,last_name")
    .in("id", userIds);

  if (profileError) {
    console.error("Task report member profiles lookup failed:", profileError);
    return [];
  }

  return (profiles ?? []).map((profile) => ({
    userId: profile.id as string,
    fullName:
      [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
      (profile.email as string),
  }));
}

async function loadAssigneeNameById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assignedToValues: Array<string | null>,
) {
  const userIds = [
    ...new Set(assignedToValues.filter((value): value is string => Boolean(value))),
  ];

  if (userIds.length === 0) {
    return new Map<string, string>();
  }

  const { data: profiles, error } = await supabase
    .from("portal_users")
    .select("id,email,first_name,last_name")
    .in("id", userIds);

  if (error) {
    console.error("Task report assignee lookup failed:", error);
    return new Map<string, string>();
  }

  return new Map(
    (profiles ?? []).map((profile) => [
      profile.id as string,
      [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
        (profile.email as string),
    ]),
  );
}

function mapProject(row: ReturnType<typeof normalizeProjectRow>): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status as ProjectStatus,
    startDate: row.start_date,
    targetEndDate: row.target_end_date,
    imageUrl: row.image_url,
    archivedFilesUrl: row.archived_files_url,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } satisfies Project;
}