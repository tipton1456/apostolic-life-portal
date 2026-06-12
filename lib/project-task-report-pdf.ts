import fs from "fs/promises";
import path from "path";
import {
  PDFDocument,
  StandardFonts,
  type PDFFont,
  type PDFPage,
  rgb,
} from "pdf-lib";
import {
  formatDisplayDate,
  formatProjectStatus,
} from "@/lib/project-management-utils";
import type { Project } from "@/lib/project-management";

export const TASK_REPORT_PAGE_WIDTH = 792;
export const TASK_REPORT_PAGE_HEIGHT = 612;
export const TASK_REPORT_MARGIN = 40;
export const TASK_REPORT_CONTENT_WIDTH =
  TASK_REPORT_PAGE_WIDTH - TASK_REPORT_MARGIN * 2;

export const TASK_REPORT_COLORS = {
  text: rgb(0.12, 0.12, 0.12),
  muted: rgb(0.35, 0.35, 0.35),
  line: rgb(0.82, 0.82, 0.82),
  headerFill: rgb(0.95, 0.95, 0.95),
  section: rgb(0.18, 0.45, 0.7),
};

export type TaskReportRow = {
  title: string;
  assignedTo?: string;
  dueLabel: string;
  status: string;
};

export type TaskReportSection = {
  title: string;
  subtitle: string;
  tasks: TaskReportRow[];
};

export type TaskReportTableColumns = {
  assigned: boolean;
};

export async function renderProjectTaskReportPdf(context: {
  coverTitle: string;
  project: Project;
  managerNames: string[];
  participantNames: string[];
  sections: TaskReportSection[];
  generatedAt: Date;
  generatedBy: string;
  columns?: TaskReportTableColumns;
}) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logoBytes = await fs.readFile(
    path.join(process.cwd(), "public", "NewLogoALDark.png"),
  );
  const logo = await pdf.embedPng(logoBytes);

  const renderer = new TaskReportPdfRenderer(
    pdf,
    regular,
    bold,
    logo,
    context.columns ?? { assigned: true },
  );
  renderer.drawCover({
    coverTitle: context.coverTitle,
    project: context.project,
    managerNames: context.managerNames,
    participantNames: context.participantNames,
  });
  renderer.drawSections(
    context.sections,
    context.generatedAt,
    context.generatedBy,
  );

  return pdf.save();
}

class TaskReportPdfRenderer {
  private page: PDFPage;
  private y = TASK_REPORT_PAGE_HEIGHT - TASK_REPORT_MARGIN;

  constructor(
    private pdf: PDFDocument,
    private regular: PDFFont,
    private bold: PDFFont,
    private logo: Awaited<ReturnType<PDFDocument["embedPng"]>>,
    private columns: TaskReportTableColumns,
  ) {
    this.page = this.addPage();
  }

  drawCover(context: {
    coverTitle: string;
    project: Project;
    managerNames: string[];
    participantNames: string[];
  }) {
    const logoDims = this.logo.scaleToFit(180, 48);
    const titleText = context.coverTitle;
    const titleSize = 14;
    const titleLines = wrapText(
      titleText,
      TASK_REPORT_PAGE_WIDTH - TASK_REPORT_MARGIN * 2,
      this.bold,
      titleSize,
    );
    const titleBlockHeight = titleLines.length * (titleSize + 4);
    const headerHeight = Math.max(logoDims.height, titleBlockHeight);
    const headerTop = this.y;
    const headerCenterY = headerTop - headerHeight / 2;

    this.page.drawImage(this.logo, {
      x: TASK_REPORT_MARGIN,
      y: headerCenterY - logoDims.height / 2,
      width: logoDims.width,
      height: logoDims.height,
    });

    let titleBaseline =
      headerCenterY + ((titleLines.length - 1) * (titleSize + 4)) / 2;

    for (const line of titleLines) {
      const lineWidth = this.bold.widthOfTextAtSize(line, titleSize);
      this.page.drawText(line, {
        x: TASK_REPORT_PAGE_WIDTH - TASK_REPORT_MARGIN - lineWidth,
        y: titleBaseline,
        size: titleSize,
        font: this.bold,
        color: TASK_REPORT_COLORS.text,
      });
      titleBaseline -= titleSize + 4;
    }

    this.y = headerTop - headerHeight - 16;

    const details = [
      `Project Status: ${formatProjectStatus(context.project.status)}`,
      `Start Date: ${formatDisplayDate(context.project.startDate)}    Target End Date: ${formatDisplayDate(context.project.targetEndDate)}`,
      `PM: ${formatNameList(context.managerNames)}    Participants: ${formatNameList(context.participantNames)}`,
    ];

    for (const line of details) {
      this.drawWrappedLine(line, 10, this.regular, TASK_REPORT_COLORS.text, 14);
    }

    this.y -= 12;
    this.page.drawLine({
      start: { x: TASK_REPORT_MARGIN, y: this.y },
      end: { x: TASK_REPORT_PAGE_WIDTH - TASK_REPORT_MARGIN, y: this.y },
      thickness: 1,
      color: TASK_REPORT_COLORS.line,
    });
    this.y -= 24;
  }

  drawSections(
    sections: TaskReportSection[],
    generatedAt: Date,
    generatedBy: string,
  ) {
    for (const section of sections) {
      this.ensureSpace(72);
      this.drawSectionHeader(section);

      if (section.tasks.length === 0) {
        this.drawWrappedLine(
          "No tasks in this section.",
          10,
          this.regular,
          TASK_REPORT_COLORS.muted,
          14,
        );
        this.y -= 8;
        continue;
      }

      this.drawTableHeader();

      for (const task of section.tasks) {
        this.drawTaskRow(task);
      }

      this.y -= 10;
    }

    this.drawFooters(generatedAt, generatedBy);
  }

  private drawSectionHeader(section: TaskReportSection) {
    this.page.drawRectangle({
      x: TASK_REPORT_MARGIN,
      y: this.y - 18,
      width: TASK_REPORT_CONTENT_WIDTH,
      height: 20,
      color: TASK_REPORT_COLORS.headerFill,
    });
    this.page.drawText(section.title, {
      x: TASK_REPORT_MARGIN + 8,
      y: this.y - 14,
      size: 11,
      font: this.bold,
      color: TASK_REPORT_COLORS.section,
    });
    this.y -= 24;
    this.drawWrappedLine(section.subtitle, 9, this.regular, TASK_REPORT_COLORS.muted, 12);
    this.y -= 6;
  }

  private drawTableHeader() {
    const columns = getColumnLayout(this.columns);

    this.page.drawText("Task", {
      x: columns.task.x,
      y: this.y,
      size: 9,
      font: this.bold,
      color: TASK_REPORT_COLORS.muted,
    });

    if (this.columns.assigned) {
      this.page.drawText("Assigned", {
        x: columns.assigned!.x,
        y: this.y,
        size: 9,
        font: this.bold,
        color: TASK_REPORT_COLORS.muted,
      });
    }

    this.page.drawText("Due", {
      x: columns.due.x,
      y: this.y,
      size: 9,
      font: this.bold,
      color: TASK_REPORT_COLORS.muted,
    });
    this.page.drawText("Status", {
      x: columns.status.x,
      y: this.y,
      size: 9,
      font: this.bold,
      color: TASK_REPORT_COLORS.muted,
    });
    this.y -= 14;
    this.page.drawLine({
      start: { x: TASK_REPORT_MARGIN, y: this.y },
      end: { x: TASK_REPORT_PAGE_WIDTH - TASK_REPORT_MARGIN, y: this.y },
      thickness: 0.5,
      color: TASK_REPORT_COLORS.line,
    });
    this.y -= 10;
  }

  private drawTaskRow(task: TaskReportRow) {
    const columns = getColumnLayout(this.columns);
    const titleLines = wrapText(task.title, columns.task.width, this.regular, 10);
    const assignedLines = this.columns.assigned
      ? wrapText(task.assignedTo ?? "—", columns.assigned!.width, this.regular, 10)
      : [];
    const dueLines = wrapText(task.dueLabel, columns.due.width, this.regular, 10);
    const statusLines = wrapText(task.status, columns.status.width, this.regular, 10);
    const lineCount = Math.max(
      titleLines.length,
      assignedLines.length,
      dueLines.length,
      statusLines.length,
      1,
    );

    this.ensureSpace(lineCount * 12 + 8);

    for (let index = 0; index < lineCount; index += 1) {
      const baseline = this.y - index * 12;

      if (titleLines[index]) {
        this.page.drawText(titleLines[index], {
          x: columns.task.x,
          y: baseline,
          size: 10,
          font: this.regular,
          color: TASK_REPORT_COLORS.text,
        });
      }

      if (this.columns.assigned && assignedLines[index]) {
        this.page.drawText(assignedLines[index], {
          x: columns.assigned!.x,
          y: baseline,
          size: 10,
          font: this.regular,
          color: TASK_REPORT_COLORS.text,
        });
      }

      if (dueLines[index]) {
        this.page.drawText(dueLines[index], {
          x: columns.due.x,
          y: baseline,
          size: 10,
          font: this.regular,
          color: TASK_REPORT_COLORS.text,
        });
      }

      if (statusLines[index]) {
        this.page.drawText(statusLines[index], {
          x: columns.status.x,
          y: baseline,
          size: 10,
          font: this.regular,
          color: TASK_REPORT_COLORS.text,
        });
      }
    }

    this.y -= lineCount * 12 + 8;
  }

  private drawFooters(generatedAt: Date, generatedBy: string) {
    const footer = `Generated ${formatReportDateTime(generatedAt.toISOString())} by ${generatedBy}`;
    const pages = this.pdf.getPages();

    pages.forEach((page, index) => {
      page.drawText(footer, {
        x: TASK_REPORT_MARGIN,
        y: 24,
        size: 8,
        font: this.regular,
        color: TASK_REPORT_COLORS.muted,
      });
      page.drawText(`Page ${index + 1} of ${pages.length}`, {
        x: TASK_REPORT_PAGE_WIDTH - TASK_REPORT_MARGIN - 70,
        y: 24,
        size: 8,
        font: this.regular,
        color: TASK_REPORT_COLORS.muted,
      });
    });
  }

  private drawWrappedLine(
    text: string,
    size: number,
    font: PDFFont,
    color: ReturnType<typeof rgb>,
    lineHeight: number,
  ) {
    for (const line of wrapText(text, TASK_REPORT_CONTENT_WIDTH, font, size)) {
      this.ensureSpace(lineHeight);
      this.page.drawText(line, {
        x: TASK_REPORT_MARGIN,
        y: this.y,
        size,
        font,
        color,
      });
      this.y -= lineHeight;
    }
  }

  private ensureSpace(height: number) {
    if (this.y - height < TASK_REPORT_MARGIN + 30) {
      this.page = this.addPage();
      this.y = TASK_REPORT_PAGE_HEIGHT - TASK_REPORT_MARGIN;
    }
  }

  private addPage() {
    return this.pdf.addPage([TASK_REPORT_PAGE_WIDTH, TASK_REPORT_PAGE_HEIGHT]);
  }
}

function getColumnLayout(columns: TaskReportTableColumns) {
  if (columns.assigned) {
    const taskWidth = 250;
    const assignedWidth = 130;
    const dueWidth = 120;
    const statusWidth =
      TASK_REPORT_CONTENT_WIDTH - taskWidth - assignedWidth - dueWidth - 18;
    const taskX = TASK_REPORT_MARGIN;
    const assignedX = taskX + taskWidth + 6;
    const dueX = assignedX + assignedWidth + 6;
    const statusX = dueX + dueWidth + 6;

    return {
      task: { x: taskX, width: taskWidth },
      assigned: { x: assignedX, width: assignedWidth },
      due: { x: dueX, width: dueWidth },
      status: { x: statusX, width: statusWidth },
    };
  }

  const taskWidth = 320;
  const dueWidth = 140;
  const statusWidth = TASK_REPORT_CONTENT_WIDTH - taskWidth - dueWidth - 12;
  const taskX = TASK_REPORT_MARGIN;
  const dueX = taskX + taskWidth + 6;
  const statusX = dueX + dueWidth + 6;

  return {
    task: { x: taskX, width: taskWidth },
    due: { x: dueX, width: dueWidth },
    status: { x: statusX, width: statusWidth },
  };
}

function wrapText(text: string, maxWidth: number, font: PDFFont, size: number) {
  const sanitized = text.replace(/\s+/g, " ").trim() || "—";
  const words = sanitized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function formatReportDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatNameList(names: string[]) {
  return names.length > 0 ? names.join(", ") : "None";
}

export function slugifyReportFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "project";
}