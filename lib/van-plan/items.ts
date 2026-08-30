import {
  VAN_PLAN_AUCTION_SETTINGS_SLUG,
  VAN_PLAN_ITEM_STATUSES,
  VAN_PLAN_MAX_IMAGES_PER_ITEM,
} from "@/lib/van-plan/constants";
import { VanPlanError, vanPlanDb } from "@/lib/van-plan/db";
import {
  copyVanPlanImageFile,
  deleteVanPlanImageFile,
  mapItemImage,
  storeVanPlanImage,
} from "@/lib/van-plan/images";
import { slugifyItemName } from "@/lib/van-plan/security";
import type {
  VanPlanBid,
  VanPlanItem,
  VanPlanItemImage,
  VanPlanItemStatus,
  VanPlanUser,
} from "@/lib/van-plan/types";

type ItemRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  starting_price_cents: number;
  status: VanPlanItemStatus;
  created_by: string | null;
  sold_to_user_id: string | null;
  sold_at: string | null;
  created_at: string;
  updated_at: string;
};

type ImageRow = {
  id: string;
  item_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  is_primary: boolean;
  sort_order: number;
};

type BidRow = {
  id: string;
  item_id: string;
  user_id: string;
  amount_cents: number;
  is_auto?: boolean | null;
  created_at: string;
  van_plan_users: {
    name: string;
    email: string;
    phone: string;
  } | {
    name: string;
    email: string;
    phone: string;
  }[] | null;
};

const ITEM_SELECT =
  "id, slug, name, description, starting_price_cents, status, created_by, sold_to_user_id, sold_at, created_at, updated_at";

const BID_SELECT_WITH_AUTO =
  "id, item_id, user_id, amount_cents, is_auto, created_at, van_plan_users (name, email, phone)";

const BID_SELECT_LEGACY =
  "id, item_id, user_id, amount_cents, created_at, van_plan_users (name, email, phone)";

let bidSelect = BID_SELECT_WITH_AUTO;

function shouldFallbackBidSelect(message: string | undefined) {
  return bidSelect === BID_SELECT_WITH_AUTO && /is_auto/i.test(message ?? "");
}

function mapBid(row: BidRow): VanPlanBid {
  const bidder = Array.isArray(row.van_plan_users)
    ? row.van_plan_users[0]
    : row.van_plan_users;

  return {
    id: row.id,
    itemId: row.item_id,
    userId: row.user_id,
    bidderName: bidder?.name ?? "Unknown bidder",
    bidderEmail: bidder?.email ?? "",
    bidderPhone: bidder?.phone ?? "",
    amountCents: row.amount_cents,
    isAuto: Boolean(row.is_auto),
    createdAt: row.created_at,
  };
}

function mapItem({
  item,
  images,
  bids,
}: {
  item: ItemRow;
  images: ImageRow[];
  bids: BidRow[];
}): VanPlanItem {
  const mappedImages = images
    .map(mapItemImage)
    .sort((left, right) => {
      if (left.isPrimary !== right.isPrimary) {
        return left.isPrimary ? -1 : 1;
      }

      return left.sortOrder - right.sortOrder;
    });

  const mappedBids = bids
    .map(mapBid)
    .sort((left, right) => {
      if (right.amountCents !== left.amountCents) {
        return right.amountCents - left.amountCents;
      }

      return left.createdAt.localeCompare(right.createdAt);
    });

  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    description: item.description,
    startingPriceCents: item.starting_price_cents,
    status: item.status,
    createdBy: item.created_by,
    soldToUserId: item.sold_to_user_id,
    soldAt: item.sold_at,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    images: mappedImages,
    highestBid: mappedBids[0] ?? null,
    bidCount: mappedBids.length,
  };
}

export function parseItemStatus(value: FormDataEntryValue | null): VanPlanItemStatus {
  const status = String(value ?? "").trim();

  if (!VAN_PLAN_ITEM_STATUSES.includes(status as VanPlanItemStatus)) {
    throw new VanPlanError("Choose a valid item status.");
  }

  return status as VanPlanItemStatus;
}

export function itemIsPublic(status: VanPlanItemStatus) {
  return status !== "draft";
}

export function primaryItemImage(item: VanPlanItem): VanPlanItemImage | null {
  return item.images.find((image) => image.isPrimary) ?? item.images[0] ?? null;
}

export async function listVanPlanItems(viewer: VanPlanUser | null) {
  const db = vanPlanDb();
  const query = db.from("van_plan_items").select(ITEM_SELECT).order("created_at", {
    ascending: false,
  });

  const { data, error } = await query.returns<ItemRow[]>();

  if (error) {
    throw new VanPlanError("Unable to load auction items.", 500);
  }

  const items = (data ?? []).filter(
    (item) => item.slug !== VAN_PLAN_AUCTION_SETTINGS_SLUG,
  );
  const visible = viewer && (viewer.permission === "admin" || viewer.permission === "auctioneer")
    ? items
    : items.filter((item) => itemIsPublic(item.status));

  return hydrateItems(visible);
}

export async function getVanPlanItemBySlug(
  slug: string,
  viewer: VanPlanUser | null,
) {
  const db = vanPlanDb();
  const { data, error } = await db
    .from("van_plan_items")
    .select(ITEM_SELECT)
    .eq("slug", slug)
    .maybeSingle<ItemRow>();

  if (error) {
    throw new VanPlanError("Unable to load that item.", 500);
  }

  if (!data || data.slug === VAN_PLAN_AUCTION_SETTINGS_SLUG) return null;

  if (
    !itemIsPublic(data.status) &&
    !(viewer && (viewer.permission === "admin" || viewer.permission === "auctioneer"))
  ) {
    return null;
  }

  const [hydrated] = await hydrateItems([data]);
  return hydrated ?? null;
}

export async function getVanPlanItemById(itemId: string) {
  const db = vanPlanDb();
  const { data, error } = await db
    .from("van_plan_items")
    .select(ITEM_SELECT)
    .eq("id", itemId)
    .maybeSingle<ItemRow>();

  if (error || !data) {
    throw new VanPlanError("Item not found.", 404);
  }

  const [hydrated] = await hydrateItems([data]);
  return hydrated;
}

export async function listItemBids(itemId: string) {
  const db = vanPlanDb();
  let { data, error } = await db
    .from("van_plan_bids")
    .select(bidSelect)
    .eq("item_id", itemId)
    .order("amount_cents", { ascending: false })
    .order("created_at", { ascending: true })
    .returns<BidRow[]>();

  if (error && shouldFallbackBidSelect(error.message)) {
    bidSelect = BID_SELECT_LEGACY;
    ({ data, error } = await db
      .from("van_plan_bids")
      .select(bidSelect)
      .eq("item_id", itemId)
      .order("amount_cents", { ascending: false })
      .order("created_at", { ascending: true })
      .returns<BidRow[]>());
  }

  if (error) {
    throw new VanPlanError("Unable to load bids.", 500);
  }

  return (data ?? []).map(mapBid);
}

export async function createVanPlanItem({
  name,
  description,
  startingPriceCents,
  status,
  createdBy,
  images,
}: {
  name: string;
  description: string;
  startingPriceCents: number;
  status: VanPlanItemStatus;
  createdBy: string;
  images: File[];
}) {
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();

  if (trimmedName.length < 2) {
    throw new VanPlanError("Enter an item name.");
  }

  if (trimmedDescription.length < 2) {
    throw new VanPlanError("Enter an item description.");
  }

  if (startingPriceCents < 0) {
    throw new VanPlanError("Starting price cannot be negative.");
  }

  if (images.length > VAN_PLAN_MAX_IMAGES_PER_ITEM) {
    throw new VanPlanError(
      `You can add up to ${VAN_PLAN_MAX_IMAGES_PER_ITEM} images per item.`,
    );
  }

  const db = vanPlanDb();
  const { data, error } = await db
    .from("van_plan_items")
    .insert({
      slug: slugifyItemName(trimmedName),
      name: trimmedName,
      description: trimmedDescription,
      starting_price_cents: startingPriceCents,
      status,
      created_by: createdBy,
    })
    .select(ITEM_SELECT)
    .single<ItemRow>();

  if (error || !data) {
    console.error("Van Plan item create failed:", error);
    throw new VanPlanError("Unable to create that item.", 500);
  }

  if (images.length > 0) {
    await addImagesToItem(data.id, images);
  }

  return getVanPlanItemById(data.id);
}

export async function updateVanPlanItem({
  itemId,
  name,
  description,
  startingPriceCents,
}: {
  itemId: string;
  name: string;
  description: string;
  startingPriceCents: number;
}) {
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();

  if (trimmedName.length < 2) {
    throw new VanPlanError("Enter an item name.");
  }

  if (trimmedDescription.length < 2) {
    throw new VanPlanError("Enter an item description.");
  }

  const db = vanPlanDb();
  const { error } = await db
    .from("van_plan_items")
    .update({
      name: trimmedName,
      description: trimmedDescription,
      starting_price_cents: startingPriceCents,
    })
    .eq("id", itemId);

  if (error) {
    throw new VanPlanError("Unable to update that item.", 500);
  }
}

export async function addImagesToItem(itemId: string, files: File[]) {
  if (files.length === 0) return;

  const db = vanPlanDb();
  const { data: existing, error: existingError } = await db
    .from("van_plan_item_images")
    .select("id, is_primary, sort_order")
    .eq("item_id", itemId);

  if (existingError) {
    throw new VanPlanError("Unable to update item images.", 500);
  }

  const currentCount = existing?.length ?? 0;

  if (currentCount + files.length > VAN_PLAN_MAX_IMAGES_PER_ITEM) {
    throw new VanPlanError(
      `You can add up to ${VAN_PLAN_MAX_IMAGES_PER_ITEM} images per item.`,
    );
  }

  const hasPrimary = Boolean(existing?.some((image) => image.is_primary));
  let nextSort = Math.max(0, ...((existing ?? []).map((image) => image.sort_order))) + 1;

  for (const [index, file] of files.entries()) {
    const stored = await storeVanPlanImage({ itemId, file });
    const { error } = await db.from("van_plan_item_images").insert({
      item_id: itemId,
      storage_path: stored.relativePath,
      file_name: stored.fileName,
      mime_type: stored.mimeType,
      is_primary: !hasPrimary && index === 0,
      sort_order: nextSort,
    });

    if (error) {
      console.error("Van Plan image row insert failed:", error);
      throw new VanPlanError("Unable to save one of the images.", 500);
    }

    nextSort += 1;
  }
}

export async function setPrimaryItemImage(itemId: string, imageId: string) {
  const db = vanPlanDb();

  const { error: clearError } = await db
    .from("van_plan_item_images")
    .update({ is_primary: false })
    .eq("item_id", itemId);

  if (clearError) {
    throw new VanPlanError("Unable to update the main picture.", 500);
  }

  const { error } = await db
    .from("van_plan_item_images")
    .update({ is_primary: true })
    .eq("id", imageId)
    .eq("item_id", itemId);

  if (error) {
    throw new VanPlanError("Unable to update the main picture.", 500);
  }
}

export async function deleteVanPlanItemImage({
  itemId,
  imageId,
}: {
  itemId: string;
  imageId: string;
}) {
  const db = vanPlanDb();
  const { data, error } = await db
    .from("van_plan_item_images")
    .select("id, item_id, storage_path, is_primary")
    .eq("id", imageId)
    .eq("item_id", itemId)
    .maybeSingle<{
      id: string;
      item_id: string;
      storage_path: string;
      is_primary: boolean;
    }>();

  if (error || !data) {
    throw new VanPlanError("Photo not found.", 404);
  }

  const { error: deleteError } = await db
    .from("van_plan_item_images")
    .delete()
    .eq("id", imageId)
    .eq("item_id", itemId);

  if (deleteError) {
    throw new VanPlanError("Unable to delete that photo.", 500);
  }

  try {
    await deleteVanPlanImageFile(data.storage_path);
  } catch (fileError) {
    console.error("Van Plan image file delete failed:", fileError);
  }

  if (!data.is_primary) return;

  const { data: remaining, error: remainingError } = await db
    .from("van_plan_item_images")
    .select("id")
    .eq("item_id", itemId)
    .order("sort_order", { ascending: true })
    .limit(1)
    .returns<{ id: string }[]>();

  if (remainingError) {
    throw new VanPlanError("Unable to update the main picture.", 500);
  }

  if (remaining?.[0]) {
    await setPrimaryItemImage(itemId, remaining[0].id);
  }
}

export async function deleteVanPlanItem(itemId: string) {
  const item = await getVanPlanItemById(itemId);
  const db = vanPlanDb();
  const { error } = await db.from("van_plan_items").delete().eq("id", itemId);

  if (error) {
    throw new VanPlanError("Unable to delete that item.", 500);
  }

  for (const image of item.images) {
    try {
      await deleteVanPlanImageFile(image.storagePath);
    } catch (fileError) {
      console.error("Van Plan image file delete failed:", fileError);
    }
  }

  return item;
}

export async function duplicateVanPlanItem({
  itemId,
  createdBy,
}: {
  itemId: string;
  createdBy: string;
}) {
  const source = await getVanPlanItemById(itemId);
  const copiedStatus =
    source.status === "sold" || source.status === "closed" ? "draft" : source.status;

  const copy = await createVanPlanItem({
    name: source.name,
    description: source.description,
    startingPriceCents: source.startingPriceCents,
    status: copiedStatus,
    createdBy,
    images: [],
  });

  try {
    const images = [...source.images].sort((left, right) => left.sortOrder - right.sortOrder);
    const db = vanPlanDb();

    for (const image of images) {
      const stored = await copyVanPlanImageFile({
        sourcePath: image.storagePath,
        itemId: copy.id,
        fileName: image.fileName,
        mimeType: image.mimeType,
      });
      const { error } = await db.from("van_plan_item_images").insert({
        item_id: copy.id,
        storage_path: stored.relativePath,
        file_name: stored.fileName,
        mime_type: stored.mimeType,
        is_primary: image.isPrimary,
        sort_order: image.sortOrder,
      });

      if (error) {
        console.error("Van Plan duplicated image insert failed:", error);
        throw new VanPlanError("Unable to copy one of the photos.", 500);
      }
    }
  } catch (error) {
    await deleteVanPlanItem(copy.id);
    throw error;
  }

  return getVanPlanItemById(copy.id);
}

async function hydrateItems(items: ItemRow[]): Promise<VanPlanItem[]> {
  if (items.length === 0) return [];

  const db = vanPlanDb();
  const itemIds = items.map((item) => item.id);

  const [{ data: images, error: imageError }, bidResult] = await Promise.all([
    db
      .from("van_plan_item_images")
      .select(
        "id, item_id, storage_path, file_name, mime_type, is_primary, sort_order",
      )
      .in("item_id", itemIds)
      .returns<ImageRow[]>(),
    db
      .from("van_plan_bids")
      .select(bidSelect)
      .in("item_id", itemIds)
      .returns<BidRow[]>(),
  ]);

  let { data: bids, error: bidError } = bidResult;

  if (bidError && shouldFallbackBidSelect(bidError.message)) {
    bidSelect = BID_SELECT_LEGACY;
    ({ data: bids, error: bidError } = await db
      .from("van_plan_bids")
      .select(bidSelect)
      .in("item_id", itemIds)
      .returns<BidRow[]>());
  }

  if (imageError || bidError) {
    throw new VanPlanError("Unable to load auction item details.", 500);
  }

  const imagesByItem = new Map<string, ImageRow[]>();
  const bidsByItem = new Map<string, BidRow[]>();

  for (const image of images ?? []) {
    const list = imagesByItem.get(image.item_id) ?? [];
    list.push(image);
    imagesByItem.set(image.item_id, list);
  }

  for (const bid of bids ?? []) {
    const list = bidsByItem.get(bid.item_id) ?? [];
    list.push(bid);
    bidsByItem.set(bid.item_id, list);
  }

  return items.map((item) =>
    mapItem({
      item,
      images: imagesByItem.get(item.id) ?? [],
      bids: bidsByItem.get(item.id) ?? [],
    }),
  );
}
