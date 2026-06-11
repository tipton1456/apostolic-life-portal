import type { PostgrestError } from "@supabase/supabase-js";

export const PROJECT_BASE_SELECT =
  "id,name,description,status,start_date,target_end_date,image_url,created_by,created_at,updated_at";

export const PROJECT_SELECT_WITH_ARCHIVE = `${PROJECT_BASE_SELECT},archived_files_url`;

export const FILE_ROW_SELECT_STORAGE =
  "id,project_id,task_id,file_name,file_size,mime_type,storage_path,uploaded_by,created_at";

export const FILE_ROW_SELECT_DROPBOX =
  "id,project_id,task_id,file_name,file_size,mime_type,dropbox_path,uploaded_by,created_at";

type ProjectRowBase = {
  id: string;
  name: string;
  description: string;
  status: string;
  start_date: string | null;
  target_end_date: string | null;
  image_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_files_url?: string | null;
};

type FileRowBase = {
  id: string;
  project_id: string;
  task_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  created_at: string;
  storage_path?: string;
  dropbox_path?: string;
};

export function isMissingColumnError(
  error: PostgrestError | null | undefined,
  columnName: string,
) {
  if (!error) return false;

  const haystack = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();

  return haystack.includes(columnName.toLowerCase());
}

export function isMissingRelationError(
  error: PostgrestError | null | undefined,
  relationName: string,
) {
  if (!error) return false;

  const haystack = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();

  return (
    haystack.includes("does not exist") &&
    haystack.includes(relationName.toLowerCase())
  );
}

export function normalizeProjectRow<T extends ProjectRowBase>(row: T) {
  return {
    ...row,
    archived_files_url: row.archived_files_url ?? null,
  };
}

export function normalizeFileRow<T extends FileRowBase>(row: T) {
  const storagePath = row.storage_path ?? row.dropbox_path ?? "";

  return {
    ...row,
    storage_path: storagePath,
  };
}

export function getFileInsertPayload({
  projectId,
  taskId,
  fileName,
  fileSize,
  mimeType,
  storagePath,
  uploadedBy,
  useDropboxColumn,
}: {
  projectId: string;
  taskId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  uploadedBy: string;
  useDropboxColumn: boolean;
}) {
  const base = {
    project_id: projectId,
    task_id: taskId,
    file_name: fileName,
    file_size: fileSize,
    mime_type: mimeType,
    uploaded_by: uploadedBy,
  };

  if (useDropboxColumn) {
    return {
      ...base,
      dropbox_path: storagePath,
    };
  }

  return {
    ...base,
    storage_path: storagePath,
  };
}