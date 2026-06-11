import { access, mkdir, readFile, unlink, writeFile } from "fs/promises";
import { dirname, join, relative, resolve } from "path";

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

  return [projectId, taskId, `${Date.now()}-${safeName}`].join("/");
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
}: {
  relativePath: string;
  contents: Buffer;
}) {
  const absolutePath = resolveProjectTaskStoragePath(relativePath);

  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents);
}

export async function readProjectTaskFile(relativePath: string) {
  const absolutePath = resolveProjectTaskStoragePath(relativePath);

  return readFile(absolutePath);
}

export async function deleteProjectTaskFile(relativePath: string) {
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