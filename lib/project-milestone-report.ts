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
  normalizeProjectRow,
  PROJECT_SELECT_WITH_ARCHIVE,
} from "@/lib/project-db-compat";
import { buildAssigneeNameById } from "@/lib/project-assignee-options";
import {
  canUserViewProject,
  loadProjectManagerNamesForProject,
} from "@/lib/project-access";
import {
  formatDisplayDate,
  formatProjectStatus,
  formatTaskStatus,
} from "@/lib/project-management-utils";
import type { Project, ProjectStatus, ProjectTask } from "@/lib/project-management";
import { listProjectMilestones } from "@/lib/project-milestones";
import { getCurrentPortalUser } from "@/lib/portal-users";
import { createClient } from "@/lib/supabase/server";

const PAGE_WIDTH = 792;
const PAGE_HEIGHT = 612;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLORS = {
  text: rgb(0.12, 0.12, 0.12),
  muted: rgb(0.35, 0.35, 0.35),
  line: rgb(0.82, 0.82, 0.82),
  headerFill: rgb(0.95, 0.95, 0.95),
  section: rgb(0.18, 0.45, 0.7),
};

type ReportTaskRow = {
  title: string;
  assignedTo: string;
  status: string;
  dueLabel: string;
};

type ReportSection = {
  title: string;
  subtitle: string;
  tasks: ReportTaskRow[];
};

export class ProjectMilestoneReportError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function buildProjectMilestoneReportPdf(projectId: string) {
  const context = await loadProjectMilestoneReportContext(projectId);
  const buffer = await renderProjectMilestoneReportPdf(context);
  const fileName = `${slugify(context.project.name)}-tasks-by-milestone.pdf`;

  return { buffer, fileName };
}

async function loadProjectMilestoneReportContext(projectId: string) {
  const currentUser = await getCurrentPortalUser();

  if (!currentUser) {
    throw new ProjectMilestoneReportError("Authentication required.", 401);
  }

  const canView = await canUserViewProject(projectId, currentUser);

  if (!canView) {
    throw new ProjectMilestoneReportError("You do not have access to this project.", 403);
  }

  const supabase = await createClient();
  const [
    { data: projectRow, error: projectError },
    { data: taskRows, error: taskError },
    milestones,
    managerNames,
    memberNames,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select(PROJECT_SELECT_WITH_ARCHIVE)
      .eq("id", projectId)
      .maybeSingle(),
    supabase
      .from("project_tasks")
      .select(
        "id,title,status,due_date,due_date_mode,milestone_id,assigned_to,created_at",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    listProjectMilestones(projectId),
    loadProjectManagerNamesForProject(projectId),
    loadProjectMemberNames(projectId),
  ]);

  if (projectError || !projectRow) {
    throw new ProjectMilestoneReportError("Project not found.", 404);
  }

  if (taskError) {
    throw new ProjectMilestoneReportError("Unable to load project tasks.", 500);
  }

  const project = mapProject(normalizeProjectRow(projectRow));
  const milestoneNameById = new Map(
    milestones.map((milestone) => [milestone.id, milestone.name]),
  );
  const assigneeNameById = buildAssigneeNameById({
    members: memberNames.map((member) => ({
      id: member.userId,
      fullName: member.fullName,
    })),
    managers: [],
    portalParticipants: [],
  });

  const tasks = ((taskRows ?? []) as Array<{
    id: string;
    title: string;
    status: ProjectTask["status"];
    due_date: string | null;
    due_date_mode: ProjectTask["dueDateMode"] | null;
    milestone_id: string | null;
    assigned_to: string | null;
  }>).map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    dueDate: task.due_date,
    dueDateMode: task.due_date_mode ?? "custom",
    milestoneId: task.milestone_id,
    assignedName: assigneeNameById.get(task.assigned_to ?? "") ?? "Unassigned",
    milestoneName: milestoneNameById.get(task.milestone_id ?? "") ?? null,
  }));

  const sections: ReportSection[] = milestones.map((milestone) => ({
    title: milestone.name,
    subtitle: `Milestone date: ${formatDisplayDate(milestone.milestoneDate)}`,
    tasks: tasks
      .filter((task) => task.milestoneId === milestone.id)
      .map((task) => ({
        title: task.title,
        assignedTo: task.assignedName,
        status: formatTaskStatus(task.status),
        dueLabel: milestone.name,
      })),
  }));

  const customTasks = tasks.filter((task) => task.dueDateMode !== "milestone");

  sections.push({
    title: "Custom Due Dates",
    subtitle: "Tasks not tied to a milestone",
    tasks: customTasks.map((task) => ({
      title: task.title,
      assignedTo: task.assignedName,
      status: formatTaskStatus(task.status),
      dueLabel: formatDisplayDate(task.dueDate),
    })),
  });

  return {
    project,
    generatedAt: new Date(),
    managerNames,
    participantNames: memberNames.map((member) => member.fullName),
    sections,
    generatedBy:
      [currentUser.firstName, currentUser.lastName].filter(Boolean).join(" ") ||
      currentUser.email,
  };
}

async function loadProjectMemberNames(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);

  if (error) {
    console.error("Milestone report members lookup failed:", error);
    return [];
  }

  const userIds = (data ?? []).map((row) => row.user_id as string);
  if (userIds.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from("portal_users")
    .select("id,email,first_name,last_name")
    .in("id", userIds);

  if (profileError) {
    console.error("Milestone report member profiles lookup failed:", profileError);
    return [];
  }

  return (profiles ?? []).map((profile) => ({
    userId: profile.id as string,
    fullName:
      [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
      (profile.email as string),
  }));
}

async function renderProjectMilestoneReportPdf(context: {
  project: Project;
  generatedAt: Date;
  generatedBy: string;
  managerNames: string[];
  participantNames: string[];
  sections: ReportSection[];
}) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logoBytes = await fs.readFile(
    path.join(process.cwd(), "public", "NewLogoALDark.png"),
  );
  const logo = await pdf.embedPng(logoBytes);

  const renderer = new MilestoneReportPdfRenderer(pdf, regular, bold, logo);
  renderer.drawCover(context);
  renderer.drawSections(context.sections, context.generatedAt, context.generatedBy);

  return pdf.save();
}

class MilestoneReportPdfRenderer {
  private page: PDFPage;
  private pageNumber = 0;
  private y = PAGE_HEIGHT - MARGIN;

  constructor(
    private pdf: PDFDocument,
    private regular: PDFFont,
    private bold: PDFFont,
    private logo: Awaited<ReturnType<PDFDocument["embedPng"]>>,
  ) {
    this.page = this.addPage();
  }

  drawCover(context: {
    project: Project;
    managerNames: string[];
    participantNames: string[];
  }) {
    const logoDims = this.logo.scaleToFit(180, 48);
    const titleText = `${context.project.name.toUpperCase()} TASKS BY MILESTONE`;
    const titleSize = 14;
    const titleLines = wrapText(
      titleText,
      PAGE_WIDTH - MARGIN * 2,
      this.bold,
      titleSize,
    );
    const titleBlockHeight = titleLines.length * (titleSize + 4);
    const headerHeight = Math.max(logoDims.height, titleBlockHeight);
    const headerTop = this.y;
    const headerCenterY = headerTop - headerHeight / 2;

    this.page.drawImage(this.logo, {
      x: MARGIN,
      y: headerCenterY - logoDims.height / 2,
      width: logoDims.width,
      height: logoDims.height,
    });

    let titleBaseline =
      headerCenterY + ((titleLines.length - 1) * (titleSize + 4)) / 2;

    for (const line of titleLines) {
      const lineWidth = this.bold.widthOfTextAtSize(line, titleSize);
      this.page.drawText(line, {
        x: PAGE_WIDTH - MARGIN - lineWidth,
        y: titleBaseline,
        size: titleSize,
        font: this.bold,
        color: COLORS.text,
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
      this.drawWrappedLine(line, 10, this.regular, COLORS.text, 14);
    }

    this.y -= 12;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 1,
      color: COLORS.line,
    });
    this.y -= 24;
  }

  drawSections(sections: ReportSection[], generatedAt: Date, generatedBy: string) {
    for (const section of sections) {
      this.ensureSpace(72);
      this.drawSectionHeader(section);

      if (section.tasks.length === 0) {
        this.drawWrappedLine("No tasks in this section.", 10, this.regular, COLORS.muted, 14);
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

  private drawSectionHeader(section: ReportSection) {
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - 18,
      width: CONTENT_WIDTH,
      height: 20,
      color: COLORS.headerFill,
    });
    this.page.drawText(section.title, {
      x: MARGIN + 8,
      y: this.y - 14,
      size: 11,
      font: this.bold,
      color: COLORS.section,
    });
    this.y -= 24;
    this.drawWrappedLine(section.subtitle, 9, this.regular, COLORS.muted, 12);
    this.y -= 6;
  }

  private drawTableHeader() {
    const columns = getColumnLayout();
    this.page.drawText("Task", {
      x: columns.task.x,
      y: this.y,
      size: 9,
      font: this.bold,
      color: COLORS.muted,
    });
    this.page.drawText("Assigned", {
      x: columns.assigned.x,
      y: this.y,
      size: 9,
      font: this.bold,
      color: COLORS.muted,
    });
    this.page.drawText("Due", {
      x: columns.due.x,
      y: this.y,
      size: 9,
      font: this.bold,
      color: COLORS.muted,
    });
    this.page.drawText("Status", {
      x: columns.status.x,
      y: this.y,
      size: 9,
      font: this.bold,
      color: COLORS.muted,
    });
    this.y -= 14;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 0.5,
      color: COLORS.line,
    });
    this.y -= 10;
  }

  private drawTaskRow(task: ReportTaskRow) {
    const columns = getColumnLayout();
    const rowHeight = Math.max(
      wrapText(task.title, columns.task.width, this.regular, 10).length * 12,
      wrapText(task.assignedTo, columns.assigned.width, this.regular, 10).length * 12,
      wrapText(task.dueLabel, columns.due.width, this.regular, 10).length * 12,
      wrapText(task.status, columns.status.width, this.regular, 10).length * 12,
      12,
    );

    this.ensureSpace(rowHeight + 8);

    const titleLines = wrapText(task.title, columns.task.width, this.regular, 10);
    const assignedLines = wrapText(task.assignedTo, columns.assigned.width, this.regular, 10);
    const dueLines = wrapText(task.dueLabel, columns.due.width, this.regular, 10);
    const statusLines = wrapText(task.status, columns.status.width, this.regular, 10);
    const lineCount = Math.max(
      titleLines.length,
      assignedLines.length,
      dueLines.length,
      statusLines.length,
    );

    for (let index = 0; index < lineCount; index += 1) {
      const baseline = this.y - index * 12;
      if (titleLines[index]) {
        this.page.drawText(titleLines[index], {
          x: columns.task.x,
          y: baseline,
          size: 10,
          font: this.regular,
          color: COLORS.text,
        });
      }
      if (assignedLines[index]) {
        this.page.drawText(assignedLines[index], {
          x: columns.assigned.x,
          y: baseline,
          size: 10,
          font: this.regular,
          color: COLORS.text,
        });
      }
      if (dueLines[index]) {
        this.page.drawText(dueLines[index], {
          x: columns.due.x,
          y: baseline,
          size: 10,
          font: this.regular,
          color: COLORS.text,
        });
      }
      if (statusLines[index]) {
        this.page.drawText(statusLines[index], {
          x: columns.status.x,
          y: baseline,
          size: 10,
          font: this.regular,
          color: COLORS.text,
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
        x: MARGIN,
        y: 24,
        size: 8,
        font: this.regular,
        color: COLORS.muted,
      });
      page.drawText(`Page ${index + 1} of ${pages.length}`, {
        x: PAGE_WIDTH - MARGIN - 70,
        y: 24,
        size: 8,
        font: this.regular,
        color: COLORS.muted,
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
    for (const line of wrapText(text, CONTENT_WIDTH, font, size)) {
      this.ensureSpace(lineHeight);
      this.page.drawText(line, {
        x: MARGIN,
        y: this.y,
        size,
        font,
        color,
      });
      this.y -= lineHeight;
    }
  }

  private ensureSpace(height: number) {
    if (this.y - height < MARGIN + 30) {
      this.page = this.addPage();
      this.y = PAGE_HEIGHT - MARGIN;
    }
  }

  private addPage() {
    this.pageNumber += 1;
    return this.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  }
}

function getColumnLayout() {
  const taskWidth = 250;
  const assignedWidth = 130;
  const dueWidth = 120;
  const statusWidth = CONTENT_WIDTH - taskWidth - assignedWidth - dueWidth - 18;
  const taskX = MARGIN;
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "project";
}

function mapProject(row: ReturnType<typeof normalizeProjectRow>): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status as ProjectStatus,
    startDate: row.start_date,
    targetEndDate: row.target_end_date,
    imageUrl: row.image_url,
    archivedFilesUrl: row.archived_files_url,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } satisfies Project;
}