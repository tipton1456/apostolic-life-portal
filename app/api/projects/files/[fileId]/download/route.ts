import { NextResponse } from "next/server";
import { getProjectFileDownloadUrl } from "@/lib/project-files";

export async function GET(
  _request: Request,
  context: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await context.params;

  try {
    const { downloadUrl } = await getProjectFileDownloadUrl(fileId);

    return NextResponse.redirect(downloadUrl);
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