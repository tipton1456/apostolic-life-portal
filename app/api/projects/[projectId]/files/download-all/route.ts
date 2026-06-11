import { NextResponse } from "next/server";
import { buildProjectFilesZip } from "@/lib/project-files";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;

  try {
    const { buffer, fileName } = await buildProjectFilesZip(projectId);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Project files zip download failed:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to download project files.",
      },
      { status: 404 },
    );
  }
}