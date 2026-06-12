import { NextResponse } from "next/server";
import {
  buildProjectTasksByUserReportPdf,
  ProjectTasksByUserReportError,
} from "@/lib/project-tasks-by-user-report";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;

  try {
    const { buffer, fileName } = await buildProjectTasksByUserReportPdf(projectId);

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof ProjectTasksByUserReportError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("Project tasks by user report failed:", error);

    return NextResponse.json(
      { message: "Unable to generate the tasks by user report." },
      { status: 500 },
    );
  }
}