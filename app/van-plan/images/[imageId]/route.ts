import { NextResponse } from "next/server";
import { getCurrentVanPlanUser } from "@/lib/van-plan/auth";
import { isVanPlanError } from "@/lib/van-plan/db";
import { getVanPlanImageRecord, readVanPlanImage } from "@/lib/van-plan/images";
import { getVanPlanItemById, itemIsPublic } from "@/lib/van-plan/items";

export async function GET(
  _request: Request,
  context: { params: Promise<{ imageId: string }> },
) {
  const { imageId } = await context.params;

  try {
    const image = await getVanPlanImageRecord(imageId);
    const item = await getVanPlanItemById(image.itemId);
    const user = await getCurrentVanPlanUser();
    const canViewDraft =
      user?.permission === "admin" || user?.permission === "auctioneer";

    if (!itemIsPublic(item.status) && !canViewDraft) {
      return new NextResponse("Not found", { status: 404 });
    }

    const contents = await readVanPlanImage(image.storagePath);

    return new NextResponse(new Uint8Array(contents), {
      headers: {
        "Content-Type": image.mimeType || "application/octet-stream",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    if (isVanPlanError(error)) {
      return new NextResponse(error.message, { status: error.status });
    }

    console.error("Van Plan image serve failed:", error);
    return new NextResponse("Unable to load image.", { status: 500 });
  }
}
