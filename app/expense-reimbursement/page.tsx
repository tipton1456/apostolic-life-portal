import { redirect } from "next/navigation";
import {
  createCognitoFormEntry,
  uploadCognitoFile,
  type CognitoUploadedFile,
} from "@/lib/cognito-forms";
import { getCurrentSessionUser } from "@/lib/demo";
import { getHousehold } from "@/lib/elvanto";
import ExpenseLines from "./expense-lines";
import {
  EXPENSE_LINES,
  RECEIPT_UPLOAD_FIELD,
  REPORT_TYPE_FIELD,
  REPORT_TYPES,
} from "./expense-fields";
import SubmitButton from "./submit-button";

type PageProps = {
  searchParams: Promise<{
    error?: string;
    submitted?: string;
  }>;
};

const EXPENSE_REIMBURSEMENT_FORM_ID = "3";

export default async function ExpenseReimbursementPage({
  searchParams,
}: PageProps) {
  const user = await getCurrentSessionUser();

  if (!user) {
    redirect("/login");
  }

  const { error, submitted } = await searchParams;
  const household = await getHousehold(user.email);
  const requesterName = household?.primary
    ? `${household.primary.firstName} ${household.primary.lastName}`
    : "";
  const today = new Date().toISOString().slice(0, 10);

  async function submitReimbursement(formData: FormData) {
    "use server";

    const currentUser = await getCurrentSessionUser();

    if (!currentUser) {
      redirect("/login");
    }

    const receiptFiles = getReceiptFiles(formData);

    if (receiptFiles.length === 0) {
      redirect("/expense-reimbursement?error=receipt");
    }

    if (currentUser.isDemo) {
      redirect("/expense-reimbursement?submitted=demo");
    }

    const uploadedReceipts = await Promise.all(
      receiptFiles.map((file) => uploadCognitoFile(file)),
    );
    const entry = buildReimbursementEntry(
      formData,
      currentUser.email,
      uploadedReceipts,
    );

    await createCognitoFormEntry(EXPENSE_REIMBURSEMENT_FORM_ID, entry);
    redirect("/expense-reimbursement?submitted=true");
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Cognito Forms
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Expense Reimbursement
          </h1>
          <p className="mt-3 max-w-2xl text-neutral-400">
            Submit reimbursement details directly to the Apostolic Life expense
            form.
          </p>

          {submitted ? (
            <p className="mt-4 rounded-xl border border-lime-400/30 bg-lime-400/10 px-4 py-3 text-sm font-semibold text-lime-300">
              {submitted === "demo"
                ? "Demo reimbursement submitted. No live Cognito entry was created."
                : "Reimbursement submitted to Cognito Forms."}
            </p>
          ) : null}

          {error === "receipt" ? (
            <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200">
              Please upload a receipt before submitting the report.
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
              <Field label="Event" name="event" required />
              <Field
                defaultValue={today}
                label="Date"
                name="date"
                required
                type="date"
              />
            </div>
          </section>

          <ExpenseLines />

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-2xl font-semibold">Receipts</h2>
            <p className="mt-2 text-sm text-neutral-400">
              Upload the receipt, invoice, or supporting file for this report.
            </p>
            <label className="mt-5 block text-sm font-medium text-neutral-300">
              Upload Receipts / Files
              <input
                accept="image/*,.pdf"
                className="mt-2 w-full rounded-xl border border-dashed border-white/15 bg-neutral-900 px-4 py-4 text-sm text-neutral-200 file:mr-4 file:rounded-lg file:border-0 file:bg-lime-400 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-neutral-950 hover:border-lime-400/50"
                multiple
                name="receipts"
                required
                type="file"
              />
            </label>
          </section>

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
