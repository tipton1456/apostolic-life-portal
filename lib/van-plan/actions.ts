"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import {
  VAN_PLAN_BASE_PATH,
  VAN_PLAN_ITEM_STATUSES,
} from "@/lib/van-plan/constants";
import {
  authenticateVanPlanUser,
  countVanPlanUsers,
  destroyVanPlanSession,
  getCurrentVanPlanUser,
  requireItemManager,
  requireVanPlanAdmin,
} from "@/lib/van-plan/auth";
import { placeVanPlanBid } from "@/lib/van-plan/bids";
import { VanPlanError, isVanPlanError, nextActionState } from "@/lib/van-plan/db";
import {
  addImagesToItem,
  createVanPlanItem,
  getVanPlanItemById,
  parseItemStatus,
  setPrimaryItemImage,
  updateVanPlanItem,
} from "@/lib/van-plan/items";
import { markItemSoldAndInvoice, retryStripeInvoice } from "@/lib/van-plan/stripe";
import { dollarsToCents, parsePermission, sanitizeNextPathSafe } from "@/lib/van-plan/security";
import type { VanPlanActionState } from "@/lib/van-plan/types";
import { createVanPlanUser, updateVanPlanUserPermission } from "@/lib/van-plan/users";
import { vanPlanDb } from "@/lib/van-plan/db";

function revalidateAuction(paths: string[] = []) {
  revalidatePath(VAN_PLAN_BASE_PATH);

  for (const path of paths) {
    revalidatePath(path);
  }
}

function actionError(error: unknown, version: number): VanPlanActionState {
  unstable_rethrow(error);

  if (isVanPlanError(error)) {
    return nextActionState("error", error.message, version);
  }

  console.error("Van Plan action failed:", error);
  return nextActionState("error", "Something went wrong. Please try again.", version);
}

export async function loginVanPlanUserAction(
  _prev: VanPlanActionState,
  formData: FormData,
): Promise<VanPlanActionState> {
  const version = Number(formData.get("version") ?? 0);
  const nextPath = sanitizeNextPathSafe(
    String(formData.get("next") ?? VAN_PLAN_BASE_PATH),
  );

  try {
    await authenticateVanPlanUser({
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
    });
  } catch (error) {
    return actionError(error, version);
  }

  redirect(nextPath);
}

export async function logoutVanPlanUserAction() {
  await destroyVanPlanSession();
  redirect(`${VAN_PLAN_BASE_PATH}/login`);
}

export async function bootstrapVanPlanAdminAction(
  _prev: VanPlanActionState,
  formData: FormData,
): Promise<VanPlanActionState> {
  const version = Number(formData.get("version") ?? 0);

  try {
    const existing = await countVanPlanUsers();

    if (existing > 0) {
      throw new VanPlanError("Auction setup is already complete. Please sign in.");
    }

    const user = await createVanPlanUser({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      permission: "admin",
    });

    const { createVanPlanSession } = await import("@/lib/van-plan/auth");
    await createVanPlanSession(user.id);
  } catch (error) {
    return actionError(error, version);
  }

  redirect(`${VAN_PLAN_BASE_PATH}/admin`);
}

export async function createVanPlanUserAction(
  _prev: VanPlanActionState,
  formData: FormData,
): Promise<VanPlanActionState> {
  const version = Number(formData.get("version") ?? 0);

  try {
    await requireVanPlanAdmin(`${VAN_PLAN_BASE_PATH}/admin/users`);
    await createVanPlanUser({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      permission: parsePermission(formData.get("permission")),
    });
    revalidateAuction([`${VAN_PLAN_BASE_PATH}/admin/users`]);
    return nextActionState("success", "User added.", version);
  } catch (error) {
    return actionError(error, version);
  }
}

export async function updateVanPlanUserPermissionAction(
  _prev: VanPlanActionState,
  formData: FormData,
): Promise<VanPlanActionState> {
  const version = Number(formData.get("version") ?? 0);

  try {
    const admin = await requireVanPlanAdmin(`${VAN_PLAN_BASE_PATH}/admin/users`);
    await updateVanPlanUserPermission({
      userId: String(formData.get("userId") ?? ""),
      permission: parsePermission(formData.get("permission")),
      actorId: admin.id,
    });
    revalidateAuction([`${VAN_PLAN_BASE_PATH}/admin/users`]);
    return nextActionState("success", "Permission updated.", version);
  } catch (error) {
    return actionError(error, version);
  }
}

function collectImages(formData: FormData) {
  return formData
    .getAll("images")
    .filter((value): value is File => value instanceof File && value.size > 0);
}

export async function createVanPlanItemAction(
  _prev: VanPlanActionState,
  formData: FormData,
): Promise<VanPlanActionState> {
  const version = Number(formData.get("version") ?? 0);
  let itemSlug = "";

  try {
    const user = await requireItemManager(`${VAN_PLAN_BASE_PATH}/admin`);
    const item = await createVanPlanItem({
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      startingPriceCents: dollarsToCents(String(formData.get("startingPrice") ?? "")),
      status: parseItemStatus(formData.get("status") ?? "draft"),
      createdBy: user.id,
      images: collectImages(formData),
    });
    itemSlug = item.slug;
    revalidateAuction([`${VAN_PLAN_BASE_PATH}/admin`, `${VAN_PLAN_BASE_PATH}/items/${item.slug}`]);
  } catch (error) {
    return actionError(error, version);
  }

  redirect(`${VAN_PLAN_BASE_PATH}/items/${itemSlug}`);
}

export async function updateVanPlanItemAction(
  _prev: VanPlanActionState,
  formData: FormData,
): Promise<VanPlanActionState> {
  const version = Number(formData.get("version") ?? 0);

  try {
    await requireItemManager(`${VAN_PLAN_BASE_PATH}/admin`);
    const itemId = String(formData.get("itemId") ?? "");
    await updateVanPlanItem({
      itemId,
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      startingPriceCents: dollarsToCents(String(formData.get("startingPrice") ?? "")),
    });

    const images = collectImages(formData);
    if (images.length > 0) {
      await addImagesToItem(itemId, images);
    }

    const item = await getVanPlanItemById(itemId);
    revalidateAuction([
      `${VAN_PLAN_BASE_PATH}/admin`,
      `${VAN_PLAN_BASE_PATH}/admin/items/${item.id}`,
      `${VAN_PLAN_BASE_PATH}/items/${item.slug}`,
    ]);
    return nextActionState("success", "Item updated.", version);
  } catch (error) {
    return actionError(error, version);
  }
}

export async function setPrimaryItemImageAction(formData: FormData) {
  await requireItemManager(`${VAN_PLAN_BASE_PATH}/admin`);
  const itemId = String(formData.get("itemId") ?? "");
  const imageId = String(formData.get("imageId") ?? "");
  await setPrimaryItemImage(itemId, imageId);
  const item = await getVanPlanItemById(itemId);
  revalidateAuction([
    `${VAN_PLAN_BASE_PATH}/admin/items/${item.id}`,
    `${VAN_PLAN_BASE_PATH}/items/${item.slug}`,
  ]);
}

export async function updateVanPlanItemStatusAction(
  _prev: VanPlanActionState,
  formData: FormData,
): Promise<VanPlanActionState> {
  const version = Number(formData.get("version") ?? 0);

  try {
    await requireItemManager(`${VAN_PLAN_BASE_PATH}/admin`);
    const itemId = String(formData.get("itemId") ?? "");
    const status = parseItemStatus(formData.get("status"));

    if (!VAN_PLAN_ITEM_STATUSES.includes(status)) {
      throw new VanPlanError("Choose a valid item status.");
    }

    if (status === "sold") {
      const invoice = await markItemSoldAndInvoice(itemId);
      const item = await getVanPlanItemById(itemId);
      revalidateAuction([
        `${VAN_PLAN_BASE_PATH}/admin`,
        `${VAN_PLAN_BASE_PATH}/items/${item.slug}`,
      ]);

      if (invoice.status === "sent") {
        return nextActionState(
          "success",
          "Item marked sold and the invoice was sent to the highest bidder.",
          version,
        );
      }

      return nextActionState(
        "error",
        `Item marked sold, but the invoice was not sent: ${invoice.errorMessage ?? "unknown error"}.`,
        version,
      );
    }

    const db = vanPlanDb();
    const { error } = await db
      .from("van_plan_items")
      .update({
        status,
        sold_to_user_id: null,
        sold_at: null,
      })
      .eq("id", itemId);

    if (error) {
      throw new VanPlanError("Unable to update item status.", 500);
    }

    const item = await getVanPlanItemById(itemId);
    revalidateAuction([
      `${VAN_PLAN_BASE_PATH}/admin`,
      `${VAN_PLAN_BASE_PATH}/items/${item.slug}`,
    ]);
    return nextActionState("success", `Status updated to ${status}.`, version);
  } catch (error) {
    return actionError(error, version);
  }
}

export async function retryVanPlanInvoiceAction(
  _prev: VanPlanActionState,
  formData: FormData,
): Promise<VanPlanActionState> {
  const version = Number(formData.get("version") ?? 0);

  try {
    await requireItemManager(`${VAN_PLAN_BASE_PATH}/admin`);
    const invoice = await retryStripeInvoice(String(formData.get("invoiceId") ?? ""));
    const item = await getVanPlanItemById(invoice.itemId);
    revalidateAuction([`${VAN_PLAN_BASE_PATH}/items/${item.slug}`]);

    if (invoice.status === "sent") {
      return nextActionState("success", "Invoice sent.", version);
    }

    return nextActionState(
      "error",
      invoice.errorMessage ?? "Unable to send the invoice.",
      version,
    );
  } catch (error) {
    return actionError(error, version);
  }
}

export async function placeVanPlanBidAction(
  _prev: VanPlanActionState,
  formData: FormData,
): Promise<VanPlanActionState> {
  const version = Number(formData.get("version") ?? 0);
  const itemId = String(formData.get("itemId") ?? "");

  try {
    const user = await getCurrentVanPlanUser();

    if (!user) {
      throw new VanPlanError("Sign in to place a bid.");
    }

    await placeVanPlanBid({
      itemId,
      amountCents: dollarsToCents(String(formData.get("amount") ?? "")),
      bidder: user,
    });

    const item = await getVanPlanItemById(itemId);
    revalidateAuction([`${VAN_PLAN_BASE_PATH}/items/${item.slug}`]);
    return nextActionState("success", "Bid placed.", version);
  } catch (error) {
    return actionError(error, version);
  }
}


