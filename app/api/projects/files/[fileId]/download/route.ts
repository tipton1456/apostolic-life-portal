import { NextResponse } from "next/server";
import { getProjectFileForDownload } from "@/lib/project-files";

export async function GET(
  _request: Request,
  context: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await context.params;

  try {
    const { contents, fileName, mimeType } = await getProjectFileForDownload(fileId);

    return new NextResponse(new Uint8Array(contents), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Project file download failed:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to download file.",
      },
      { status: 404 },
    );
  }
}