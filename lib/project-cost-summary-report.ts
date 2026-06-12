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
  calculateProjectExpenseStats,
  formatCurrency,
  formatExpenseCategory,
  formatExpenseStatus,
  type ExpenseStatus,
  type ProjectExpense,
} from "@/lib/project-expense-utils";
import {
  formatDisplayDate,
  formatProjectStatus,
} from "@/lib/project-management-utils";
import {
  canUserManageProject,
  loadProjectManagerNamesForProject,
} from "@/lib/project-access";
import type { Project, ProjectStatus } from "@/lib/project-management";
import { getCurrentPortalUser } from "@/lib/portal-users";
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
  outstanding: rgb(0.79, 0.45, 0.12),
  paid: rgb(0.2, 0.55, 0.25),
  total: rgb(0.12, 0.45, 0.7),
  headerFill: rgb(0.95, 0.95, 0.95),
};

type ReportExpenseGroup = "outstanding" | "paid";

type ReportExpenseRow = {
  description: string;
  category: string;
  amount: string;
  expenseDate: string;
  vendor: string;
  status: string;
};

type ReportSection = {
  key: ReportExpenseGroup;
  title: string;
  color: ReturnType<typeof rgb>;
  totalAmount: number;
  expenses: ReportExpenseRow[];
};

export class ProjectCostSummaryReportError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function buildProjectCostSummaryReportPdf(projectId: string) {
  const context = await loadProjectCostSummaryReportContext(projectId);
  const buffer = await renderProjectCostSummaryReportPdf(context);
  const fileName = `${slugify(context.project.name)}-cost-summary-report.pdf`;

  return { buffer, fileName };
}

async function loadProjectCostSummaryReportContext(projectId: string) {
  const currentUser = await getCurrentPortalUser();
  if (!currentUser) {
    throw new ProjectCostSummaryReportError(
      "You must be signed in to download this report.",
      401,
    );
  }

  const supabase = await createClient();
  const canManage = await canUserManageProject(projectId, currentUser);
  if (!canManage) {
    throw new ProjectCostSummaryReportError(
      "Only project managers can access project financials.",
      403,
    );
  }

  const [{ data: projectRow, error: projectError }, { data: expenseRows, error: expenseError }, members, managers] =
    await Promise.all([
      supabase
        .from("projects")
        .select(PROJECT_SELECT_WITH_ARCHIVE)
        .eq("id", projectId)
        .maybeSingle(),
      supabase
        .from("project_expenses")
        .select(
          "id,project_id,description,category,amount,expense_date,vendor,notes,status,created_by,created_at,updated_at",
        )
        .eq("project_id", projectId)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false }),
      loadProjectMemberNames(projectId),
      loadProjectManagerNamesForProject(projectId),
    ]);

  if (projectError || !projectRow) {
    throw new ProjectCostSummaryReportError("Project not found.", 404);
  }

  if (expenseError) {
    throw new ProjectCostSummaryReportError("Unable to load project expenses.", 500);
  }

  const project = mapProject(normalizeProjectRow(projectRow));
  const expenses = ((expenseRows ?? []) as Array<{
    id: string;
    project_id: string;
    description: string;
    category: ProjectExpense["category"];
    amount: number | string;
    expense_date: string;
    vendor: string;
    notes: string;
    status: ExpenseStatus;
    created_by: string;
    created_at: string;
    updated_at: string;
  }>).map(
    (row): ProjectExpense => ({
      id: row.id,
      projectId: row.project_id,
      description: row.description,
      category: row.category,
      amount: Number(row.amount),
      expenseDate: row.expense_date,
      vendor: row.vendor,
      notes: row.notes,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );

  const stats = calculateProjectExpenseStats(expenses);
  const sections = buildReportSections(expenses);

  return {
    project,
    generatedAt: new Date(),
    managerNames: managers,
    participantNames: members.map((member) => member.fullName),
    stats,
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
    console.error("Project cost report members lookup failed:", error);
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
    console.error("Project cost report member profiles lookup failed:", profileError);
    return [];
  }

  return (profiles ?? []).map((profile) => ({
    userId: profile.id as string,
    fullName:
      [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
      (profile.email as string),
  }));
}

function buildReportSections(expenses: ProjectExpense[]): ReportSection[] {
  const outstanding = expenses.filter(
    (expense) => expense.status === "committed",
  );
  const paid = expenses.filter((expense) => expense.status === "paid");

  return [
    {
      key: "outstanding",
      title: "Outstanding Expenses",
      color: COLORS.outstanding,
      totalAmount: outstanding.reduce((total, expense) => total + expense.amount, 0),
      expenses: outstanding.map(mapExpenseRow),
    },
    {
      key: "paid",
      title: "Paid Expenses",
      color: COLORS.paid,
      totalAmount: paid.reduce((total, expense) => total + expense.amount, 0),
      expenses: paid.map(mapExpenseRow),
    },
  ];
}

function mapExpenseRow(expense: ProjectExpense): ReportExpenseRow {
  return {
    description: expense.description,
    category: formatExpenseCategory(expense.category),
    amount: formatCurrency(expense.amount),
    expenseDate: formatDisplayDate(expense.expenseDate),
    vendor: expense.vendor || "—",
    status: formatExpenseStatus(expense.status),
  };
}

async function renderProjectCostSummaryReportPdf(context: {
  project: Project;
  generatedAt: Date;
  generatedBy: string;
  managerNames: string[];
  participantNames: string[];
  stats: ReturnType<typeof calculateProjectExpenseStats>;
  sections: ReportSection[];
}) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logoBytes = await fs.readFile(
    path.join(process.cwd(), "public", "NewLogoALDark.png"),
  );
  const logo = await pdf.embedPng(logoBytes);

  const renderer = new CostReportPdfRenderer(pdf, regular, bold, logo);
  renderer.drawCover(context);
  renderer.drawSections(context.sections, context.generatedAt, context.generatedBy);

  return pdf.save();
}

class CostReportPdfRenderer {
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
    stats: ReturnType<typeof calculateProjectExpenseStats>;
  }) {
    const logoDims = this.logo.scaleToFit(180, 48);
    const titleText = `${context.project.name.toUpperCase()} PROJECT EXPENSE SUMMARY REPORT`;
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

    const details: DetailLineSegment[][] = [
      [{ label: "Project Status:", value: formatProjectStatus(context.project.status) }],
      [
        { label: "Start Date:", value: formatDisplayDate(context.project.startDate) },
        { label: "Target End Date:", value: formatDisplayDate(context.project.targetEndDate) },
      ],
      [
        { label: "PM:", value: formatNameList(context.managerNames) },
        { label: "Participants:", value: formatNameList(context.participantNames) },
      ],
    ];

    for (const line of details) {
      this.drawLabeledDetailLine(line);
    }

    this.y -= 8;
    this.drawTotalSummary(context.stats);
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

      if (section.expenses.length === 0) {
        this.drawWrappedLine("No expenses in this category.", 10, this.regular, COLORS.muted, 14);
        this.y -= 8;
        continue;
      }

      this.drawTableHeader();

      for (const expense of section.expenses) {
        this.drawExpenseRow(expense);
      }

      this.y -= 4;
      this.page.drawText(`Section Total: ${formatCurrency(section.totalAmount)}`, {
        x: PAGE_WIDTH - MARGIN - 160,
        y: this.y,
        size: 10,
        font: this.bold,
        color: section.color,
      });
      this.y -= 16;
    }

    this.drawFooters(generatedAt, generatedBy);
  }

  private drawTotalSummary(stats: ReturnType<typeof calculateProjectExpenseStats>) {
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - 54,
      width: CONTENT_WIDTH,
      height: 58,
      color: COLORS.headerFill,
      borderColor: COLORS.total,
      borderWidth: 1,
    });

    const summaryLines: DetailLineSegment[][] = [
      [{ label: "Total Expenses:", value: formatCurrency(stats.totalAmount) }],
      [
        { label: "Outstanding:", value: formatCurrency(stats.outstandingAmount) },
        { label: "Paid:", value: formatCurrency(stats.paidAmount) },
      ],
    ];

    let summaryY = this.y - 16;
    for (const line of summaryLines) {
      let x = MARGIN + 10;
      for (const [index, segment] of line.entries()) {
        if (index > 0) {
          x += 24;
        }
        this.page.drawText(`${segment.label} `, {
          x,
          y: summaryY,
          size: 12,
          font: this.bold,
          color: COLORS.total,
        });
        x += this.bold.widthOfTextAtSize(`${segment.label} `, 12);
        this.page.drawText(segment.value, {
          x,
          y: summaryY,
          size: 12,
          font: index === 0 && line.length === 1 ? this.bold : this.regular,
          color: COLORS.text,
        });
      }
      summaryY -= 18;
    }

    this.y -= 66;
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
    this.page.drawText(
      `${section.title} (${section.expenses.length}) · ${formatCurrency(section.totalAmount)}`,
      {
        x: MARGIN + 8,
        y: this.y - 14,
        size: 11,
        font: this.bold,
        color: section.color,
      },
    );
    this.y -= 28;
  }

  private drawTableHeader() {
    const columns = getColumnLayout();
    this.page.drawText("Expense", { x: columns.description.x, y: this.y, size: 9, font: this.bold, color: COLORS.muted });
    this.page.drawText("Category", {
      x: columns.category.x,
      y: this.y,
      size: 9,
      font: this.bold,
      color: COLORS.muted,
    });
    this.page.drawText("Amount", {
      x: columns.amount.x,
      y: this.y,
      size: 9,
      font: this.bold,
      color: COLORS.muted,
    });
    this.page.drawText("Date", {
      x: columns.date.x,
      y: this.y,
      size: 9,
      font: this.bold,
      color: COLORS.muted,
    });
    this.page.drawText("Vendor", {
      x: columns.vendor.x,
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
    this.y -= 6;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 0.75,
      color: COLORS.line,
    });
    this.y -= 14;
  }

  private drawExpenseRow(expense: ReportExpenseRow) {
    const columns = getColumnLayout();
    const descriptionLines = wrapText(expense.description, columns.description.width, this.bold, 9);
    const vendorLines = wrapText(expense.vendor, columns.vendor.width, this.regular, 9);
    const rowLines = Math.max(descriptionLines.length, vendorLines.length, 1);
    const rowHeight = rowLines * 12 + 8;

    this.ensureSpace(rowHeight + 4);

    const rowTop = this.y;
    for (let index = 0; index < rowLines; index += 1) {
      const lineY = rowTop - index * 12;
      if (descriptionLines[index]) {
        this.page.drawText(descriptionLines[index], {
          x: columns.description.x,
          y: lineY,
          size: 9,
          font: this.bold,
          color: COLORS.text,
        });
      }
      if (index === 0) {
        this.page.drawText(expense.category, {
          x: columns.category.x,
          y: lineY,
          size: 9,
          font: this.regular,
          color: COLORS.text,
        });
        this.page.drawText(expense.amount, {
          x: columns.amount.x,
          y: lineY,
          size: 9,
          font: this.regular,
          color: COLORS.text,
        });
        this.page.drawText(expense.expenseDate, {
          x: columns.date.x,
          y: lineY,
          size: 9,
          font: this.regular,
          color: COLORS.text,
        });
      }
      if (vendorLines[index]) {
        this.page.drawText(vendorLines[index], {
          x: columns.vendor.x,
          y: lineY,
          size: 9,
          font: this.regular,
          color: COLORS.text,
        });
      }
      if (index === 0) {
        this.page.drawText(expense.status, {
          x: columns.status.x,
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

  private drawLabeledDetailLine(
    segments: DetailLineSegment[],
    size = 11,
    lineHeight = 14,
  ) {
    const parts: StyledTextPart[] = [];

    for (const [index, segment] of segments.entries()) {
      if (index > 0) {
        parts.push({ text: "    ", font: this.regular });
      }
      parts.push({ text: `${segment.label} `, font: this.bold });
      parts.push({ text: segment.value, font: this.regular });
    }

    for (const line of wrapStyledParts(parts, CONTENT_WIDTH, size)) {
      this.ensureSpace(lineHeight);
      let x = MARGIN;

      for (const part of line) {
        this.page.drawText(part.text, {
          x,
          y: this.y,
          size,
          font: part.font,
          color: COLORS.muted,
        });
        x += part.font.widthOfTextAtSize(part.text, size);
      }

      this.y -= lineHeight;
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

type DetailLineSegment = {
  label: string;
  value: string;
};

type StyledTextPart = {
  text: string;
  font: PDFFont;
};

function wrapStyledParts(parts: StyledTextPart[], maxWidth: number, size: number) {
  const lines: StyledTextPart[][] = [];
  let currentLine: StyledTextPart[] = [];
  let currentWidth = 0;

  const pushPart = (font: PDFFont, text: string) => {
    if (!text) return;

    const lastPart = currentLine[currentLine.length - 1];
    if (lastPart?.font === font) {
      lastPart.text += text;
    } else {
      currentLine.push({ text, font });
    }
    currentWidth += font.widthOfTextAtSize(text, size);
  };

  const startNewLine = () => {
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
    currentLine = [];
    currentWidth = 0;
  };

  for (const part of parts) {
    const tokens = part.text.split(/(\s+)/).filter((token) => token.length > 0);

    for (const token of tokens) {
      const tokenWidth = part.font.widthOfTextAtSize(token, size);

      if (currentWidth + tokenWidth > maxWidth && currentWidth > 0) {
        startNewLine();
      }

      pushPart(part.font, token);
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

function getColumnLayout() {
  const descriptionWidth = 180;
  const categoryWidth = 88;
  const amountWidth = 72;
  const dateWidth = 72;
  const vendorWidth = 120;
  const statusWidth = CONTENT_WIDTH - descriptionWidth - categoryWidth - amountWidth - dateWidth - vendorWidth - 24;
  const descriptionX = MARGIN;
  const categoryX = descriptionX + descriptionWidth + 4;
  const amountX = categoryX + categoryWidth + 4;
  const dateX = amountX + amountWidth + 4;
  const vendorX = dateX + dateWidth + 4;
  const statusX = vendorX + vendorWidth + 4;

  return {
    description: { x: descriptionX, width: descriptionWidth },
    category: { x: categoryX, width: categoryWidth },
    amount: { x: amountX, width: amountWidth },
    date: { x: dateX, width: dateWidth },
    vendor: { x: vendorX, width: vendorWidth },
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