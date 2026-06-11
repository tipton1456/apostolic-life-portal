"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { notifyProjectManagersTaskCompleted } from "@/lib/project-notifications";
import { isMissingRelationError } from "@/lib/project-db-compat";
import { storeProjectTaskFile } from "@/lib/project-files";
import { parseProjectTaskUploadFile } from "@/lib/project-files-utils";
import type { TaskStatus } from "@/lib/project-management";
import { getCurrentPortalUser } from "@/lib/portal-users";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ProjectTaskUpdate = {
  id: string;
  projectId: string;
  taskId: string;
  comment: string;
  previousStatus: TaskStatus | null;
  newStatus: TaskStatus | null;
  file: {
    id: string;
    fileName: string;
    fileSize: number;
  } | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
};

type ProjectTaskUpdateRow = {
  id: string;
  project_id: string;
  task_id: string;
  comment: string;
  previous_status: TaskStatus | null;
  new_status: TaskStatus | null;
  task_file_id: string | null;
  created_by: string;
  created_at: string;
};

export async function listProjectTaskUpdates(
  projectId: string,
): Promise<ProjectTaskUpdate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_task_updates")
    .select(
      "id,project_id,task_id,comment,previous_status,new_status,task_file_id,created_by,created_at",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingRelationError(error, "project_task_updates")) {
      console.warn("Project task updates table is not available yet.");
      return [];
    }

    console.error("Project task updates lookup failed:", error);
    throw new Error("Unable to load task updates.");
  }

  return enrichProjectTaskUpdates((data ?? []) as ProjectTaskUpdateRow[]);
}

export async function addProjectTaskUpdate(formData: FormData) {
  const currentUser = await getCurrentPortalUser();

  if (!currentUser) {
    redirect("/login?next=/projects");
  }

  const projectId = String(formData.get("projectId") || "");
  const taskId = String(formData.get("taskId") || "");
  const comment = normalizeComment(formData.get("comment"));
  const requestedStatus = parseOptionalTaskStatus(formData.get("status"));
  const file = parseProjectTaskUploadFile(formData.get("updateFile"));

  if (!projectId || !taskId) {
    throw new Error("Project ID and task ID are required.");
  }

  if (!comment) {
    throw new Error("Update comments are required.");
  }

  const supabase = await createClient();
  const [{ data: project, error: projectError }, { data: task, error: taskError }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id,name,status")
        .eq("id", projectId)
        .maybeSingle<{ id: string; name: string; status: string }>(),
      supabase
        .from("project_tasks")
        .select("id,title,status,assigned_to")
        .eq("id", taskId)
        .eq("project_id", projectId)
        .maybeSingle<{
          id: string;
          title: string;
          status: TaskStatus;
          assigned_to: string | null;
        }>(),
    ]);

  if (projectError || !project) {
    throw new Error("Project not found.");
  }

  if (project.status === "completed") {
    throw new Error("Completed projects no longer accept new task updates.");
  }

  if (taskError || !task) {
    throw new Error("Task not found.");
  }

  const isManager = currentUser.isAdmin || currentUser.canAccessProjects;
  const isAssignee = task.assigned_to === currentUser.id;

  if (!isManager && !isAssignee) {
    redirect("/dashboard");
  }

  if (!isManager && task.status === "completed") {
    throw new Error("Completed tasks cannot receive new updates.");
  }

  const statusChanged =
    requestedStatus !== null && requestedStatus !== task.status;
  const nextStatus = statusChanged ? requestedStatus : null;
  let taskFileId: string | null = null;

  if (file) {
    taskFileId = await storeProjectTaskFile({
      file,
      projectId,
      taskId,
      uploadedBy: currentUser.id,
    });
  }

  if (statusChanged && requestedStatus) {
    const { error: taskUpdateError } = await supabase
      .from("project_tasks")
      .update({
        completed_at:
          requestedStatus === "completed" ? new Date().toISOString() : null,
        status: requestedStatus,
      })
      .eq("id", taskId);

    if (taskUpdateError) {
      console.error("Task status update from task update failed:", taskUpdateError);
      throw new Error(taskUpdateError.message);
    }

    if (requestedStatus === "completed" && task.status !== "completed") {
      await notifyProjectManagersTaskCompleted({
        completedByName: formatUserName(currentUser),
        projectId,
        projectName: project.name,
        senderEmail: currentUser.email,
        senderUserId: currentUser.id,
        taskTitle: task.title,
      });
    }
  }

  const { error: insertError } = await supabase.from("project_task_updates").insert({
    comment,
    created_by: currentUser.id,
    new_status: nextStatus,
    previous_status: statusChanged ? task.status : null,
    project_id: projectId,
    task_file_id: taskFileId,
    task_id: taskId,
  });

  if (insertError) {
    if (isMissingRelationError(insertError, "project_task_updates")) {
      throw new Error(
        "Task updates are not enabled yet. Apply migration 202606110006 in Supabase.",
      );
    }

    console.error("Project task update insert failed:", insertError);
    throw new Error(insertError.message);
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  redirect(`/projects/${projectId}?task=${taskId}`);
}

async function enrichProjectTaskUpdates(rows: ProjectTaskUpdateRow[]) {
  if (rows.length === 0) return [];

  const admin = createAdminClient();
  const userIds = [...new Set(rows.map((row) => row.created_by))];
  const fileIds = [
    ...new Set(
      rows
        .map((row) => row.task_file_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const [{ data: users }, { data: files }] = await Promise.all([
    admin
      .from("portal_users")
      .select("id,email,first_name,last_name")
      .in("id", userIds),
    fileIds.length > 0
      ? admin
          .from("project_task_files")
          .select("id,file_name,file_size")
          .in("id", fileIds)
      : Promise.resolve({ data: [] }),
  ]);

  const userNameById = new Map(
    (users ?? []).map((user) => [
      user.id,
      [user.first_name, user.last_name].filter(Boolean).join(" ") ||
        user.email ||
        "Unknown user",
    ]),
  );
  const fileById = new Map(
    (files ?? []).map((file) => [
      file.id,
      {
        fileName: file.file_name as string,
        fileSize: Number(file.file_size),
        id: file.id as string,
      },
    ]),
  );

  return rows.map((row) => ({
    comment: row.comment,
    createdAt: row.created_at,
    createdBy: row.created_by,
    createdByName: userNameById.get(row.created_by) ?? "Unknown user",
    file: row.task_file_id ? fileById.get(row.task_file_id) ?? null : null,
    id: row.id,
    newStatus: row.new_status,
    previousStatus: row.previous_status,
    projectId: row.project_id,
    taskId: row.task_id,
  }));
}

function normalizeComment(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function parseOptionalTaskStatus(value: FormDataEntryValue | null) {
  const normalized = String(value || "").trim();

  if (
    !normalized ||
    !["todo", "in_progress", "completed", "blocked"].includes(normalized)
  ) {
    return null;
  }

  return normalized as TaskStatus;
}

function formatUserName(user: {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return fullName || user.email;
}