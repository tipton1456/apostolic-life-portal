import { randomUUID } from "crypto";
import { access, mkdir, readFile, unlink, writeFile } from "fs/promises";
import { dirname, join, relative, resolve } from "path";
import {
  VAN_PLAN_ALLOWED_IMAGE_TYPES,
  VAN_PLAN_BASE_PATH,
  VAN_PLAN_MAX_IMAGE_BYTES,
} from "@/lib/van-plan/constants";
import { VanPlanError, vanPlanDb } from "@/lib/van-plan/db";

export const VAN_PLAN_IMAGES_BUCKET = "van-plan-images";

type ImageRow = {
  id: string;
  item_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  is_primary: boolean;
  sort_order: number;
};

export function itemImageUrl(imageId: string) {
  return `${VAN_PLAN_BASE_PATH}/images/${imageId}`;
}

export function mapItemImage(row: ImageRow) {
  return {
    id: row.id,
    itemId: row.item_id,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    isPrimary: row.is_primary,
    sortOrder: row.sort_order,
    url: itemImageUrl(row.id),
  };
}

export function getVanPlanImageStorageRoot() {
  const configured = process.env.VAN_PLAN_IMAGES_STORAGE_PATH?.trim();

  if (configured) return configured;

  if (process.env.VERCEL) {
    return join("/tmp", "van-plan-images");
  }

  return join(
    /* turbopackIgnore: true */ process.cwd(),
    "storage",
    "van-plan-images",
  );
}

function resolveVanPlanImagePath(relativePath: string) {
  const root = resolve(getVanPlanImageStorageRoot());
  const absolutePath = resolve(root, relativePath);
  const pathWithinRoot = relative(root, absolutePath);

  if (pathWithinRoot.startsWith("..") || pathWithinRoot.startsWith("/")) {
    throw new VanPlanError("Invalid image path.", 400);
  }

  return absolutePath;
}

function canUseLocalImageStorage() {
  if (process.env.VAN_PLAN_IMAGES_STORAGE_PATH?.trim()) {
    return true;
  }

  return !process.env.VERCEL;
}

export function assertVanPlanImageFile(file: File) {
  if (!VAN_PLAN_ALLOWED_IMAGE_TYPES.includes(file.type as (typeof VAN_PLAN_ALLOWED_IMAGE_TYPES)[number])) {
    throw new VanPlanError("Images must be JPEG, PNG, WebP, or GIF.");
  }

  if (file.size > VAN_PLAN_MAX_IMAGE_BYTES) {
    throw new VanPlanError("Each image must be 8 MB or smaller.");
  }
}

export function sanitizeImageFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "image";
}

export async function storeVanPlanImage({
  itemId,
  file,
}: {
  itemId: string;
  file: File;
}) {
  assertVanPlanImageFile(file);

  const safeName = sanitizeImageFileName(file.name);
  const relativePath = `${itemId}/${Date.now()}-${randomUUID()}-${safeName}`;
  const contents = Buffer.from(await file.arrayBuffer());
  const db = vanPlanDb();

  const { error } = await db.storage.from(VAN_PLAN_IMAGES_BUCKET).upload(
    relativePath,
    contents,
    {
      contentType: file.type,
      upsert: false,
    },
  );

  if (error) {
    if (!canUseLocalImageStorage()) {
      console.error("Van Plan image upload failed:", error);
      throw new VanPlanError("Unable to store that image.", 500);
    }

    const absolutePath = resolveVanPlanImagePath(relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, contents);
  }

  return {
    relativePath,
    fileName: file.name,
    mimeType: file.type,
  };
}

export async function readVanPlanImage(relativePath: string) {
  const db = vanPlanDb();
  const { data, error } = await db.storage
    .from(VAN_PLAN_IMAGES_BUCKET)
    .download(relativePath);

  if (!error && data) {
    return Buffer.from(await data.arrayBuffer());
  }

  if (canUseLocalImageStorage()) {
    try {
      return await readFile(resolveVanPlanImagePath(relativePath));
    } catch {
      // Fall through to the storage error below.
    }
  }

  throw new VanPlanError("Image not found.", 404);
}

export async function deleteVanPlanImageFile(relativePath: string) {
  const db = vanPlanDb();
  await db.storage.from(VAN_PLAN_IMAGES_BUCKET).remove([relativePath]);

  if (!canUseLocalImageStorage()) return;

  try {
    const absolutePath = resolveVanPlanImagePath(relativePath);
    await access(absolutePath);
    await unlink(absolutePath);
  } catch {
    // Local copy may not exist when storage already succeeded.
  }
}

export async function getVanPlanImageRecord(imageId: string) {
  const db = vanPlanDb();
  const { data, error } = await db
    .from("van_plan_item_images")
    .select("id, item_id, storage_path, file_name, mime_type, is_primary, sort_order")
    .eq("id", imageId)
    .maybeSingle<ImageRow>();

  if (error || !data) {
    throw new VanPlanError("Image not found.", 404);
  }

  return mapItemImage(data);
}
