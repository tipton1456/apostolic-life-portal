import { NextResponse } from "next/server";
import {
  buildProjectFinancialExportWorkbook,
  ProjectFinancialExportError,
} from "@/lib/project-financial-export";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;

  try {
    const { buffer, fileName } = await buildProjectFinancialExportWorkbook(projectId);

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof ProjectFinancialExportError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("Project financial export failed:", error);

    return NextResponse.json(
      { message: "Unable to generate the financial export." },
      { status: 500 },
    );
  }
}