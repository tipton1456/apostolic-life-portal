import { NextResponse } from "next/server";
import {
  buildProjectMilestoneReportPdf,
  ProjectMilestoneReportError,
} from "@/lib/project-milestone-report";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;

  try {
    const { buffer, fileName } = await buildProjectMilestoneReportPdf(projectId);

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof ProjectMilestoneReportError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("Project milestone report failed:", error);

    return NextResponse.json(
      { message: "Unable to generate the tasks by milestone report." },
      { status: 500 },
    );
  }
}