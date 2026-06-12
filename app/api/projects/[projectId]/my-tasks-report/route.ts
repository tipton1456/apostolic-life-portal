import { NextResponse } from "next/server";
import {
  buildProjectMyTasksReportPdf,
  ProjectMyTasksReportError,
} from "@/lib/project-my-tasks-report";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;

  try {
    const { buffer, fileName } = await buildProjectMyTasksReportPdf(projectId);

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof ProjectMyTasksReportError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("Project my tasks report failed:", error);

    return NextResponse.json(
      { message: "Unable to generate the my tasks report." },
      { status: 500 },
    );
  }
}