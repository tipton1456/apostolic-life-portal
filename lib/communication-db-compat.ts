import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingColumnError } from "@/lib/project-db-compat";

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