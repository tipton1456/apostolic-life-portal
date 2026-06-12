import { NextResponse } from "next/server";
import {
  buildProjectFinancialSummaryReportPdf,
  ProjectFinancialSummaryReportError,
} from "@/lib/project-financial-summary-report";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;

  try {
    const { buffer, fileName } = await buildProjectFinancialSummaryReportPdf(projectId);

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof ProjectFinancialSummaryReportError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("Project financial summary report failed:", error);

    return NextResponse.json(
      { message: "Unable to generate the project financial summary report." },
      { status: 500 },
    );
  }
}