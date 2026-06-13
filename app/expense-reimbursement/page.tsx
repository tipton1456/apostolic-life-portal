import { redirect } from "next/navigation";
import {
  buildCognitoProjectFields,
  createCognitoFormEntry,
  uploadCognitoFile,
  type CognitoUploadedFile,
} from "@/lib/cognito-forms";
import { getCurrentSessionUser } from "@/lib/demo";
import { getHousehold } from "@/lib/elvanto";
import { recordExpenseReimbursementSubmission } from "@/lib/expense-reimbursements";
import { createProjectExpenseFromReimbursement } from "@/lib/project-expenses";
import { listProjectOptions, type ProjectOption } from "@/lib/project-management";
import ExpenseLines from "./expense-lines";
import EventSelector from "./event-selector";
import {
  EXPENSE_LINES,
  RECEIPT_UPLOAD_FIELD,
  REPORT_TYPE_FIELD,
  REPORT_TYPES,
} from "./expense-fields";
import ReceiptUpload from "./receipt-upload";
import SubmitButton from "./submit-button";

type PageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

const EXPENSE_REIMBURSEMENT_FORM_ID = "3";
  const MAX_RECEIPT_UPLOAD_BYTES = 4 * 1024 * 1024;

export default async function ExpenseReimbursementPage({
  searchParams,
}: PageProps) {
  const user = await getCurrentSessionUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await searchParams;
  const household = await getHousehold(user.email);
  const requesterName = household?.primary
    ? `${household.primary.firstName} ${household.primary.lastName}`
    : "";
  const today = new Date().toISOString().slice(0, 10);

  // Load projects the current user can access.
  const projectOptions = await listProjectOptions();

  // For the Event field: only offer currently active/open projects as quick choices.
  // "Custom event name" allows free text (for non-project events or special cases).
  const activeProjectOptions = projectOptions.filter((p) => p.status === "active");

  async function submitReimbursement(formData: FormData) {
    "use server";

    const currentUser = await getCurrentSessionUser();

    if (!currentUser) {
      redirect("/login");
    }

    // Re-resolve projects inside the action (cheap + guarantees fresh access-controlled list)
    const currentProjectOptions = await listProjectOptions();
    const selectedProjectId = getText(formData, "projectId");
    const selectedProject = currentProjectOptions.find((p) => p.id === selectedProjectId) || null;

    // The Event field (hybrid dropdown + custom) provides the text that goes to Cognito "Event".
    // We also use it for exact project name matching for auto-linking to project expenses.
    const eventValue = getText(formData, "event") || getText(formData, "eventCustom");

    const receiptFiles = getReceiptFiles(formData);

    if (receiptFiles.length === 0) {
      redirect("/expense-reimbursement?error=receipt");
    }

    if (getTotalFileSize(receiptFiles) > MAX_RECEIPT_UPLOAD_BYTES) {
      redirect("/expense-reimbursement?error=receipt-size");
    }

    if (currentUser.isDemo) {
      redirect("/resources?submitted=expense");
    }

    try {
      const uploadedReceipts = await Promise.all(
        receiptFiles.map((file) => uploadCognitoFile(file)),
      );
      const entry = buildReimbursementEntry(
        formData,
        currentUser.email,
        uploadedReceipts,
        selectedProject,
      );

      const result = await createCognitoFormEntry(
        EXPENSE_REIMBURSEMENT_FORM_ID,
        entry,
      );

      if (result.entryId) {
        try {
          await recordExpenseReimbursementSubmission({
            amountTotal: getExpenseTotal(formData),
            cognitoEntryId: result.entryId,
            cognitoFormId: EXPENSE_REIMBURSEMENT_FORM_ID,
            email: getText(formData, "email") || currentUser.email,
            event: getText(formData, "event"),
            reportType: getReportType(formData),
            requestDate: getText(formData, "date"),
          });
        } catch (trackingError) {
          console.error(
            "Expense reimbursement was submitted but tracking failed:",
            trackingError,
          );
        }

        // Link to project expenses if an explicit Related Project was chosen,
        // or if the Event value matches one of our project names (case-insensitive,
        // as long as the letters are the same — no case matching required).
        let projectForLinking = selectedProject;
        if (!projectForLinking && eventValue) {
          const normalizedEvent = eventValue.trim().toLowerCase();
          projectForLinking = currentProjectOptions.find(
            (p) => p.name.trim().toLowerCase() === normalizedEvent
          ) || null;
        }

        if (projectForLinking) {
          try {
            const eventTextForDesc = eventValue || getText(formData, "event") || "Reimbursement";
            await createProjectExpenseFromReimbursement({
              projectId: projectForLinking.id,
              description: `${getReportType(formData)} — ${eventTextForDesc}`,
              amount: getExpenseTotal(formData),
              expenseDate: getText(formData, "date") || new Date().toISOString().slice(0, 10),
              vendor: "",
              notes: getText(formData, "requesterComments") || `From portal submission (Cognito entry ${result.entryId})`,
              cognitoEntryId: result.entryId,
              source: "portal-reimbursement",
            });
          } catch (projectExpenseError) {
            console.error(
              "Expense submitted to Cognito but failed to import into project expenses:",
              projectExpenseError,
            );
          }
        }
      }
    } catch (error) {
      console.error("Expense reimbursement submission failed:", error);
      redirect("/expense-reimbursement?error=submit");
    }

    redirect("/resources?submitted=expense");
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-white/10 pb-6">
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Expense Reimbursement
          </h1>
          <p className="mt-3 max-w-2xl text-neutral-400">
            Submit reimbursement details directly to the Apostolic Life expense
            form.
          </p>

          {error === "receipt" ? (
            <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200">
              Please upload a receipt before submitting the report.
            </p>
          ) : null}

          {error === "receipt-size" ? (
            <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200">
              Receipt uploads must be 4 MB or less total.
            </p>
          ) : null}

          {error === "submit" ? (
            <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200">
              The reimbursement could not be submitted. Please try again with a
              smaller receipt file.
            </p>
          ) : null}
        </header>

        <form action={submitReimbursement} className="mt-8 space-y-6">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-2xl font-semibold">Requester</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field
                defaultValue={requesterName}
                label="Name"
                name="requesterName"
                required
              />
              <Field
                defaultValue={user.email}
                label="Email"
                name="email"
                required
                type="email"
              />
              <EventSelector activeProjects={activeProjectOptions} />
              <Field
                defaultValue={today}
                label="Date"
                name="date"
                required
                type="date"
              />
            </div>
          </section>

          {projectOptions.length > 0 && (
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-2xl font-semibold">Related Project (optional)</h2>
              <p className="mt-1 text-sm text-neutral-400">
                Associate this reimbursement with one of your accessible projects.
                The project name, ID, and status will be sent to the Cognito form.
              </p>
              <label className="mt-4 block text-sm font-medium text-neutral-300">
                Project
                <select
                  name="projectId"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2 md:max-w-xl"
                  defaultValue=""
                >
                  <option value="">None / Not project-related</option>
                  {projectOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} — {option.status}
                      {option.targetEndDate ? ` (target: ${option.targetEndDate})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          )}

          <ExpenseLines />

          <ReceiptUpload />

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-2xl font-semibold">Comments</h2>
            <label className="mt-5 block text-sm font-medium text-neutral-300">
              Requester Comments
              <textarea
                name="requesterComments"
                rows={5}
                className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
                placeholder="Add any context the finance team should know."
              />
            </label>
          </section>

          <div className="flex justify-end">
            <SubmitButton />
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({
  defaultValue,
  label,
  name,
  required = false,
  step,
  type = "text",
}: {
  defaultValue?: string;
  label: string;
  name: string;
  required?: boolean;
  step?: string;
  type?: string;
}) {
  return (
    <label className="block text-sm font-medium text-neutral-300">
      {label}
      <input
        type={type}
        name={name}
        required={required}
        step={step}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
      />
    </label>
  );
}

function buildReimbursementEntry(
  formData: FormData,
  fallbackEmail: string,
  uploadedReceipts: CognitoUploadedFile[],
  project: ProjectOption | null,
) {
  const reportType = getReportType(formData);
  const entry: Record<string, unknown> = {
    [REPORT_TYPE_FIELD]: [reportType],
    Name: getText(formData, "requesterName"),
    Event: getText(formData, "event"),
    Email: getText(formData, "email") || fallbackEmail,
    Date: getText(formData, "date"),
    RequesterComments: getText(formData, "requesterComments"),
  };

  if (uploadedReceipts.length > 0) {
    entry[RECEIPT_UPLOAD_FIELD] = uploadedReceipts;
  }

  if (project) {
    Object.assign(entry, buildCognitoProjectFields(project));
  }

  for (const line of EXPENSE_LINES) {
    const description = getText(formData, line.description);
    const department = getText(formData, line.department);
    const amount = getAmount(formData, line.amount);

    if (!description && !department && amount === null) continue;

    if (description) entry[line.description] = description;
    if (department) entry[line.department] = department;
    if (amount !== null) entry[line.amount] = amount;
  }

  return entry;
}

function getReceiptFiles(formData: FormData) {
  return formData
    .getAll("receipts")
    .filter((value): value is File => isUploadedFile(value));
}

function getTotalFileSize(files: File[]) {
  return files.reduce((totalSize, file) => totalSize + file.size, 0);
}

function isUploadedFile(value: FormDataEntryValue): value is File {
  return (
    typeof value === "object" &&
    "arrayBuffer" in value &&
    "name" in value &&
    "size" in value &&
    typeof value.name === "string" &&
    typeof value.size === "number" &&
    value.size > 0
  );
}

function getReportType(formData: FormData) {
  const reportType = getText(formData, "reportType");

  return REPORT_TYPES.includes(reportType as (typeof REPORT_TYPES)[number])
    ? reportType
    : "Reimbursement";
}

function getText(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getAmount(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();

  if (!value) return null;

  const amount = Number(value);

  return Number.isFinite(amount) ? amount : null;
}

function getExpenseTotal(formData: FormData) {
  return EXPENSE_LINES.reduce((total, line) => {
    const amount = getAmount(formData, line.amount);

    return total + (amount ?? 0);
  }, 0);
}
