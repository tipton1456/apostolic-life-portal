"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isDemoMode } from "@/lib/demo";
import { getLeaderGroupDetail } from "@/lib/elvanto-groups";
import {
  queryCommunicationBatches,
  queryCommunicationRecipients,
} from "@/lib/communication-db-compat";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type CommunicationBatchRow = {
  id: string;
  channel: string;
  group_id: string | null;
  group_name: string | null;
  sender_email: string | null;
  message_body: string;
  subject: string | null;
  attachment_names: string[] | null;
  recipient_count: number;
  success_count: number;
  failure_count: number;
  skipped_count: number;
  status: string;
  created_at: string;
};

type CommunicationRecipientRow = {
  id: string;
  batch_id: string;
  person_name: string;
  phone_number: string | null;
  phone_type: string | null;
  recipient_email: string | null;
  status: string;
  twilio_message_sid: string | null;
  resend_message_id: string | null;
  failure_code: string | null;
  failure_message: string | null;
  created_at: string;
};

export type CommunicationLog = {
  id: string;
  attachmentNames: string[];
  channel: string;
  createdAt: string;
  failureCount: number;
  groupId?: string;
  groupName: string;
  messageBody: string;
  recipientCount: number;
  recipients: CommunicationRecipient[];
  senderEmail: string;
  skippedCount: number;
  status: string;
  subject?: string;
  successCount: number;
};

export type CommunicationRecipient = {
  id: string;
  contactLabel: string;
  contactType: string;
  createdAt: string;
  failureCode?: string;
  failureMessage?: string;
  personName: string;
  phoneNumber: string;
  phoneType: string;
  providerMessageId?: string;
  recipientEmail: string;
  status: string;
  twilioMessageSid?: string;
};

type TwilioMessageResponse = {
  code?: number;
  message?: string;
  sid?: string;
  status?: string;
};

type ResendEmailResponse = {
  id?: string;
  message?: string;
  name?: string;
  statusCode?: number;
};

type EmailAttachment = {
  content: string;
  contentType?: string;
  filename: string;
};

const RESEND_API_URL = "https://api.resend.com/emails";
const MAX_EMAIL_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_EMAIL_ATTACHMENTS = 5;
const ALLOWED_EMAIL_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/calendar",
  "text/csv",
  "text/plain",
]);

export async function sendGroupSms(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  const message = normalizeMessage(formData.get("message"));
  const selectedMemberIds = formData
    .getAll("memberIds")
    .map(String)
    .filter(Boolean);

  if (!groupId || !message || selectedMemberIds.length === 0) {
    redirect(`/groups/${groupId}?sms=missing`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && (await isDemoMode())) {
    revalidatePath(`/groups/${groupId}`);
    redirect(`/groups/${groupId}?sms=demo`);
  }

  if (!user) redirect("/login");

  const group = await getLeaderGroupDetail(groupId, user.email ?? undefined);

  if (!group) {
    throw new Error("You do not lead this group.");
  }

  const selectedMemberIdSet = new Set(selectedMemberIds);
  const selectedMembers = group.members.filter((member) =>
    selectedMemberIdSet.has(member.id),
  );

  if (selectedMembers.length === 0) {
    redirect(`/groups/${groupId}?sms=missing`);
  }

  const twilioConfig = getTwilioConfig();

  if (!twilioConfig) {
    await logConfigurationFailure({
      groupId,
      groupName: group.name,
      message,
      members: selectedMembers,
      senderEmail: user.email ?? "",
      senderUserId: user.id,
    });
    redirect(`/groups/${groupId}?sms=config`);
  }

  const admin = createAdminClient();
  const messageBody = appendSmsOptOut(message);
  const { data: batch, error: batchError } = await admin
    .from("communication_message_batches")
    .insert({
      channel: "sms",
      group_id: group.id,
      group_name: group.name,
      sender_user_id: user.id,
      sender_email: user.email ?? "",
      message_body: messageBody,
      recipient_count: selectedMembers.length,
      status: "sending",
    })
    .select("id")
    .single<{ id: string }>();

  if (batchError || !batch?.id) {
    console.error("Communication batch insert failed:", batchError);
    redirect(`/groups/${groupId}?sms=log-error`);
  }

  const optOuts = await getSmsOptOuts();
  const usedPhoneNumbers = new Set<string>();
  let successCount = 0;
  let failureCount = 0;
  let skippedCount = 0;

  for (const member of selectedMembers) {
    const recipientPhone = getRecipientPhone(member.mobile);

    if (!recipientPhone) {
      skippedCount += 1;
      await insertRecipientLog({
        batchId: batch.id,
        failureMessage: "No contact phone number listed.",
        memberId: member.id,
        name: member.name,
        phoneNumber: "",
        phoneType: "contact",
        status: "skipped",
      });
      continue;
    }

    if (usedPhoneNumbers.has(recipientPhone.number)) {
      skippedCount += 1;
      await insertRecipientLog({
        batchId: batch.id,
        failureMessage: "Duplicate phone number skipped.",
        memberId: member.id,
        name: member.name,
        phoneNumber: recipientPhone.number,
        phoneType: recipientPhone.type,
        status: "skipped",
      });
      continue;
    }

    usedPhoneNumbers.add(recipientPhone.number);

    if (optOuts.has(recipientPhone.number)) {
      skippedCount += 1;
      await insertRecipientLog({
        batchId: batch.id,
        failureMessage: "Recipient is unsubscribed from SMS communications.",
        memberId: member.id,
        name: member.name,
        phoneNumber: recipientPhone.number,
        phoneType: recipientPhone.type,
        status: "skipped",
      });
      continue;
    }

    const result = await sendTwilioSms({
      body: messageBody,
      to: recipientPhone.number,
      twilioConfig,
    });

    if (result.ok) {
      successCount += 1;
      await insertRecipientLog({
        batchId: batch.id,
        memberId: member.id,
        name: member.name,
        phoneNumber: recipientPhone.number,
        phoneType: recipientPhone.type,
        status: result.status,
        twilioMessageSid: result.sid,
      });
    } else {
      failureCount += 1;

      if (result.failureCode === "21610") {
        await upsertSmsOptOut(recipientPhone.number, result.failureMessage);
      }

      await insertRecipientLog({
        batchId: batch.id,
        failureCode: result.failureCode,
        failureMessage: result.failureMessage,
        memberId: member.id,
        name: member.name,
        phoneNumber: recipientPhone.number,
        phoneType: recipientPhone.type,
        status: "failed",
      });
    }
  }

  const status =
    failureCount > 0 ? "completed_with_failures" : skippedCount > 0 ? "completed_with_skips" : "completed";

  const { error: updateError } = await admin
    .from("communication_message_batches")
    .update({
      failure_count: failureCount,
      skipped_count: skippedCount,
      status,
      success_count: successCount,
    })
    .eq("id", batch.id);

  if (updateError) {
    console.error("Communication batch update failed:", updateError);
  }

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/admin/communications");
  redirect(`/groups/${groupId}?sms=sent`);
}

export async function sendGroupEmail(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  const subject = normalizeEmailSubject(formData.get("subject"));
  const message = normalizeEmailMessage(formData.get("message"));
  const selectedMemberIds = formData
    .getAll("memberIds")
    .map(String)
    .filter(Boolean);

  if (!groupId || !subject || !message || selectedMemberIds.length === 0) {
    redirect(`/groups/${groupId}?email=missing`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && (await isDemoMode())) {
    revalidatePath(`/groups/${groupId}`);
    redirect(`/groups/${groupId}?email=demo`);
  }

  if (!user) redirect("/login");

  const group = await getLeaderGroupDetail(groupId, user.email ?? undefined);

  if (!group) {
    throw new Error("You do not lead this group.");
  }

  const selectedMemberIdSet = new Set(selectedMemberIds);
  const selectedMembers = group.members.filter((member) =>
    selectedMemberIdSet.has(member.id),
  );

  if (selectedMembers.length === 0) {
    redirect(`/groups/${groupId}?email=missing`);
  }

  let attachments: EmailAttachment[];

  try {
    attachments = await parseEmailAttachments(formData.getAll("attachments"));
  } catch (error) {
    const reason =
      error instanceof Error && error.message.startsWith("attachment-")
        ? error.message
        : "attachment-type";
    redirect(`/groups/${groupId}?email=${reason}`);
  }

  const resendConfig = getResendConfig();

  if (!resendConfig) {
    await logEmailConfigurationFailure({
      attachmentNames: attachments.map((attachment) => attachment.filename),
      groupId,
      groupName: group.name,
      members: selectedMembers,
      message,
      senderEmail: user.email ?? "",
      senderUserId: user.id,
      subject,
    });
    redirect(`/groups/${groupId}?email=config`);
  }

  const admin = createAdminClient();
  const { data: batch, error: batchError } = await admin
    .from("communication_message_batches")
    .insert({
      attachment_names: attachments.map((attachment) => attachment.filename),
      channel: "email",
      group_id: group.id,
      group_name: group.name,
      message_body: message,
      recipient_count: selectedMembers.length,
      sender_email: user.email ?? "",
      sender_user_id: user.id,
      status: "sending",
      subject,
    })
    .select("id")
    .single<{ id: string }>();

  if (batchError || !batch?.id) {
    console.error("Communication batch insert failed:", batchError);
    redirect(`/groups/${groupId}?email=log-error`);
  }

  const usedEmailAddresses = new Set<string>();
  let successCount = 0;
  let failureCount = 0;
  let skippedCount = 0;

  for (const member of selectedMembers) {
    const recipientEmail = normalizeRecipientEmail(member.email);

    if (!recipientEmail) {
      skippedCount += 1;
      await insertRecipientLog({
        batchId: batch.id,
        failureMessage: "No contact email listed.",
        memberId: member.id,
        name: member.name,
        recipientEmail: "",
        status: "skipped",
      });
      continue;
    }

    if (usedEmailAddresses.has(recipientEmail)) {
      skippedCount += 1;
      await insertRecipientLog({
        batchId: batch.id,
        failureMessage: "Duplicate email address skipped.",
        memberId: member.id,
        name: member.name,
        recipientEmail,
        status: "skipped",
      });
      continue;
    }

    usedEmailAddresses.add(recipientEmail);

    const result = await sendResendEmail({
      apiKey: resendConfig.apiKey,
      attachments,
      body: message,
      from: resendConfig.from,
      replyTo: user.email ?? undefined,
      subject,
      to: recipientEmail,
    });

    if (result.ok) {
      successCount += 1;
      await insertRecipientLog({
        batchId: batch.id,
        memberId: member.id,
        name: member.name,
        recipientEmail,
        resendMessageId: result.id,
        status: "sent",
      });
    } else {
      failureCount += 1;
      await insertRecipientLog({
        batchId: batch.id,
        failureCode: result.failureCode,
        failureMessage: result.failureMessage,
        memberId: member.id,
        name: member.name,
        recipientEmail,
        status: "failed",
      });
    }
  }

  const status =
    failureCount > 0
      ? "completed_with_failures"
      : skippedCount > 0
        ? "completed_with_skips"
        : "completed";

  const { error: updateError } = await admin
    .from("communication_message_batches")
    .update({
      failure_count: failureCount,
      skipped_count: skippedCount,
      status,
      success_count: successCount,
    })
    .eq("id", batch.id);

  if (updateError) {
    console.error("Communication batch update failed:", updateError);
  }

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/admin/communications");
  redirect(`/groups/${groupId}?email=sent`);
}

export async function listCommunicationLogs(): Promise<CommunicationLog[]> {
  const admin = createAdminClient();
  const [{ data: batches, error: batchError }, { data: recipients, error: recipientError }] =
    await Promise.all([
      queryCommunicationBatches(admin),
      queryCommunicationRecipients(admin),
    ]);

  if (batchError) {
    console.error("Communication batches lookup failed:", batchError);
    throw new Error("Unable to load communication logs.");
  }

  if (recipientError) {
    console.error("Communication recipients lookup failed:", recipientError);
    throw new Error("Unable to load communication recipients.");
  }

  const recipientsByBatchId = new Map<string, CommunicationRecipient[]>();

  for (const recipient of (recipients ?? []) as CommunicationRecipientRow[]) {
    const batchRecipients = recipientsByBatchId.get(recipient.batch_id) ?? [];

    const recipientEmail = recipient.recipient_email ?? "";
    const phoneNumber = recipient.phone_number ?? "";
    const providerMessageId =
      recipient.resend_message_id ?? recipient.twilio_message_sid ?? undefined;

    batchRecipients.push({
      id: recipient.id,
      contactLabel: recipientEmail || phoneNumber || "Not listed",
      contactType: recipientEmail ? "email" : phoneNumber ? "phone" : "unknown",
      createdAt: recipient.created_at,
      failureCode: recipient.failure_code ?? undefined,
      failureMessage: recipient.failure_message ?? undefined,
      personName: recipient.person_name,
      phoneNumber,
      phoneType: recipient.phone_type ?? "",
      providerMessageId,
      recipientEmail,
      status: recipient.status,
      twilioMessageSid: recipient.twilio_message_sid ?? undefined,
    });
    recipientsByBatchId.set(recipient.batch_id, batchRecipients);
  }

  return ((batches ?? []) as CommunicationBatchRow[]).map((batch) => ({
    id: batch.id,
    attachmentNames: batch.attachment_names ?? [],
    channel: batch.channel,
    createdAt: batch.created_at,
    failureCount: batch.failure_count,
    groupId: batch.group_id ?? undefined,
    groupName: batch.group_name ?? "Unknown group",
    messageBody: batch.message_body,
    recipientCount: batch.recipient_count,
    recipients: recipientsByBatchId.get(batch.id) ?? [],
    senderEmail: batch.sender_email ?? "Unknown sender",
    skippedCount: batch.skipped_count,
    status: batch.status,
    subject: batch.subject ?? undefined,
    successCount: batch.success_count,
  }));
}

function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!accountSid || !apiKeySid || !apiKeySecret || !messagingServiceSid) {
    console.error("Twilio SMS is missing required environment variables.");
    return null;
  }

  return {
    accountSid,
    apiKeySecret,
    apiKeySid,
    messagingServiceSid,
  };
}

async function sendTwilioSms({
  body,
  to,
  twilioConfig,
}: {
  body: string;
  to: string;
  twilioConfig: NonNullable<ReturnType<typeof getTwilioConfig>>;
}) {
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilioConfig.accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${twilioConfig.apiKeySid}:${twilioConfig.apiKeySecret}`,
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        Body: body,
        MessagingServiceSid: twilioConfig.messagingServiceSid,
        To: to,
      }),
      cache: "no-store",
    },
  );
  const result = (await response.json()) as TwilioMessageResponse;

  if (!response.ok || result.code) {
    console.error("Twilio SMS send failed:", {
      code: result.code,
      message: result.message,
      status: response.status,
    });

    return {
      failureCode: result.code ? String(result.code) : String(response.status),
      failureMessage: result.message ?? "Twilio SMS send failed.",
      ok: false as const,
    };
  }

  return {
    ok: true as const,
    sid: result.sid,
    status: result.status ?? "queued",
  };
}

async function insertRecipientLog({
  batchId,
  failureCode,
  failureMessage,
  memberId,
  name,
  phoneNumber = "",
  phoneType = "",
  recipientEmail = "",
  resendMessageId,
  status,
  twilioMessageSid,
}: {
  batchId: string;
  failureCode?: string;
  failureMessage?: string;
  memberId: string;
  name: string;
  phoneNumber?: string;
  phoneType?: string;
  recipientEmail?: string;
  resendMessageId?: string;
  status: string;
  twilioMessageSid?: string;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("communication_message_recipients").insert({
    batch_id: batchId,
    failure_code: failureCode,
    failure_message: failureMessage,
    person_id: memberId,
    person_name: name,
    phone_number: phoneNumber || null,
    phone_type: phoneType || null,
    recipient_email: recipientEmail || null,
    resend_message_id: resendMessageId,
    status,
    twilio_message_sid: twilioMessageSid,
  });

  if (error) {
    console.error("Communication recipient log insert failed:", error);
  }
}

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    normalizeEmailEnv(process.env.GROUP_EMAIL_FROM) ??
    "Apostolic Life <info@apostoliclifeupci.com>";

  if (!apiKey || !from) {
    console.error("Resend email is missing required environment variables.");
    return null;
  }

  return { apiKey, from };
}

async function sendResendEmail({
  apiKey,
  attachments,
  body,
  from,
  replyTo,
  subject,
  to,
}: {
  apiKey: string;
  attachments: EmailAttachment[];
  body: string;
  from: string;
  replyTo?: string;
  subject: string;
  to: string;
}) {
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      attachments: attachments.map((attachment) => ({
        content: attachment.content,
        content_type: attachment.contentType,
        filename: attachment.filename,
      })),
      from,
      html: buildGroupEmailHtml(body),
      reply_to: replyTo,
      subject,
      text: body,
      to: [to],
    }),
    cache: "no-store",
  });

  const result = (await response.json()) as ResendEmailResponse;

  if (!response.ok) {
    console.error("Resend email send failed:", {
      message: result.message,
      name: result.name,
      status: response.status,
    });

    return {
      failureCode: result.name ?? String(response.status),
      failureMessage: result.message ?? "Resend email send failed.",
      ok: false as const,
    };
  }

  return {
    id: result.id,
    ok: true as const,
  };
}

async function parseEmailAttachments(values: FormDataEntryValue[]) {
  const files = values.filter((value): value is File => value instanceof File);
  const attachments: EmailAttachment[] = [];
  let totalBytes = 0;

  if (files.length > MAX_EMAIL_ATTACHMENTS) {
    throw new Error("attachment-limit");
  }

  for (const file of files) {
    if (!file.size) continue;

    if (!ALLOWED_EMAIL_ATTACHMENT_TYPES.has(file.type)) {
      throw new Error("attachment-type");
    }

    totalBytes += file.size;

    if (totalBytes > MAX_EMAIL_ATTACHMENT_BYTES) {
      throw new Error("attachment-size");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    attachments.push({
      content: buffer.toString("base64"),
      contentType: file.type || undefined,
      filename: file.name,
    });
  }

  return attachments;
}

async function logEmailConfigurationFailure({
  attachmentNames,
  groupId,
  groupName,
  members,
  message,
  senderEmail,
  senderUserId,
  subject,
}: {
  attachmentNames: string[];
  groupId: string;
  groupName: string;
  members: Array<{ email: string; id: string; name: string }>;
  message: string;
  senderEmail: string;
  senderUserId: string;
  subject: string;
}) {
  const admin = createAdminClient();
  const { data: batch } = await admin
    .from("communication_message_batches")
    .insert({
      attachment_names: attachmentNames,
      channel: "email",
      failure_count: members.length,
      group_id: groupId,
      group_name: groupName,
      message_body: message,
      recipient_count: members.length,
      sender_email: senderEmail,
      sender_user_id: senderUserId,
      status: "configuration_error",
      subject,
    })
    .select("id")
    .single<{ id: string }>();

  if (!batch?.id) return;

  await Promise.all(
    members.map((member) =>
      insertRecipientLog({
        batchId: batch.id,
        failureMessage: "Resend email is not configured.",
        memberId: member.id,
        name: member.name,
        recipientEmail: normalizeRecipientEmail(member.email),
        status: "failed",
      }),
    ),
  );
}

function buildGroupEmailHtml(body: string) {
  return `
    <div style="font-family: Arial, sans-serif; color: #171717; line-height: 1.6;">
      <div style="white-space: pre-wrap;">${escapeHtml(body)}</div>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeEmailEnv(value?: string) {
  return value?.trim().replace(/^["'“”]+|["'“”]+$/g, "");
}

function normalizeEmailSubject(value: FormDataEntryValue | null) {
  return String(value || "").trim().slice(0, 200);
}

function normalizeEmailMessage(value: FormDataEntryValue | null) {
  return String(value || "").trim().slice(0, 10000);
}

function normalizeRecipientEmail(value: string) {
  const normalizedEmail = value.trim().toLowerCase();

  if (!normalizedEmail || normalizedEmail === "not listed") {
    return "";
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ? normalizedEmail
    : "";
}

async function getSmsOptOuts() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("communication_opt_outs")
    .select("phone_number")
    .eq("channel", "sms");

  if (error) {
    console.error("Communication opt-out lookup failed:", error);
    return new Set<string>();
  }

  return new Set(
    (data ?? [])
      .map((row) => normalizePhoneNumber(row.phone_number))
      .filter((phoneNumber): phoneNumber is string => Boolean(phoneNumber)),
  );
}

async function upsertSmsOptOut(phoneNumber: string, reason?: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("communication_opt_outs").upsert(
    {
      channel: "sms",
      phone_number: phoneNumber,
      reason: reason ?? "Twilio reported this recipient as unsubscribed.",
      source: "twilio",
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "channel,phone_number",
    },
  );

  if (error) {
    console.error("Communication opt-out upsert failed:", error);
  }
}

async function logConfigurationFailure({
  groupId,
  groupName,
  members,
  message,
  senderEmail,
  senderUserId,
}: {
  groupId: string;
  groupName: string;
  members: Array<{ id: string; name: string }>;
  message: string;
  senderEmail: string;
  senderUserId: string;
}) {
  const admin = createAdminClient();
  const { data: batch } = await admin
    .from("communication_message_batches")
    .insert({
      channel: "sms",
      failure_count: members.length,
      group_id: groupId,
      group_name: groupName,
      message_body: appendSmsOptOut(message),
      recipient_count: members.length,
      sender_email: senderEmail,
      sender_user_id: senderUserId,
      status: "configuration_error",
    })
    .select("id")
    .single<{ id: string }>();

  if (!batch?.id) return;

  await Promise.all(
    members.map((member) =>
      insertRecipientLog({
        batchId: batch.id,
        failureMessage: "Twilio SMS is not configured.",
        memberId: member.id,
        name: member.name,
        phoneNumber: "",
        phoneType: "unknown",
        status: "failed",
      }),
    ),
  );
}

function getRecipientPhone(phone: string) {
  const phoneNumber = normalizePhoneNumber(phone);

  return phoneNumber ? { number: phoneNumber, type: "contact" } : null;
}

function normalizePhoneNumber(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue || trimmedValue.toLowerCase() === "not listed") return "";

  if (trimmedValue.startsWith("+")) {
    const digits = trimmedValue.replace(/[^\d+]/g, "");

    return digits.length > 8 ? digits : "";
  }

  const digits = trimmedValue.replace(/\D/g, "");

  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  return "";
}

function normalizeMessage(value: FormDataEntryValue | null) {
  return String(value || "").trim().slice(0, 1000);
}

function appendSmsOptOut(message: string) {
  return /\bstop\b/i.test(message) ? message : `${message}\nReply STOP to opt out.`;
}
