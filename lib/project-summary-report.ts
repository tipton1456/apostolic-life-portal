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
import {
  formatDisplayDate,
  formatProjectStatus,
  isTaskAtRisk,
  isTaskOpenOutstanding,
  isTaskOverdue,
} from "@/lib/project-management-utils";
import type { Project, ProjectStatus, ProjectTask } from "@/lib/project-management";
import { isPortalProjectManager } from "@/lib/portal-project-roles";
import { getCurrentPortalUser } from "@/lib/portal-users";
import { listProjectTaskUpdates } from "@/lib/project-task-updates";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const PAGE_WIDTH = 792;
const PAGE_HEIGHT = 612;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLORS = {
  text: rgb(0.12, 0.12, 0.12),
  muted: rgb(0.35, 0.35, 0.35),
  line: rgb(0.82, 0.82, 0.82),
  overdue: rgb(0.73, 0.11, 0.11),
  atRisk: rgb(0.79, 0.45, 0.12),
  open: rgb(0.12, 0.45, 0.7),
  completed: rgb(0.2, 0.55, 0.25),
  headerFill: rgb(0.95, 0.95, 0.95),
};

type ReportTaskGroup = "overdue" | "atRisk" | "open" | "completed";

type ReportTaskRow = {
  title: string;
  dateEntered: string;
  assignedTo: string;
  lastComment: string;
};

type ReportSection = {
  key: ReportTaskGroup;
  title: string;
  color: ReturnType<typeof rgb>;
  tasks: ReportTaskRow[];
};

export class ProjectSummaryReportError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function buildProjectSummaryReportPdf(projectId: string) {
  const context = await loadProjectSummaryReportContext(projectId);
  const buffer = await renderProjectSummaryReportPdf(context);
  const fileName = `${slugify(context.project.name)}-summary-report.pdf`;

  return { buffer, fileName };
}

async function loadProjectSummaryReportContext(projectId: string) {
  const currentUser = await getCurrentPortalUser();
  if (!currentUser) {
    throw new ProjectSummaryReportError("You must be signed in to download this report.", 401);
  }

  const supabase = await createClient();
  const canView = await userCanViewProject(projectId, currentUser);
  if (!canView) {
    throw new ProjectSummaryReportError("You do not have access to this project.", 403);
  }

  const [{ data: projectRow, error: projectError }, { data: taskRows, error: taskError }, members, updates, managers] =
    await Promise.all([
      supabase
        .from("projects")
        .select(PROJECT_SELECT_WITH_ARCHIVE)
        .eq("id", projectId)
        .maybeSingle(),
      supabase
        .from("project_tasks")
        .select(
          "id,project_id,title,description,status,priority,start_date,due_date,completed_at,sort_order,assigned_to,created_by,created_at,updated_at",
        )
        .eq("project_id", projectId)
        .order("created_at", { ascending: true }),
      loadProjectMemberNames(projectId),
      listProjectTaskUpdates(projectId).catch(() => []),
      loadProjectManagerNames(),
    ]);

  if (projectError || !projectRow) {
    throw new ProjectSummaryReportError("Project not found.", 404);
  }

  if (taskError) {
    throw new ProjectSummaryReportError("Unable to load project tasks.", 500);
  }

  const project = mapProject(normalizeProjectRow(projectRow));
  const memberNameById = new Map(members.map((member) => [member.userId, member.fullName]));
  const tasks = ((taskRows ?? []) as Array<{
    id: string;
    title: string;
    status: ProjectTask["status"];
    due_date: string | null;
    assigned_to: string | null;
    created_at: string;
  }>).map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    dueDate: task.due_date,
    assignedName: memberNameById.get(task.assigned_to ?? "") ?? "Unassigned",
    createdAt: task.created_at,
  }));

  const latestCommentByTaskId = new Map<string, string>();
  for (const update of updates) {
    if (!latestCommentByTaskId.has(update.taskId)) {
      latestCommentByTaskId.set(update.taskId, update.comment.trim());
    }
  }

  const sections = buildReportSections(tasks, latestCommentByTaskId);

  return {
    project,
    generatedAt: new Date(),
    managerNames: managers,
    participantNames: members.map((member) => member.fullName),
    sections,
    generatedBy: [currentUser.firstName, currentUser.lastName].filter(Boolean).join(" ") || currentUser.email,
  };
}

async function userCanViewProject(
  projectId: string,
  currentUser: NonNullable<Awaited<ReturnType<typeof getCurrentPortalUser>>>,
) {
  if (isPortalProjectManager(currentUser)) {
    return true;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Project report permission lookup failed:", error);
    return false;
  }

  return Boolean(data);
}

async function loadProjectMemberNames(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);

  if (error) {
    console.error("Project report members lookup failed:", error);
    return [];
  }

  const userIds = (data ?? []).map((row) => row.user_id);
  if (userIds.length === 0) return [];

  const admin = createAdminClient();
  const { data: profiles, error: profileError } = await admin
    .from("portal_users")
    .select("id,email,first_name,last_name")
    .in("id", userIds);

  if (profileError) {
    console.error("Project report member profiles lookup failed:", profileError);
    return [];
  }

  return (profiles ?? []).map((profile) => ({
    userId: profile.id as string,
    fullName:
      [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
      (profile.email as string),
  }));
}

async function loadProjectManagerNames() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("portal_users")
    .select("email,first_name,last_name,is_admin,project_role,can_access_projects")
    .or("is_admin.eq.true,project_role.eq.project_manager,can_access_projects.eq.true")
    .order("email", { ascending: true });

  if (error) {
    console.error("Project report manager lookup failed:", error);
    return [];
  }

  return (data ?? [])
    .filter(
      (profile) =>
        profile.is_admin ||
        profile.project_role === "project_manager" ||
        profile.can_access_projects,
    )
    .map(
      (profile) =>
        [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
        (profile.email as string),
    );
}

function buildReportSections(
  tasks: Array<{
    id: string;
    title: string;
    status: ProjectTask["status"];
    dueDate: string | null;
    assignedName: string;
    createdAt: string;
  }>,
  latestCommentByTaskId: Map<string, string>,
): ReportSection[] {
  const grouped: Record<ReportTaskGroup, ReportTaskRow[]> = {
    overdue: [],
    atRisk: [],
    open: [],
    completed: [],
  };

  for (const task of tasks) {
    const group = getReportTaskGroup(task);
    grouped[group].push({
      title: task.title,
      dateEntered: formatReportDateTime(task.createdAt),
      assignedTo: task.assignedName,
      lastComment: latestCommentByTaskId.get(task.id) || "No updates yet.",
    });
  }

  return [
    { key: "overdue", title: "Overdue Tasks", color: COLORS.overdue, tasks: grouped.overdue },
    { key: "atRisk", title: "At Risk Tasks", color: COLORS.atRisk, tasks: grouped.atRisk },
    { key: "open", title: "Open Tasks", color: COLORS.open, tasks: grouped.open },
    {
      key: "completed",
      title: "Completed Tasks",
      color: COLORS.completed,
      tasks: grouped.completed,
    },
  ];
}

function getReportTaskGroup(task: Pick<ProjectTask, "status" | "dueDate">): ReportTaskGroup {
  if (task.status === "completed") return "completed";
  if (isTaskOverdue(task)) return "overdue";
  if (isTaskAtRisk(task)) return "atRisk";
  if (isTaskOpenOutstanding(task)) return "open";
  return "open";
}

async function renderProjectSummaryReportPdf(context: {
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

  const renderer = new ReportPdfRenderer(pdf, regular, bold, logo);
  renderer.drawCover(context);
  renderer.drawSections(context.sections, context.generatedAt, context.generatedBy);

  return pdf.save();
}

class ReportPdfRenderer {
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
    generatedAt: Date;
    managerNames: string[];
    participantNames: string[];
  }) {
    const logoDims = this.logo.scaleToFit(180, 48);
    const titleText = `${context.project.name.toUpperCase()} PROJECT SUMMARY REPORT`;
    const titleSize = 14;
    const titleLineHeight = titleSize + 4;
    const titleLines = wrapText(
      titleText,
      PAGE_WIDTH - MARGIN * 2,
      this.bold,
      titleSize,
    );
    const titleBlockHeight = titleLines.length * titleLineHeight;
    const headerHeight = Math.max(logoDims.height, titleBlockHeight);
    const headerTop = this.y;
    const headerCenterY = headerTop - headerHeight / 2;

    this.page.drawImage(this.logo, {
      x: MARGIN,
      y: headerCenterY - logoDims.height / 2,
      width: logoDims.width,
      height: logoDims.height,
    });

    let titleBaseline = headerCenterY + ((titleLines.length - 1) * titleLineHeight) / 2;

    for (const line of titleLines) {
      const lineWidth = this.bold.widthOfTextAtSize(line, titleSize);
      this.page.drawText(line, {
        x: PAGE_WIDTH - MARGIN - lineWidth,
        y: titleBaseline,
        size: titleSize,
        font: this.bold,
        color: COLORS.text,
      });
      titleBaseline -= titleLineHeight;
    }

    this.y = headerTop - headerHeight - 16;

    const details = [
      `Project Status: ${formatProjectStatus(context.project.status)}`,
      `Start Date: ${formatDisplayDate(context.project.startDate)}`,
      `Target End Date: ${formatDisplayDate(context.project.targetEndDate)}`,
      `PM: ${formatNameList(context.managerNames)}`,
      `Participants: ${formatNameList(context.participantNames)}`,
    ];

    for (const line of details) {
      this.drawWrappedLine(line, 11, this.regular, COLORS.muted, 14);
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
        this.drawWrappedLine("No tasks in this category.", 10, this.regular, COLORS.muted, 14);
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
      borderColor: section.color,
      borderWidth: 1,
    });
    this.page.drawText(`${section.title} (${section.tasks.length})`, {
      x: MARGIN + 8,
      y: this.y - 14,
      size: 11,
      font: this.bold,
      color: section.color,
    });
    this.y -= 28;
  }

  private drawTableHeader() {
    const columns = getColumnLayout();
    this.page.drawText("Task", { x: columns.task.x, y: this.y, size: 9, font: this.bold, color: COLORS.muted });
    this.page.drawText("Date Entered", {
      x: columns.entered.x,
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
    this.page.drawText("Last Update Comment", {
      x: columns.comment.x,
      y: this.y,
      size: 9,
      font: this.bold,
      color: COLORS.muted,
    });
    this.y -= 6;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 0.75,
      color: COLORS.line,
    });
    this.y -= 14;
  }

  private drawTaskRow(task: ReportTaskRow) {
    const columns = getColumnLayout();
    const commentLines = wrapText(task.lastComment, columns.comment.width, this.regular, 9);
    const titleLines = wrapText(task.title, columns.task.width, this.bold, 9);
    const rowLines = Math.max(commentLines.length, titleLines.length, 1);
    const rowHeight = rowLines * 12 + 8;

    this.ensureSpace(rowHeight + 4);

    let rowTop = this.y;
    for (let index = 0; index < rowLines; index += 1) {
      const lineY = rowTop - index * 12;
      if (titleLines[index]) {
        this.page.drawText(titleLines[index], {
          x: columns.task.x,
          y: lineY,
          size: 9,
          font: this.bold,
          color: COLORS.text,
        });
      }
      if (index === 0) {
        this.page.drawText(task.dateEntered, {
          x: columns.entered.x,
          y: lineY,
          size: 9,
          font: this.regular,
          color: COLORS.text,
        });
        this.page.drawText(task.assignedTo, {
          x: columns.assigned.x,
          y: lineY,
          size: 9,
          font: this.regular,
          color: COLORS.text,
        });
      }
      if (commentLines[index]) {
        this.page.drawText(commentLines[index], {
          x: columns.comment.x,
          y: lineY,
          size: 9,
          font: this.regular,
          color: COLORS.text,
        });
      }
    }

    this.y -= rowHeight;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y + 4 },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y + 4 },
      thickness: 0.5,
      color: COLORS.line,
    });
  }

  private drawFooters(generatedAt: Date, generatedBy: string) {
    const totalPages = this.pdf.getPageCount();
    const footerText = `Generated ${formatReportDateTime(generatedAt.toISOString())} by ${generatedBy}`;

    for (let index = 0; index < totalPages; index += 1) {
      const page = this.pdf.getPage(index);
      page.drawText(footerText, {
        x: MARGIN,
        y: 24,
        size: 8,
        font: this.regular,
        color: COLORS.muted,
      });
      page.drawText(`Page ${index + 1} of ${totalPages}`, {
        x: PAGE_WIDTH - MARGIN - 70,
        y: 24,
        size: 8,
        font: this.regular,
        color: COLORS.muted,
      });
    }
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
    const page = this.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    return page;
  }
}

function getColumnLayout() {
  const taskWidth = 200;
  const enteredWidth = 92;
  const assignedWidth = 108;
  const commentWidth = CONTENT_WIDTH - taskWidth - enteredWidth - assignedWidth - 18;
  const taskX = MARGIN;
  const enteredX = taskX + taskWidth + 6;
  const assignedX = enteredX + enteredWidth + 6;
  const commentX = assignedX + assignedWidth + 6;

  return {
    task: { x: taskX, width: taskWidth },
    entered: { x: enteredX, width: enteredWidth },
    assigned: { x: assignedX, width: assignedWidth },
    comment: { x: commentX, width: commentWidth },
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