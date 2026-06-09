"use server";

import {
  getCognitoFormEntry,
  type CognitoEntryMetadata,
} from "@/lib/cognito-forms";
import { createClient } from "@/lib/supabase/server";

export type ExpenseReimbursementTracker = {
  amountTotal: number;
  cognitoEntryId: string;
  createdAt: string;
  event: string;
  id: number;
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

  if (!user) {
    return { error: false, items: [] };
  }

  const { data, error } = await supabase
    .from("expense_reimbursement_requests")
    .select(
      "id,cognito_form_id,cognito_entry_id,report_type,event,request_date,amount_total,created_at,updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    console.error("Expense reimbursement tracking lookup failed:", error);
    return { error: true, items: [] };
  }

  const rows = (data ?? []) as ExpenseReimbursementRow[];
  const items = await Promise.all(rows.map(mapTrackerRow));

  return { error: false, items };
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
    id: row.id,
    requestDate: row.request_date ?? "",
    reportType: row.report_type ?? "",
    status: metadata?.status || "Submitted",
    updatedAt: metadata?.dateUpdated || row.updated_at,
    workflowAction: metadata?.action || "Submit",
  };
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
