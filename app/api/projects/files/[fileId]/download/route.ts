import { NextResponse } from "next/server";
import { ProjectFileDownloadError } from "@/lib/project-file-download-error";
import { ProjectFileStorageError } from "@/lib/project-file-storage-error";
import { getProjectFileForDownload } from "@/lib/project-files";

function buildContentDisposition(fileName: string) {
  const asciiFallback = fileName.replace(/[^\x20-\x7E]+/g, "_") || "download";
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

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
        "Content-Disposition": buildContentDisposition(fileName),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof ProjectFileDownloadError) {
      return new NextResponse(error.message, {
        status: error.status,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    if (error instanceof ProjectFileStorageError) {
      return new NextResponse(error.message, {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    console.error("Project file download failed:", error);

    const message =
      error instanceof Error ? error.message : "Unable to download file.";

    return new NextResponse(message, {
      status: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}