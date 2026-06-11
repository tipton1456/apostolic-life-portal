import { randomUUID } from "crypto";
import { access, mkdir, readFile, unlink, writeFile } from "fs/promises";
import { dirname, join, relative, resolve } from "path";
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
}: {
  relativePath: string;
  contents: Buffer;
  contentType?: string;
}) {
  if (hasAdminClientConfig()) {
    const admin = createAdminClient();
    const { error } = await admin.storage.from(PROJECT_FILES_BUCKET).upload(relativePath, contents, {
      contentType,
      upsert: false,
    });

    if (!error) {
      return;
    }

    console.error("Supabase project file upload failed, falling back to local storage:", error);
  }

  const absolutePath = resolveProjectTaskStoragePath(relativePath);

  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents);
}

export async function readProjectTaskFile(relativePath: string) {
  if (!relativePath.trim()) {
    throw new Error("Project file path is missing.");
  }

  if (hasAdminClientConfig()) {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(PROJECT_FILES_BUCKET)
      .download(relativePath);

    if (!error && data) {
      return Buffer.from(await data.arrayBuffer());
    }

    if (error && !isSupabaseNotFoundError(error)) {
      console.error("Supabase project file download failed:", error);
    }
  }

  try {
    const absolutePath = resolveProjectTaskStoragePath(relativePath);
    return await readFile(absolutePath);
  } catch (error) {
    if (isMissingLocalFileError(error)) {
      throw new Error("This file is no longer available. Please re-upload it.");
    }

    throw error;
  }
}

export async function deleteProjectTaskFile(relativePath: string) {
  if (!relativePath.trim()) {
    return;
  }

  if (hasAdminClientConfig()) {
    const admin = createAdminClient();
    const { error } = await admin.storage.from(PROJECT_FILES_BUCKET).remove([relativePath]);

    if (error && !isSupabaseNotFoundError(error)) {
      console.error("Supabase project file delete failed:", error);
    }
  }

  const absolutePath = resolveProjectTaskStoragePath(relativePath);

  try {
    await access(absolutePath);
  } catch {
    return;
  }

  await unlink(absolutePath);
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
    error.statusCode === "404" ||
    error.statusCode === 404
  );
}