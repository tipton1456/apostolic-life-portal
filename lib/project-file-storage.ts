import { randomUUID } from "crypto";
import { access, mkdir, readFile, unlink, writeFile } from "fs/promises";
import { dirname, join, relative, resolve } from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ProjectFileStorageError } from "@/lib/project-file-storage-error";
import { createAdminClient, hasAdminClientConfig } from "@/lib/supabase/admin";

export const PROJECT_FILES_BUCKET = "project-files";

export function getProjectFilesStorageRoot() {
  const configured = process.env.PROJECT_FILES_STORAGE_PATH?.trim();

  if (configured) {
    return configured;
  }

  if (process.env.VERCEL) {
    return join("/tmp", "project-files");
  }

  return join(/* turbopackIgnore: true */ process.cwd(), "storage", "project-files");
}

export function buildProjectTaskStoragePath({
  fileName,
  projectId,
  taskId,
}: {
  fileName: string;
  projectId: string;
  taskId: string;
}) {
  const safeName = sanitizeProjectFileName(fileName);

  return [projectId, taskId, `${Date.now()}-${randomUUID()}-${safeName}`].join("/");
}

export function resolveProjectTaskStoragePath(relativePath: string) {
  const root = resolve(getProjectFilesStorageRoot());
  const absolutePath = resolve(root, relativePath);

  const pathWithinRoot = relative(root, absolutePath);

  if (pathWithinRoot.startsWith("..") || pathWithinRoot.startsWith("/")) {
    throw new Error("Invalid project file path.");
  }

  return absolutePath;
}

export async function writeProjectTaskFile({
  relativePath,
  contents,
  contentType = "application/octet-stream",
  supabase,
}: {
  relativePath: string;
  contents: Buffer;
  contentType?: string;
  supabase?: SupabaseClient;
}) {
  const uploadErrors: string[] = [];

  if (supabase) {
    const uploaded = await uploadToSupabase({
      client: supabase,
      relativePath,
      contents,
      contentType,
      label: "session",
      uploadErrors,
    });

    if (uploaded) return;
  }

  if (hasAdminClientConfig()) {
    const admin = createAdminClient();
    const uploaded = await uploadToSupabase({
      client: admin,
      relativePath,
      contents,
      contentType,
      label: "admin",
      uploadErrors,
    });

    if (uploaded) return;
  }

  if (canUseLocalFileStorage()) {
    const absolutePath = resolveProjectTaskStoragePath(relativePath);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, contents);
    return;
  }

  throw new ProjectFileStorageError(formatStorageFailureMessage(uploadErrors));
}

export async function readProjectTaskFile(
  relativePath: string,
  options?: { supabase?: SupabaseClient },
) {
  const normalizedPath = relativePath.trim();

  if (!normalizedPath) {
    throw new ProjectFileStorageError("Project file path is missing.");
  }

  const downloadErrors: string[] = [];

  if (options?.supabase) {
    const buffer = await downloadFromSupabase({
      client: options.supabase,
      relativePath: normalizedPath,
      label: "session",
      downloadErrors,
    });

    if (buffer) return buffer;
  }

  if (hasAdminClientConfig()) {
    try {
      const admin = createAdminClient();
      const buffer = await downloadFromSupabase({
        client: admin,
        relativePath: normalizedPath,
        label: "admin",
        downloadErrors,
      });

      if (buffer) return buffer;
    } catch (error) {
      downloadErrors.push(
        `admin: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }

  if (canUseLocalFileStorage()) {
    try {
      const absolutePath = resolveProjectTaskStoragePath(normalizedPath);
      return await readFile(absolutePath);
    } catch (error) {
      if (isMissingLocalFileError(error)) {
        downloadErrors.push("local: file not found");
      } else {
        throw error;
      }
    }
  }

  throw new ProjectFileStorageError(formatStorageFailureMessage(downloadErrors, true));
}

export async function deleteProjectTaskFile(
  relativePath: string,
  options?: { supabase?: SupabaseClient },
) {
  if (!relativePath.trim()) {
    return;
  }

  if (options?.supabase) {
    const { error } = await options.supabase.storage
      .from(PROJECT_FILES_BUCKET)
      .remove([relativePath]);

    if (!error) {
      return;
    }

    if (!isSupabaseNotFoundError(error)) {
      console.error("Session project file delete failed:", error);
    }
  }

  if (hasAdminClientConfig()) {
    const admin = createAdminClient();
    const { error } = await admin.storage.from(PROJECT_FILES_BUCKET).remove([relativePath]);

    if (error && !isSupabaseNotFoundError(error)) {
      console.error("Admin project file delete failed:", error);
    }
  }

  if (!canUseLocalFileStorage()) {
    return;
  }

  const absolutePath = resolveProjectTaskStoragePath(relativePath);

  try {
    await access(absolutePath);
  } catch {
    return;
  }

  await unlink(absolutePath);
}

async function uploadToSupabase({
  client,
  relativePath,
  contents,
  contentType,
  label,
  uploadErrors,
}: {
  client: SupabaseClient;
  relativePath: string;
  contents: Buffer;
  contentType: string;
  label: string;
  uploadErrors: string[];
}) {
  const contentTypes = uniqueContentTypes(contentType);

  for (const nextContentType of contentTypes) {
    const { error } = await client.storage.from(PROJECT_FILES_BUCKET).upload(relativePath, contents, {
      contentType: nextContentType,
      upsert: false,
    });

    if (!error) {
      return true;
    }

    uploadErrors.push(`${label}: ${error.message}`);

    if (!shouldRetryWithGenericMimeType(error, nextContentType)) {
      break;
    }
  }

  return false;
}

async function downloadFromSupabase({
  client,
  relativePath,
  label,
  downloadErrors,
}: {
  client: SupabaseClient;
  relativePath: string;
  label: string;
  downloadErrors: string[];
}) {
  const { data, error } = await client.storage
    .from(PROJECT_FILES_BUCKET)
    .download(relativePath);

  if (!error && data) {
    return Buffer.from(await data.arrayBuffer());
  }

  if (error) {
    downloadErrors.push(`${label}: ${error.message}`);

    if (!isSupabaseNotFoundError(error)) {
      console.error(`${label} project file download failed:`, error);
    }
  }

  return null;
}

function canUseLocalFileStorage() {
  if (process.env.PROJECT_FILES_STORAGE_PATH?.trim()) {
    return true;
  }

  return !process.env.VERCEL;
}

function uniqueContentTypes(contentType: string) {
  const normalized = contentType.trim() || "application/octet-stream";

  if (normalized === "application/octet-stream") {
    return [normalized];
  }

  return [normalized, "application/octet-stream"];
}

function shouldRetryWithGenericMimeType(
  error: { message?: string },
  attemptedContentType: string,
) {
  if (attemptedContentType === "application/octet-stream") {
    return false;
  }

  const message = (error.message ?? "").toLowerCase();

  return message.includes("mime") || message.includes("content type");
}

function formatStorageFailureMessage(errors: string[], isDownload = false) {
  if (errors.some((entry) => entry.toLowerCase().includes("bucket not found"))) {
    return "Project file storage is not set up yet. Apply migration 202606110008 in Supabase.";
  }

  if (errors.length > 0) {
    const action = isDownload
      ? "This file could not be loaded from project storage."
      : "Unable to save the project file to storage.";

    return `${action} ${errors.join(" | ")}`;
  }

  return isDownload
    ? "This file is no longer available. Please re-upload it."
    : "Project file storage is not configured.";
}

function sanitizeProjectFileName(fileName: string) {
  const baseName = fileName.split(/[/\\]/).pop() ?? "file";

  return baseName.replace(/[^\w.\-() ]+/g, "_").slice(0, 180) || "file";
}

function isMissingLocalFileError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function isSupabaseNotFoundError(error: { message?: string; statusCode?: string | number }) {
  const message = (error.message ?? "").toLowerCase();

  return (
    message.includes("not found") ||
    message.includes("object not found") ||
    message.includes("does not exist") ||
    error.statusCode === "404" ||
    error.statusCode === 404
  );
}