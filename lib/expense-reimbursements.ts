"use server";

import {
  getCognitoFormEntry,
  listAllCognitoExpenseEntries,
  listCognitoExpenseEntriesByEmail,
  type CognitoEntryMetadata,
  type CognitoExpenseEntry,
} from "@/lib/cognito-forms";
import { createProjectExpenseFromReimbursement } from "@/lib/project-expenses";
import { getHousehold } from "@/lib/elvanto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ExpenseReimbursementTracker = {
  amountTotal: number;
  cognitoEntryId: string;
  createdAt: string;
  event: string;
  id: string;
  requestDate: string;
  reportType: string;
  status: string;
  updatedAt: string;
  workflowAction: string;
};

type ExpenseReimbursementRow = {
  amount_total: number | string | null;
  cognito_entry_id: string;
  cognito_form_id: string;
  created_at: string;
  event: string | null;
  id: number;
  request_date: string | null;
  report_type: string | null;
  updated_at: string;
};

export async function recordExpenseReimbursementSubmission({
  amountTotal,
  cognitoEntryId,
  cognitoFormId,
  email,
  event,
  requestDate,
  reportType,
}: {
  amountTotal: number;
  cognitoEntryId: string;
  cognitoFormId: string;
  email: string;
  event: string;
  requestDate: string;
  reportType: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be logged in to track reimbursement requests.");
  }

  const { error } = await supabase
    .from("expense_reimbursement_requests")
    .insert({
      amount_total: amountTotal,
      cognito_entry_id: cognitoEntryId,
      cognito_form_id: cognitoFormId,
      email,
      event,
      report_type: reportType,
      request_date: requestDate || null,
      user_id: user.id,
    });

  if (error) {
    console.error("Expense reimbursement tracking insert failed:", error);
    throw new Error("Unable to track reimbursement request.");
  }
}

export async function listExpenseReimbursementTrackers(): Promise<{
  error: boolean;
  items: ExpenseReimbursementTracker[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: false, items: [] };
  }

  const { data, error } = await supabase
    .from("expense_reimbursement_requests")
    .select(
      "id,cognito_form_id,cognito_entry_id,report_type,event,request_date,amount_total,created_at,updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(25);

  let rows: ExpenseReimbursementRow[] = [];

  if (error) {
    console.error("Expense reimbursement tracking lookup failed:", error);
  } else {
    rows = (data ?? []) as ExpenseReimbursementRow[];
  }

  const [localItems, cognitoItems] = await Promise.all([
    Promise.all(rows.map(mapTrackerRow)),
    listCognitoTrackers(user.email),
  ]);
  const items = mergeTrackers(localItems, cognitoItems);

  return { error: Boolean(error) && items.length === 0, items };
}

async function mapTrackerRow(
  row: ExpenseReimbursementRow,
): Promise<ExpenseReimbursementTracker> {
  const metadata = await getEntryMetadata(row.cognito_form_id, row.cognito_entry_id);

  return {
    amountTotal: toNumber(row.amount_total),
    cognitoEntryId: row.cognito_entry_id,
    createdAt: row.created_at,
    event: row.event ?? "",
    id: `local-${row.id}`,
    requestDate: row.request_date ?? "",
    reportType: row.report_type ?? "",
    status: metadata?.status || "Submitted",
    updatedAt: metadata?.dateUpdated || row.updated_at,
    workflowAction: metadata?.action || "Submit",
  };
}

async function listCognitoTrackers(
  email: string,
): Promise<ExpenseReimbursementTracker[]> {
  try {
    const entries = await listCognitoExpenseEntriesByEmail(email);

    return entries.map(mapCognitoTracker);
  } catch (error) {
    console.error("Expense reimbursement Cognito entry list failed:", error);
    return [];
  }
}

function mapCognitoTracker(
  entry: CognitoExpenseEntry,
): ExpenseReimbursementTracker {
  return {
    amountTotal: entry.amountTotal,
    cognitoEntryId: entry.entryId,
    createdAt: entry.dateSubmitted,
    event: entry.event,
    id: `cognito-${entry.id}`,
    requestDate: entry.requestDate,
    reportType: entry.reportType,
    status: entry.status || "Submitted",
    updatedAt: entry.dateSubmitted,
    workflowAction: entry.status || "Submitted",
  };
}

function mergeTrackers(
  localItems: ExpenseReimbursementTracker[],
  cognitoItems: ExpenseReimbursementTracker[],
) {
  const merged = new Map<string, ExpenseReimbursementTracker>();

  for (const item of localItems) {
    merged.set(getEntryMergeKey(item.cognitoEntryId), item);
  }

  for (const item of cognitoItems) {
    merged.set(getEntryMergeKey(item.cognitoEntryId), item);
  }

  return Array.from(merged.values())
    .sort((firstItem, secondItem) =>
      getSortableDate(secondItem).localeCompare(getSortableDate(firstItem)),
    )
    .slice(0, 25);
}

function getEntryMergeKey(entryId: string) {
  return entryId.split("-").pop() || entryId;
}

function getSortableDate(item: ExpenseReimbursementTracker) {
  return item.requestDate || item.createdAt || item.updatedAt || "";
}

async function getEntryMetadata(
  formId: string,
  entryId: string,
): Promise<CognitoEntryMetadata | null> {
  try {
    return await getCognitoFormEntry(formId, entryId);
  } catch (error) {
    console.error("Expense reimbursement Cognito status lookup failed:", {
      entryId,
      error,
      formId,
    });
    return null;
  }
}

function toNumber(value: number | string | null) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const number = Number(value);

    return Number.isFinite(number) ? number : 0;
  }

  return 0;
}

/**
 * Reconciles recent Cognito expense entries (the published form) into the
 * project's expense tracking.
 *
 * - If the entry has a project linked (via Event field matching a project name),
 *   we create a project_expense record (status "committed" = outstanding).
 * - If the Cognito entry later shows an approved/paid status, we update the
 *   linked project expense to "paid".
 * - If the Cognito entry shows a denied/rejected status, we **delete** any
 *   linked project expense entirely (so it drops off the project and is not
 *   listed at all).
 *
 * This is the "Cognito direct submission → portal project expense" direction.
 *
 * Call this from an admin action, a scheduled task, or opportunistically when
 * managers view the projects area.
 */
export async function reconcileCognitoReimbursementsIntoProjectExpenses(): Promise<{
  imported: number;
  updatedToPaid: number;
  deleted: number;
  errors: string[];
}> {
  const results = {
    imported: 0,
    updatedToPaid: 0,
    deleted: 0,
    errors: [] as string[],
  };

  let entries: CognitoExpenseEntry[] = [];
  try {
    entries = await listAllCognitoExpenseEntries();
  } catch (e: any) {
    results.errors.push(`Failed to fetch Cognito expenses: ${e?.message || e}`);
    return results;
  }

  const supabase = createAdminClient();

  // Simple name resolver for linking Cognito "Event" values to projects.
  // Case-insensitive ("same letters" — different casing is fine, no case matching required).
  // Prefers exact ID, then exact name match (ignoring case), then substring.
  async function findProjectIdByNameOrId(nameOrId: string): Promise<string | null> {
    const trimmed = nameOrId.trim();
    if (!trimmed) return null;

    // Try exact ID first (UUIDs are usually not case-sensitive, but match as provided)
    const { data: byId } = await supabase
      .from("projects")
      .select("id")
      .eq("id", trimmed)
      .maybeSingle();
    if (byId?.id) return byId.id;

    // Case-insensitive exact name match ("same letters" regardless of casing)
    const { data: byName } = await supabase
      .from("projects")
      .select("id, name")
      .ilike("name", trimmed)
      .limit(1)
      .maybeSingle();
    if (byName?.id) return byName.id;

    // Fallback: case-insensitive partial / contains match on name
    const { data: partial } = await supabase
      .from("projects")
      .select("id, name")
      .ilike("name", `%${trimmed}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return partial?.id ?? null;
  }

  const isApprovedLike = (status: string) =>
    /approved|paid|complete|accepted/i.test(status || "");

  const isDeniedLike = (status: string) =>
    /denied|reject|denial|declin/i.test(status || "");

  for (const entry of entries) {
    // Primary matching for projects: the "Event" field value on the Cognito side.
    // If it exactly matches a project name, we link the expense to that project.
    // We also support a separate "project" field if the user added one.
    const candidateProjectName = (entry.event || entry.project || entry.projectId || "").toString().trim();

    if (!candidateProjectName) continue;

    try {
      const projectId = await findProjectIdByNameOrId(String(candidateProjectName));

      if (!projectId) {
        results.errors.push(`Could not resolve project "${entry.project}" for Cognito entry ${entry.entryId}`);
        continue;
      }

      // Check if we already imported this exact Cognito entry for this project
      const { data: existing } = await supabase
        .from("project_expenses")
        .select("id, status")
        .eq("project_id", projectId)
        .eq("cognito_entry_id", entry.entryId)
        .limit(1)
        .maybeSingle();

      // If the reimbursement was denied in Cognito, remove it from the project entirely.
      // We do not want denied requests listed at all in project expenses.
      if (isDeniedLike(entry.status)) {
        if (existing?.id) {
          await supabase.from("project_expenses").delete().eq("id", existing.id);
          results.deleted++;
        }
        continue;
      }

      const amount = entry.amountTotal || 0;
      const expenseDate = entry.requestDate || entry.dateSubmitted?.slice(0, 10) || new Date().toISOString().slice(0, 10);

      // Enrich submitter info via Elvanto even for people who don't have a portal account.
      // This lets us populate a nice name in the project expense description/notes.
      let personName = entry.email;
      try {
        const household = await getHousehold(entry.email);
        if (household?.primary) {
          personName = `${household.primary.firstName} ${household.primary.lastName}`.trim() || entry.email;
        }
      } catch {
        // Non-fatal; fall back to email
      }

      const eventOrReport = entry.event || entry.reportType || "Cognito submission";
      const desc = `${eventOrReport} — ${personName}`;

      if (existing?.id) {
        // Update status if Cognito now shows approved and we are still committed
        if (isApprovedLike(entry.status) && existing.status === "committed") {
          await supabase
            .from("project_expenses")
            .update({ status: "paid" })
            .eq("id", existing.id);
          results.updatedToPaid++;
        }
        continue;
      }

      // Import as new (outstanding/committed)
      await createProjectExpenseFromReimbursement({
        projectId,
        description: desc,
        amount,
        expenseDate,
        notes: `Auto-imported from Cognito reimbursement ${entry.entryId} (submitted by ${personName} <${entry.email}>)`,
        cognitoEntryId: entry.entryId,
        source: "cognito-reimbursement",
      });
      results.imported++;

      // If this particular entry is already approved at import time, mark paid immediately
      if (isApprovedLike(entry.status)) {
        // Re-fetch the just-created one by cognito id (simple way)
        const { data: justCreated } = await supabase
          .from("project_expenses")
          .select("id")
          .eq("cognito_entry_id", entry.entryId)
          .eq("project_id", projectId)
          .limit(1)
          .maybeSingle();
        if (justCreated?.id) {
          await supabase.from("project_expenses").update({ status: "paid" }).eq("id", justCreated.id);
          results.updatedToPaid++;
        }
      }
    } catch (err: any) {
      results.errors.push(`Error processing ${entry.entryId}: ${err?.message || err}`);
    }
  }

  return results;
}
