"use server";

import JSZip from "jszip";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  buildProjectTaskStoragePath,
  deleteProjectTaskFile as deleteStoredProjectTaskFile,
  readProjectTaskFile,
  writeProjectTaskFile,
} from "@/lib/project-file-storage";
import {
  parseProjectTaskUploadFile,
  parseProjectTaskUploadFiles,
} from "@/lib/project-files-utils";
import {
  FILE_ROW_SELECT_DROPBOX,
  FILE_ROW_SELECT_STORAGE,
  getFileInsertPayload,
  isMissingColumnError,
  isMissingRelationError,
  normalizeFileRow,
} from "@/lib/project-db-compat";
import { canCurrentUserAccessProjects } from "@/lib/project-management";
import { isPortalProjectManager } from "@/lib/portal-project-roles";
import { getCurrentPortalUser } from "@/lib/portal-users";
import { ProjectFileDownloadError } from "@/lib/project-file-download-error";
import { ProjectFileStorageError } from "@/lib/project-file-storage-error";
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
  storage_path: string;
  uploaded_by: string;
  created_at: string;
};

const MAX_FILES_PER_TASK = 20;

export async function listAccessibleProjectFiles(
  limit = 100,
): Promise<ProjectTaskFile[]> {
  await requireProjectFilesAccess();

  const currentUser = await getCurrentPortalUser();

  if (!currentUser) return [];

  const isManager = isPortalProjectManager(currentUser);
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

  const rows = await queryProjectTaskFileRows(supabase, {
    limit,
    projectIds: projectIds ?? undefined,
  });

  return enrichProjectFiles(rows);
}

export async function listProjectFiles(projectId: string): Promise<ProjectTaskFile[]> {
  await requireProjectFilesAccessForProject(projectId);

  const supabase = await createClient();
  const rows = await queryProjectTaskFileRows(supabase, { projectId });

  return enrichProjectFiles(rows);
}

export async function listTaskFiles(
  projectId: string,
  taskId: string,
): Promise<ProjectTaskFile[]> {
  await requireProjectFilesAccessForProject(projectId);

  const supabase = await createClient();
  const rows = await queryProjectTaskFileRows(supabase, { projectId, taskId });

  return enrichProjectFiles(rows);
}

export async function storeProjectTaskFile({
  projectId,
  taskId,
  file,
  uploadedBy,
  skipCapacityCheck = false,
}: {
  projectId: string;
  taskId: string;
  file: File;
  uploadedBy: string;
  skipCapacityCheck?: boolean;
}) {
  const supabase = await createClient();
  const [{ data: project, error: projectError }, { data: task, error: taskError }, { count, error: countError }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("status")
        .eq("id", projectId)
        .maybeSingle<{ status: string }>(),
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

  if (projectError || !project) {
    throw new Error("Project not found.");
  }

  if (project.status === "completed") {
    throw new Error("Completed projects no longer accept new file uploads.");
  }

  if (taskError || !task) {
    throw new Error("Task not found.");
  }

  if (countError) {
    throw new Error("Unable to validate task file count.");
  }

  if (!skipCapacityCheck && (count ?? 0) >= MAX_FILES_PER_TASK) {
    throw new Error(`Each task can have up to ${MAX_FILES_PER_TASK} files.`);
  }

  const storagePath = buildProjectTaskStoragePath({
    fileName: file.name,
    projectId,
    taskId,
  });
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  await writeProjectTaskFile({
    relativePath: storagePath,
    contents: fileBuffer,
    contentType: file.type || "application/octet-stream",
    supabase,
  });

  const insertPayload = {
    projectId,
    taskId,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream",
    storagePath,
    uploadedBy,
  };

  let insertResult = await supabase
    .from("project_task_files")
    .insert(
      getFileInsertPayload({
        ...insertPayload,
        useDropboxColumn: false,
      }) as Record<string, string | number>,
    )
    .select("id")
    .single<{ id: string }>();

  if (insertResult.error && isMissingColumnError(insertResult.error, "storage_path")) {
    insertResult = await supabase
      .from("project_task_files")
      .insert(
        getFileInsertPayload({
          ...insertPayload,
          useDropboxColumn: true,
        }) as Record<string, string | number>,
      )
      .select("id")
      .single<{ id: string }>();
  }

  if (
    insertResult.error &&
    isMissingRelationError(insertResult.error, "project_task_files")
  ) {
    try {
      await deleteStoredProjectTaskFile(storagePath);
    } catch (cleanupError) {
      console.error("Storage cleanup after missing files table:", cleanupError);
    }

    throw new Error(
      "Project files are not enabled yet. Apply migration 202606110004 in Supabase.",
    );
  }

  if (insertResult.error || !insertResult.data?.id) {
    console.error("Project task file insert failed:", insertResult.error);

    try {
      await deleteStoredProjectTaskFile(storagePath);
    } catch (cleanupError) {
      console.error("Storage cleanup after failed insert:", cleanupError);
    }

    throw new Error(insertResult.error?.message ?? "Unable to save project file.");
  }

  return insertResult.data.id;
}

export async function uploadProjectTaskFile(formData: FormData) {
  await requireProjectFilesAccess();

  const projectId = String(formData.get("projectId") || "");
  const taskId = String(formData.get("taskId") || "");
  const files = parseProjectTaskUploadFiles(formData.getAll("taskFile"));

  if (!projectId || !taskId || files.length === 0) {
    throw new Error("Project ID, task ID, and at least one file are required.");
  }

  await requireProjectFilesAccessForProject(projectId);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/projects");
  }

  const { count, error: countError } = await supabase
    .from("project_task_files")
    .select("id", { count: "exact", head: true })
    .eq("task_id", taskId);

  if (countError) {
    throw new Error("Unable to validate task file count.");
  }

  if ((count ?? 0) + files.length > MAX_FILES_PER_TASK) {
    throw new Error(`Each task can have up to ${MAX_FILES_PER_TASK} files.`);
  }

  for (const file of files) {
    await storeProjectTaskFile({
      file,
      projectId,
      taskId,
      uploadedBy: user.id,
      skipCapacityCheck: true,
    });
  }

  revalidateProjectFilePaths(projectId);
  redirect(`/projects/${projectId}?task=${taskId}`);
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
    isPortalProjectManager(currentUser ?? {}),
  );

  const [{ data: project }, { data: file, error }] = await Promise.all([
    supabase
      .from("projects")
      .select("status")
      .eq("id", projectId)
      .maybeSingle<{ status: string }>(),
    fetchProjectTaskFileRecord(supabase, fileId, projectId),
  ]);

  if (error || !file) {
    throw new Error("File not found.");
  }

  if (project?.status === "completed") {
    throw new Error("Files on completed projects cannot be deleted.");
  }

  if (!isManager && file.uploaded_by !== user.id) {
    throw new Error("You do not have permission to delete this file.");
  }

  try {
    await deleteStoredProjectTaskFile(file.storage_path, { supabase });
  } catch (error) {
    console.error("Project file storage delete failed:", error);
  }

  const { error: deleteError } = await supabase
    .from("project_task_files")
    .delete()
    .eq("id", fileId);

  if (deleteError) {
    console.error("Project task file delete failed:", deleteError);
    throw new Error(deleteError.message);
  }

  revalidateProjectFilePaths(projectId);

  const taskId = String(formData.get("taskId") || "").trim();
  const returnTo = String(formData.get("returnTo") || "").trim();

  if (taskId) {
    redirect(`/projects/${projectId}?task=${taskId}`);
  }

  if (returnTo === "all-files") {
    redirect("/projects/files");
  }

  redirect(`/projects/${projectId}/files`);
}

export async function getProjectFileForDownload(fileId: string) {
  const currentUser = await getCurrentPortalUser();

  if (!currentUser) {
    throw new ProjectFileDownloadError("You must be signed in to download files.", 401);
  }

  const supabase = await createClient();
  const { data: file, error } = await fetchProjectTaskFileRecord(
    supabase,
    fileId,
  );

  if (error || !file) {
    throw new ProjectFileDownloadError("File not found.", 404);
  }

  const canDownload = await userCanDownloadProjectFile(file.project_id, currentUser);

  if (!canDownload) {
    throw new ProjectFileDownloadError("You do not have access to this file.", 403);
  }

  try {
    const contents = await readProjectTaskFile(file.storage_path, { supabase });

    return {
      contents,
      fileName: file.file_name,
      mimeType: file.mime_type || "application/octet-stream",
    };
  } catch (error) {
    if (error instanceof ProjectFileStorageError) {
      throw new ProjectFileDownloadError(error.message, 404);
    }

    throw error;
  }
}

export async function buildProjectFilesZip(projectId: string) {
  await requireProjectFilesAccessForProject(projectId);

  const supabase = await createClient();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("name,status")
    .eq("id", projectId)
    .maybeSingle<{ name: string; status: string }>();

  if (projectError || !project) {
    throw new Error("Project not found.");
  }

  const files = await listProjectFiles(projectId);

  if (files.length === 0) {
    throw new Error("This project has no files to download.");
  }

  const zip = new JSZip();

  for (const file of files) {
    const { data: row, error } = await fetchProjectTaskFileRecord(supabase, file.id);

    if (error || !row) {
      continue;
    }

    const contents = await readProjectTaskFile(row.storage_path, { supabase });
    const folderName = sanitizeZipPathSegment(file.taskTitle || "task");
    const fileName = sanitizeZipPathSegment(file.fileName);

    zip.file(`${folderName}/${fileName}`, contents);
  }

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  const safeProjectName = sanitizeZipPathSegment(project.name || "project");

  return {
    buffer: zipBuffer,
    fileName: `${safeProjectName}-files.zip`,
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
  const isManager = isPortalProjectManager(currentUser);

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

async function userCanDownloadProjectFile(
  projectId: string,
  currentUser: NonNullable<Awaited<ReturnType<typeof getCurrentPortalUser>>>,
) {
  if (isPortalProjectManager(currentUser)) {
    return true;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Project file download permission lookup failed:", error);
    return false;
  }

  return Boolean(data);
}

function revalidateProjectFilePaths(projectId: string) {
  revalidatePath("/projects");
  revalidatePath("/projects/files");
  revalidatePath("/dashboard");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/files`);
}

function sanitizeZipPathSegment(value: string) {
  return value.replace(/[^\w.\-() ]+/g, "_").trim() || "file";
}

async function queryProjectTaskFileRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: {
    projectId?: string;
    taskId?: string;
    projectIds?: string[];
    limit?: number;
  } = {},
) {
  const runQuery = async (select: string) => {
    let query = supabase.from("project_task_files").select(select);

    if (filters.projectId) {
      query = query.eq("project_id", filters.projectId);
    }

    if (filters.taskId) {
      query = query.eq("task_id", filters.taskId);
    }

    if (filters.projectIds?.length) {
      query = query.in("project_id", filters.projectIds);
    }

    query = query.order("created_at", { ascending: false });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    return query;
  };

  let { data, error } = await runQuery(FILE_ROW_SELECT_STORAGE);

  if (error && isMissingColumnError(error, "storage_path")) {
    ({ data, error } = await runQuery(FILE_ROW_SELECT_DROPBOX));
  }

  if (error && isMissingRelationError(error, "project_task_files")) {
    console.warn("Project task files table is not available yet.");
    return [] as ProjectTaskFileRow[];
  }

  if (error) {
    console.error("Project files lookup failed:", error);
    throw new Error("Unable to load project files.");
  }

  return ((data ?? []) as unknown as Array<ProjectTaskFileRow & { dropbox_path?: string }>).map(
    (row) => normalizeFileRow(row) as ProjectTaskFileRow,
  );
}

async function fetchProjectTaskFileRecord(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fileId: string,
  projectId?: string,
) {
  const build = (select: string) => {
    let query = supabase
      .from("project_task_files")
      .select(select)
      .eq("id", fileId);

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    return query.maybeSingle();
  };

  let { data, error } = await build("id,project_id,storage_path,file_name,mime_type,uploaded_by");

  if (error && isMissingColumnError(error, "storage_path")) {
    ({ data, error } = await build(
      "id,project_id,dropbox_path,file_name,mime_type,uploaded_by",
    ));
  }

  if (error && isMissingRelationError(error, "project_task_files")) {
    return { data: null, error };
  }

  if (error || !data) {
    return { data: null, error };
  }

  const normalized = normalizeFileRow(
    data as unknown as ProjectTaskFileRow & { dropbox_path?: string },
  );

  return {
    data: normalized as {
      id: string;
      project_id: string;
      storage_path: string;
      file_name: string;
      mime_type: string;
      uploaded_by: string;
    },
    error: null,
  };
}