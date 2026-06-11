import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { isMissingColumnError } from "@/lib/project-db-compat";

export const COMMUNICATION_BATCH_SELECT_BASE =
  "id,channel,group_id,group_name,sender_email,message_body,recipient_count,success_count,failure_count,skipped_count,status,created_at";

export const COMMUNICATION_BATCH_SELECT_EXTENDED = `${COMMUNICATION_BATCH_SELECT_BASE},subject,attachment_names`;

export const COMMUNICATION_RECIPIENT_SELECT_BASE =
  "id,batch_id,person_name,phone_number,phone_type,status,twilio_message_sid,failure_code,failure_message,created_at";

export const COMMUNICATION_RECIPIENT_SELECT_EXTENDED = `${COMMUNICATION_RECIPIENT_SELECT_BASE},recipient_email,resend_message_id`;

type CommunicationBatchQueryRow = {
  id: string;
  channel: string;
  group_id: string | null;
  group_name: string | null;
  sender_email: string | null;
  message_body: string;
  subject?: string | null;
  attachment_names?: string[] | null;
  recipient_count: number;
  success_count: number;
  failure_count: number;
  skipped_count: number;
  status: string;
  created_at: string;
};

type CommunicationRecipientQueryRow = {
  id: string;
  batch_id: string;
  person_name: string;
  phone_number: string | null;
  phone_type: string | null;
  recipient_email?: string | null;
  status: string;
  twilio_message_sid: string | null;
  resend_message_id?: string | null;
  failure_code: string | null;
  failure_message: string | null;
  created_at: string;
};

function isMissingCommunicationColumnError(
  error: PostgrestError | null | undefined,
) {
  return (
    isMissingColumnError(error, "subject") ||
    isMissingColumnError(error, "attachment_names") ||
    isMissingColumnError(error, "recipient_email") ||
    isMissingColumnError(error, "resend_message_id")
  );
}

export async function queryCommunicationBatches(
  admin: SupabaseClient,
  limit = 50,
) {
  const attempt = async (select: string) =>
    admin
      .from("communication_message_batches")
      .select(select)
      .order("created_at", { ascending: false })
      .limit(limit);

  let result = await attempt(COMMUNICATION_BATCH_SELECT_EXTENDED);

  if (result.error && isMissingCommunicationColumnError(result.error)) {
    result = await attempt(COMMUNICATION_BATCH_SELECT_BASE);
  }

  return result as {
    data: CommunicationBatchQueryRow[] | null;
    error: typeof result.error;
  };
}

export async function queryCommunicationRecipients(
  admin: SupabaseClient,
  limit = 500,
) {
  const attempt = async (select: string) =>
    admin
      .from("communication_message_recipients")
      .select(select)
      .order("created_at", { ascending: false })
      .limit(limit);

  let result = await attempt(COMMUNICATION_RECIPIENT_SELECT_EXTENDED);

  if (result.error && isMissingCommunicationColumnError(result.error)) {
    result = await attempt(COMMUNICATION_RECIPIENT_SELECT_BASE);
  }

  return result as {
    data: CommunicationRecipientQueryRow[] | null;
    error: typeof result.error;
  };
}

export async function insertCommunicationBatch(
  admin: SupabaseClient,
  payload: Record<string, unknown>,
) {
  const attempt = async (body: Record<string, unknown>) =>
    admin
      .from("communication_message_batches")
      .insert(body)
      .select("id")
      .single<{ id: string }>();

  let result = await attempt(payload);

  if (
    result.error &&
    isMissingColumnError(result.error, "subject") &&
    "subject" in payload
  ) {
    const { subject: _subject, ...withoutSubject } = payload;
    result = await attempt(withoutSubject);
  }

  return result;
}

export async function insertCommunicationRecipient(
  admin: SupabaseClient,
  payload: Record<string, unknown>,
) {
  const attempt = async (body: Record<string, unknown>) =>
    admin.from("communication_message_recipients").insert(body);

  let result = await attempt(payload);

  if (
    result.error &&
    isMissingColumnError(result.error, "recipient_email") &&
    "recipient_email" in payload
  ) {
    const { recipient_email: _email, ...withoutEmail } = payload;
    result = await attempt(withoutEmail);
  }

  return result;
}