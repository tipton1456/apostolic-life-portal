import { NextResponse } from "next/server";
import {
  buildProjectSummaryReportPdf,
  ProjectSummaryReportError,
} from "@/lib/project-summary-report";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;

  try {
    const { buffer, fileName } = await buildProjectSummaryReportPdf(projectId);

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof ProjectSummaryReportError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("Project summary report failed:", error);

    return NextResponse.json(
      { message: "Unable to generate the project summary report." },
      { status: 500 },
    );
  }
}