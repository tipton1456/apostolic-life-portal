"use server";

import {
  getMobilePhoneForPortalUser,
  getPortalUserContactProfile,
} from "@/lib/contact-phone";
import { buildPortalLoginUrl } from "@/lib/portal-url";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  insertCommunicationBatch,
  insertCommunicationRecipient,
} from "@/lib/communication-db-compat";
import { appendSmsOptOut, getTwilioConfig, sendTwilioSms } from "@/lib/twilio-sms";

export async function notifyProjectManagersTaskCompleted({
  completedByName,
  projectId,
  projectName,
  senderUserId,
  senderEmail,
  taskTitle,
}: {
  completedByName: string;
  projectId: string;
  projectName: string;
  senderUserId: string;
  senderEmail: string;
  taskTitle: string;
}) {
  const managers = await listProjectManagerContacts(projectId);
  const loginUrl = buildPortalLoginUrl(`/projects/${projectId}`);
  const message = appendSmsOptOut(
    `Apostolic Life Projects: "${taskTitle}" was completed by ${completedByName} on ${projectName}. View: ${loginUrl}`,
  );

  await sendProjectSmsBatch({
    message,
    projectId,
    projectName,
    recipients: managers,
    senderEmail,
    senderUserId,
    subject: "Task completed",
  });
}

export async function notifyNewProjectParticipantAccountCreated({
  assigneeUserId,
  email,
  phone,
  projectId,
  projectName,
  senderUserId,
  senderEmail,
  taskId,
  taskTitle,
  temporaryPassword,
}: {
  assigneeUserId: string;
  email: string;
  phone?: string | null;
  projectId: string;
  projectName: string;
  senderUserId: string;
  senderEmail: string;
  taskId: string;
  taskTitle: string;
  temporaryPassword: string;
}) {
  const loginUrl = buildPortalLoginUrl(`/projects/${projectId}?task=${taskId}`);
  const message = appendSmsOptOut(
    [
      "Apostolic Life Portal: Your account was created and a project task was assigned.",
      `Username: ${email}`,
      `Temp password: ${temporaryPassword}`,
      `Sign in: ${loginUrl}`,
      "You will be asked to change your password after login.",
      `Task: "${taskTitle}" on ${projectName}.`,
      "After login, open Project Management to view your task.",
    ].join(" "),
  );

  const resolvedPhone =
    phone || (await getPortalUserContactProfile(assigneeUserId)).phone;

  if (!resolvedPhone) {
    console.warn("Skipping new account SMS because no phone was found.", {
      assigneeUserId,
      email,
    });
    return;
  }

  await sendSingleAssigneeProjectSms({
    assigneeUserId,
    email,
    message,
    name: email,
    phone: resolvedPhone,
    projectId,
    projectName,
    senderEmail,
    senderUserId,
    subject: "Portal account created",
  });
}

export async function notifyProjectParticipantTaskAssigned({
  assigneeUserId,
  phone: phoneOverride,
  projectId,
  projectName,
  senderUserId,
  senderEmail,
  taskId,
  taskTitle,
}: {
  assigneeUserId: string;
  phone?: string | null;
  projectId: string;
  projectName: string;
  senderUserId: string;
  senderEmail: string;
  taskId: string;
  taskTitle: string;
}) {
  const assignee = await getPortalUserContactProfile(assigneeUserId);
  const phone = phoneOverride || assignee.phone;

  if (!phone) {
    console.warn("Skipping task assignment SMS because no phone was found.", {
      assigneeUserId,
      email: assignee.email,
    });
    return;
  }

  const loginUrl = buildPortalLoginUrl(`/projects/${projectId}?task=${taskId}`);
  const message = appendSmsOptOut(
    `Apostolic Life Projects: You were assigned "${taskTitle}" on ${projectName}. Open: ${loginUrl}`,
  );

  await sendSingleAssigneeProjectSms({
    assigneeUserId,
    email: assignee.email,
    message,
    name: assignee.fullName,
    phone,
    projectId,
    projectName,
    senderEmail,
    senderUserId,
    subject: "Task assigned",
  });
}

async function sendSingleAssigneeProjectSms({
  assigneeUserId,
  email,
  name,
  phone,
  message,
  projectId,
  projectName,
  senderEmail,
  senderUserId,
  subject,
}: {
  assigneeUserId: string;
  email: string;
  name: string;
  phone: string;
  message: string;
  projectId: string;
  projectName: string;
  senderEmail: string;
  senderUserId: string;
  subject: string;
}) {
  if (!assigneeUserId) {
    throw new Error("Task assignment SMS requires an assignee.");
  }

  await sendProjectSmsBatch({
    message,
    projectId,
    projectName,
    recipients: [
      {
        email,
        name,
        phone,
        userId: assigneeUserId,
      },
    ],
    senderEmail,
    senderUserId,
    subject,
  });
}

async function listProjectManagerContacts(projectId: string) {
  const admin = createAdminClient();
  const { data: managerRows, error: managerError } = await admin
    .from("project_managers")
    .select("user_id")
    .eq("project_id", projectId);

  if (managerError) {
    console.error("Project manager lookup failed:", managerError);
    return [];
  }

  const userIds = (managerRows ?? []).map((row) => row.user_id as string);
  if (userIds.length === 0) return [];

  const { data, error } = await admin
    .from("portal_users")
    .select("id,email,first_name,last_name")
    .in("id", userIds);

  if (error) {
    console.error("Project manager profile lookup failed:", error);
    return [];
  }

  const contacts = await Promise.all(
    (data ?? []).map(async (profile) => {
      const phone = await getMobilePhoneForPortalUser({
        email: profile.email,
        firstName: profile.first_name ?? undefined,
        lastName: profile.last_name ?? undefined,
      });

      return {
        email: profile.email,
        name: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email,
        phone,
        userId: profile.id,
      };
    }),
  );

  const uniqueByUserId = new Map<string, (typeof contacts)[number]>();

  for (const contact of contacts) {
    if (!contact.phone || uniqueByUserId.has(contact.userId)) continue;

    uniqueByUserId.set(contact.userId, contact);
  }

  return [...uniqueByUserId.values()];
}

async function sendProjectSmsBatch({
  message,
  projectId,
  projectName,
  recipients,
  senderEmail,
  senderUserId,
  subject,
}: {
  message: string;
  projectId: string;
  projectName: string;
  recipients: Array<{
    email: string;
    name: string;
    phone: string | null;
    userId: string;
  }>;
  senderEmail: string;
  senderUserId: string;
  subject: string;
}) {
  const twilioConfig = getTwilioConfig();

  if (!twilioConfig) {
    console.error("Project SMS skipped because Twilio is not configured.");
    return;
  }

  const deliverableRecipients = recipients.filter((recipient) => recipient.phone);

  if (deliverableRecipients.length === 0) {
    console.warn("Project SMS skipped because no recipient phone numbers were found.");
    return;
  }

  if (subject === "Task assigned" || subject === "Portal account created") {
    if (deliverableRecipients.length !== 1) {
      console.error("Assignment SMS blocked because multiple recipients were requested.", {
        projectId,
        recipientCount: deliverableRecipients.length,
        subject,
      });
      return;
    }
  }

  const admin = createAdminClient();
  const { data: batch, error: batchError } = await insertCommunicationBatch(admin, {
    channel: "sms",
    group_id: projectId,
    group_name: `Project: ${projectName}`,
    message_body: message,
    recipient_count: deliverableRecipients.length,
    sender_email: senderEmail,
    sender_user_id: senderUserId,
    status: "sending",
    subject,
  });

  if (batchError || !batch?.id) {
    console.error("Project SMS batch insert failed:", batchError);
    return;
  }

  let successCount = 0;
  let failureCount = 0;
  let skippedCount = 0;

  for (const recipient of recipients) {
    if (!recipient.phone) {
      skippedCount += 1;
      await insertCommunicationRecipient(admin, {
        batch_id: batch.id,
        failure_message: "No contact phone number listed.",
        person_id: recipient.userId,
        person_name: recipient.name,
        recipient_email: recipient.email,
        status: "skipped",
      });
      continue;
    }

    const result = await sendTwilioSms({
      body: message,
      to: recipient.phone,
      twilioConfig,
    });

    if (result.ok) {
      successCount += 1;
      await insertCommunicationRecipient(admin, {
        batch_id: batch.id,
        person_id: recipient.userId,
        person_name: recipient.name,
        phone_number: recipient.phone,
        phone_type: "mobile",
        recipient_email: recipient.email,
        status: result.status,
        twilio_message_sid: result.sid,
      });
      continue;
    }

    failureCount += 1;
    await insertCommunicationRecipient(admin, {
      batch_id: batch.id,
      failure_code: result.failureCode,
      failure_message: result.failureMessage,
      person_id: recipient.userId,
      person_name: recipient.name,
      phone_number: recipient.phone,
      phone_type: "mobile",
      recipient_email: recipient.email,
      status: "failed",
    });
  }

  await admin
    .from("communication_message_batches")
    .update({
      failure_count: failureCount,
      skipped_count: skippedCount,
      status:
        failureCount > 0
          ? successCount > 0
            ? "partial"
            : "failed"
          : "sent",
      success_count: successCount,
    })
    .eq("id", batch.id);
}

