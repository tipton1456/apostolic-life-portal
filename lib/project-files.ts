"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  buildProjectTaskDropboxPath,
  deleteDropboxFile,
  getDropboxTemporaryDownloadLink,
  hasDropboxConfig,
  uploadDropboxFile,
} from "@/lib/dropbox";
import { canCurrentUserAccessProjects } from "@/lib/project-management";
import { getCurrentPortalUser } from "@/lib/portal-users";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ProjectTaskFile = {
  id: string;
  projectId: string;
  projectName: string;
  taskId: string;
  taskTitle: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
};

type ProjectTaskFileRow = {
  id: string;
  project_id: string;
  task_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  dropbox_path: string;
  uploaded_by: string;
  created_at: string;
};

const MAX_PROJECT_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILES_PER_TASK = 20;

const ALLOWED_PROJECT_FILE_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function listAccessibleProjectFiles(
  limit = 100,
): Promise<ProjectTaskFile[]> {
  await requireProjectFilesAccess();

  const currentUser = await getCurrentPortalUser();

  if (!currentUser) return [];

  const isManager = currentUser.isAdmin || currentUser.canAccessProjects;
  const supabase = await createClient();

  let projectIds: string[] | null = null;

  if (!isManager) {
    const { data: memberships, error } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("user_id", currentUser.id);

    if (error) {
      console.error("Project file membership lookup failed:", error);
      throw new Error("Unable to load project files.");
    }

    projectIds = (memberships ?? []).map((membership) => membership.project_id);

    if (projectIds.length === 0) return [];
  }

  let query = supabase
    .from("project_task_files")
    .select(
      "id,project_id,task_id,file_name,file_size,mime_type,dropbox_path,uploaded_by,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (projectIds) {
    query = query.in("project_id", projectIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Project files lookup failed:", error);
    throw new Error("Unable to load project files.");
  }

  return enrichProjectFiles((data ?? []) as ProjectTaskFileRow[]);
}

export async function listProjectFiles(projectId: string): Promise<ProjectTaskFile[]> {
  await requireProjectFilesAccessForProject(projectId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_task_files")
    .select(
      "id,project_id,task_id,file_name,file_size,mime_type,dropbox_path,uploaded_by,created_at",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Project files lookup failed:", error);
    throw new Error("Unable to load project files.");
  }

  return enrichProjectFiles((data ?? []) as ProjectTaskFileRow[]);
}

export async function listTaskFiles(
  projectId: string,
  taskId: string,
): Promise<ProjectTaskFile[]> {
  await requireProjectFilesAccessForProject(projectId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_task_files")
    .select(
      "id,project_id,task_id,file_name,file_size,mime_type,dropbox_path,uploaded_by,created_at",
    )
    .eq("project_id", projectId)
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Task files lookup failed:", error);
    throw new Error("Unable to load task files.");
  }

  return enrichProjectFiles((data ?? []) as ProjectTaskFileRow[]);
}

export async function uploadProjectTaskFile(formData: FormData) {
  await requireProjectFilesAccess();

  if (!hasDropboxConfig()) {
    throw new Error("Dropbox is not configured for project file storage.");
  }

  const projectId = String(formData.get("projectId") || "");
  const taskId = String(formData.get("taskId") || "");
  const file = getProjectTaskFile(formData.get("taskFile"));

  if (!projectId || !taskId || !file) {
    throw new Error("Project ID, task ID, and file are required.");
  }

  await requireProjectFilesAccessForProject(projectId);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/projects");
  }

  const [{ data: task, error: taskError }, { count, error: countError }] =
    await Promise.all([
      supabase
        .from("project_tasks")
        .select("id,title")
        .eq("id", taskId)
        .eq("project_id", projectId)
        .maybeSingle<{ id: string; title: string }>(),
      supabase
        .from("project_task_files")
        .select("id", { count: "exact", head: true })
        .eq("task_id", taskId),
    ]);

  if (taskError || !task) {
    throw new Error("Task not found.");
  }

  if (countError) {
    throw new Error("Unable to validate task file count.");
  }

  if ((count ?? 0) >= MAX_FILES_PER_TASK) {
    throw new Error(`Each task can have up to ${MAX_FILES_PER_TASK} files.`);
  }

  const dropboxPath = buildProjectTaskDropboxPath({
    fileName: file.name,
    projectId,
    taskId,
  });
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadDropboxFile({
    contents: fileBuffer,
    destinationPath: dropboxPath,
  });

  const { error: insertError } = await supabase.from("project_task_files").insert({
    project_id: projectId,
    task_id: taskId,
    file_name: uploaded.fileName || file.name,
    file_size: uploaded.fileSize,
    mime_type: file.type || "application/octet-stream",
    dropbox_path: uploaded.dropboxPath,
    uploaded_by: user.id,
  });

  if (insertError) {
    console.error("Project task file insert failed:", insertError);

    try {
      await deleteDropboxFile(uploaded.dropboxPath);
    } catch (cleanupError) {
      console.error("Dropbox cleanup after failed insert:", cleanupError);
    }

    throw new Error(insertError.message);
  }

  revalidateProjectFilePaths(projectId);
}

export async function deleteProjectTaskFile(formData: FormData) {
  await requireProjectFilesAccess();

  const fileId = String(formData.get("fileId") || "");
  const projectId = String(formData.get("projectId") || "");

  if (!fileId || !projectId) {
    throw new Error("File ID and project ID are required.");
  }

  await requireProjectFilesAccessForProject(projectId);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/projects");
  }

  const currentUser = await getCurrentPortalUser();
  const isManager = Boolean(
    currentUser?.isAdmin || currentUser?.canAccessProjects,
  );

  const { data: file, error } = await supabase
    .from("project_task_files")
    .select("id,dropbox_path,uploaded_by")
    .eq("id", fileId)
    .eq("project_id", projectId)
    .maybeSingle<{
      id: string;
      dropbox_path: string;
      uploaded_by: string;
    }>();

  if (error || !file) {
    throw new Error("File not found.");
  }

  if (!isManager && file.uploaded_by !== user.id) {
    throw new Error("You do not have permission to delete this file.");
  }

  await deleteDropboxFile(file.dropbox_path);

  const { error: deleteError } = await supabase
    .from("project_task_files")
    .delete()
    .eq("id", fileId);

  if (deleteError) {
    console.error("Project task file delete failed:", deleteError);
    throw new Error(deleteError.message);
  }

  revalidateProjectFilePaths(projectId);
}

export async function getProjectFileDownloadUrl(fileId: string) {
  await requireProjectFilesAccess();

  if (!hasDropboxConfig()) {
    throw new Error("Dropbox is not configured.");
  }

  const supabase = await createClient();
  const { data: file, error } = await supabase
    .from("project_task_files")
    .select("id,project_id,dropbox_path,file_name")
    .eq("id", fileId)
    .maybeSingle<{
      id: string;
      project_id: string;
      dropbox_path: string;
      file_name: string;
    }>();

  if (error || !file) {
    throw new Error("File not found.");
  }

  await requireProjectFilesAccessForProject(file.project_id);

  const downloadUrl = await getDropboxTemporaryDownloadLink(file.dropbox_path);

  return {
    downloadUrl,
    fileName: file.file_name,
  };
}

export async function shouldShowProjectFilesForCurrentUser() {
  return canCurrentUserAccessProjects();
}

async function enrichProjectFiles(
  rows: ProjectTaskFileRow[],
): Promise<ProjectTaskFile[]> {
  if (rows.length === 0) return [];

  const admin = createAdminClient();
  const projectIds = [...new Set(rows.map((row) => row.project_id))];
  const taskIds = [...new Set(rows.map((row) => row.task_id))];
  const userIds = [...new Set(rows.map((row) => row.uploaded_by))];

  const [{ data: projects }, { data: tasks }, { data: users }] = await Promise.all([
    admin.from("projects").select("id,name").in("id", projectIds),
    admin.from("project_tasks").select("id,title").in("id", taskIds),
    admin
      .from("portal_users")
      .select("id,email,first_name,last_name")
      .in("id", userIds),
  ]);

  const projectNameById = new Map(
    (projects ?? []).map((project) => [project.id, project.name as string]),
  );
  const taskTitleById = new Map(
    (tasks ?? []).map((task) => [task.id, task.title as string]),
  );
  const userNameById = new Map(
    (users ?? []).map((user) => [
      user.id,
      [user.first_name, user.last_name].filter(Boolean).join(" ") ||
        user.email ||
        "Unknown user",
    ]),
  );

  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    projectName: projectNameById.get(row.project_id) ?? "Unknown project",
    taskId: row.task_id,
    taskTitle: taskTitleById.get(row.task_id) ?? "Unknown task",
    fileName: row.file_name,
    fileSize: Number(row.file_size),
    mimeType: row.mime_type,
    uploadedBy: row.uploaded_by,
    uploadedByName: userNameById.get(row.uploaded_by) ?? "Unknown user",
    createdAt: row.created_at,
  }));
}

async function requireProjectFilesAccess() {
  const currentUser = await getCurrentPortalUser();

  if (!currentUser) {
    redirect("/login?next=/projects/files");
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
    console.error("Project files access lookup failed:", error);
    redirect("/dashboard");
  }

  if (!data?.length) {
    redirect("/dashboard");
  }

  return currentUser;
}

async function requireProjectFilesAccessForProject(projectId: string) {
  const currentUser = await requireProjectFilesAccess();
  const isManager = currentUser.isAdmin || currentUser.canAccessProjects;

  if (isManager) return currentUser;

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

function getProjectTaskFile(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) return null;

  if (!ALLOWED_PROJECT_FILE_TYPES.has(value.type)) {
    throw new Error(
      "File type not allowed. Use PDF, Office documents, text, CSV, or images.",
    );
  }

  if (value.size > MAX_PROJECT_FILE_BYTES) {
    throw new Error("Project files must be smaller than 25MB.");
  }

  return value;
}

function revalidateProjectFilePaths(projectId: string) {
  revalidatePath("/projects");
  revalidatePath("/projects/files");
  revalidatePath("/dashboard");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/files`);
}