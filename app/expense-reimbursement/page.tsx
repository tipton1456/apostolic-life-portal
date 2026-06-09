import { redirect } from "next/navigation";
import { createCognitoFormEntry } from "@/lib/cognito-forms";
import { getCurrentSessionUser } from "@/lib/demo";
import { getHousehold } from "@/lib/elvanto";
import SubmitButton from "./submit-button";

type PageProps = {
  searchParams: Promise<{
    submitted?: string;
  }>;
};

const EXPENSE_REIMBURSEMENT_FORM_ID = "3";
const EXPENSE_LINES = [
  { amount: "Amount", department: "Department2", description: "Text" },
  { amount: "Amount2", department: "Department3", description: "Description" },
  { amount: "Amount3", department: "Department4", description: "Description2" },
  { amount: "Amount4", department: "Department5", description: "Description3" },
  { amount: "Amount5", department: "Department6", description: "Description4" },
  { amount: "Amount6", department: "Department7", description: "Description5" },
  { amount: "Amount7", department: "Department", description: "Description6" },
] as const;

export default async function ExpenseReimbursementPage({
  searchParams,
}: PageProps) {
  const user = await getCurrentSessionUser();

  if (!user) {
    redirect("/login");
  }

  const { submitted } = await searchParams;
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

    const entry = buildReimbursementEntry(formData, currentUser.email);

    if (currentUser.isDemo) {
      redirect("/expense-reimbursement?submitted=demo");
    }

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

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Expense Lines</h2>
                <p className="mt-2 text-sm text-neutral-400">
                  Add as many lines as needed. The first line is required.
                </p>
              </div>
              <p className="text-sm font-semibold text-lime-300">
                Type: Reimbursement
              </p>
            </div>

            <div className="mt-5 space-y-4">
              {EXPENSE_LINES.map((line, index) => (
                <div
                  key={line.amount}
                  className="grid gap-3 rounded-xl border border-white/10 bg-neutral-950/40 p-4 md:grid-cols-[1fr_1fr_10rem]"
                >
                  <Field
                    label={`Description ${index + 1}`}
                    name={line.description}
                    required={index === 0}
                  />
                  <Field
                    label={`Department ${index + 1}`}
                    name={line.department}
                    required={index === 0}
                  />
                  <Field
                    label={`Amount ${index + 1}`}
                    name={line.amount}
                    required={index === 0}
                    step="0.01"
                    type="number"
                  />
                </div>
              ))}
            </div>
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

function buildReimbursementEntry(formData: FormData, fallbackEmail: string) {
  const entry: Record<string, string | string[] | number> = {
    SelectTheTypeOfReportDoNotSelectMoreThanOneTypePerSubmission: [
      "Reimbursement",
    ],
    Name: getText(formData, "requesterName"),
    Event: getText(formData, "event"),
    Email: getText(formData, "email") || fallbackEmail,
    Date: getText(formData, "date"),
    RequesterComments: getText(formData, "requesterComments"),
  };

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

function getText(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getAmount(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();

  if (!value) return null;

  const amount = Number(value);

  return Number.isFinite(amount) ? amount : null;
}
