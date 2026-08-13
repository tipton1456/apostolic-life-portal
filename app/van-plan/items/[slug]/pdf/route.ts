import { NextResponse } from "next/server";
import { getCurrentVanPlanUser } from "@/lib/van-plan/auth";
import { isVanPlanError } from "@/lib/van-plan/db";
import { buildVanPlanItemPdf } from "@/lib/van-plan/pdf";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;

  try {
    const user = await getCurrentVanPlanUser();
    const { buffer, fileName } = await buildVanPlanItemPdf(slug, user);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (isVanPlanError(error)) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("Van Plan item PDF failed:", error);
    return NextResponse.json(
      { message: "Unable to generate the item PDF." },
      { status: 500 },
    );
  }
}
