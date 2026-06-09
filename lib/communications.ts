"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isDemoMode } from "@/lib/demo";
import { getLeaderGroupDetail } from "@/lib/elvanto-groups";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type CommunicationBatchRow = {
  id: string;
  channel: string;
  group_id: string | null;
  group_name: string | null;
  sender_email: string | null;
  message_body: string;
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
  status: string;
  twilio_message_sid: string | null;
  failure_code: string | null;
  failure_message: string | null;
  created_at: string;
};

export type CommunicationLog = {
  id: string;
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
  successCount: number;
};

export type CommunicationRecipient = {
  id: string;
  createdAt: string;
  failureCode?: string;
  failureMessage?: string;
  personName: string;
  phoneNumber: string;
  phoneType: string;
  status: string;
  twilioMessageSid?: string;
};

type TwilioMessageResponse = {
  code?: number;
  message?: string;
  sid?: string;
  status?: string;
};

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

export async function listCommunicationLogs(): Promise<CommunicationLog[]> {
  const admin = createAdminClient();
  const [{ data: batches, error: batchError }, { data: recipients, error: recipientError }] =
    await Promise.all([
      admin
        .from("communication_message_batches")
        .select(
          "id,channel,group_id,group_name,sender_email,message_body,recipient_count,success_count,failure_count,skipped_count,status,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("communication_message_recipients")
        .select(
          "id,batch_id,person_name,phone_number,phone_type,status,twilio_message_sid,failure_code,failure_message,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(500),
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

    batchRecipients.push({
      id: recipient.id,
      createdAt: recipient.created_at,
      failureCode: recipient.failure_code ?? undefined,
      failureMessage: recipient.failure_message ?? undefined,
      personName: recipient.person_name,
      phoneNumber: recipient.phone_number ?? "",
      phoneType: recipient.phone_type ?? "",
      status: recipient.status,
      twilioMessageSid: recipient.twilio_message_sid ?? undefined,
    });
    recipientsByBatchId.set(recipient.batch_id, batchRecipients);
  }

  return ((batches ?? []) as CommunicationBatchRow[]).map((batch) => ({
    id: batch.id,
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
  phoneNumber,
  phoneType,
  status,
  twilioMessageSid,
}: {
  batchId: string;
  failureCode?: string;
  failureMessage?: string;
  memberId: string;
  name: string;
  phoneNumber: string;
  phoneType: string;
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
    phone_number: phoneNumber,
    phone_type: phoneType,
    status,
    twilio_message_sid: twilioMessageSid,
  });

  if (error) {
    console.error("Communication recipient log insert failed:", error);
  }
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
