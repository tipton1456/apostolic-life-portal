"use server";

import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  notifyNewProjectParticipantAccountCreated,
  notifyProjectParticipantTaskAssigned,
} from "@/lib/project-notifications";
import { CREATE_NEW_ASSIGNEE_VALUE } from "@/lib/project-participant-constants";
import { normalizePhoneNumber } from "@/lib/twilio-sms";

export type ResolvedTaskAssignee = {
  userId: string | null;
  email?: string;
  isNewAccount: boolean;
  temporaryPassword?: string;
  phone?: string | null;
};

export async function resolveTaskAssigneeFromForm(
  formData: FormData,
  projectId: string,
  actor: { id: string; email: string },
): Promise<ResolvedTaskAssignee> {
  const assignedToValue = String(formData.get("assignedTo") || "").trim();

  if (!assignedToValue || assignedToValue === CREATE_NEW_ASSIGNEE_VALUE) {
    if (assignedToValue !== CREATE_NEW_ASSIGNEE_VALUE) {
      return { userId: null, isNewAccount: false };
    }

    return createOrAttachProjectParticipantFromForm(formData, projectId, actor);
  }

  return {
    userId: assignedToValue,
    isNewAccount: false,
  };
}

export async function sendTaskAssignmentNotifications({
  assignee,
  assigneeUserId,
  projectId,
  projectName,
  senderEmail,
  senderUserId,
  taskId,
  taskTitle,
}: {
  assignee: ResolvedTaskAssignee;
  assigneeUserId: string;
  projectId: string;
  projectName: string;
  senderEmail: string;
  senderUserId: string;
  taskId: string;
  taskTitle: string;
}) {
  if (assignee.isNewAccount && assignee.temporaryPassword && assignee.email) {
    await notifyNewProjectParticipantAccountCreated({
      assigneeUserId,
      email: assignee.email,
      phone: assignee.phone,
      projectId,
      projectName,
      senderEmail,
      senderUserId,
      taskId,
      taskTitle,
      temporaryPassword: assignee.temporaryPassword,
    });
    return;
  }

  await notifyProjectParticipantTaskAssigned({
    assigneeUserId,
    phone: assignee.phone,
    projectId,
    projectName,
    senderEmail,
    senderUserId,
    taskId,
    taskTitle,
  });
}

async function createOrAttachProjectParticipantFromForm(
  formData: FormData,
  projectId: string,
  actor: { id: string; email: string },
): Promise<ResolvedTaskAssignee> {
  const email = normalizeEmail(formData.get("newParticipantEmail"));
  const firstName = normalizeText(formData.get("newParticipantFirstName"));
  const lastName = normalizeText(formData.get("newParticipantLastName"));
  const phone = normalizePhoneNumber(String(formData.get("newParticipantPhone") || ""));

  if (!email) {
    throw new Error("Email is required to create a new project participant.");
  }

  if (!firstName || !lastName) {
    throw new Error("First and last name are required for a new project participant.");
  }

  if (!phone) {
    throw new Error("A valid mobile phone number is required to send the portal login SMS.");
  }

  const existingUserId = await findPortalUserIdByEmail(email);

  if (existingUserId) {
    await ensureProjectMember(projectId, existingUserId, actor.id);
    await storePortalUserMobilePhone(existingUserId, phone);

    return {
      userId: existingUserId,
      email,
      isNewAccount: false,
      phone,
    };
  }

  const temporaryPassword = generateTemporaryPassword();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      mobile_phone: phone,
    },
  });

  if (error || !data.user) {
    console.error("Project participant account creation failed:", error);
    throw new Error(error?.message ?? "Unable to create portal account.");
  }

  const { error: profileError } = await admin.from("portal_users").upsert({
    id: data.user.id,
    email,
    first_name: firstName,
    last_name: lastName,
    is_admin: false,
    can_access_projects: false,
    must_reset_password: true,
  });

  if (profileError) {
    console.error("Project participant profile upsert failed:", profileError);
    throw new Error("Unable to save portal user profile.");
  }

  await ensureProjectMember(projectId, data.user.id, actor.id);

  return {
    userId: data.user.id,
    email,
    isNewAccount: true,
    temporaryPassword,
    phone,
  };
}

async function findPortalUserIdByEmail(email: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("portal_users")
    .select("id")
    .eq("email", email)
    .maybeSingle<{ id: string }>();

  if (error) {
    console.error("Portal user email lookup failed:", error);
    throw new Error("Unable to look up portal user.");
  }

  return data?.id ?? null;
}

async function storePortalUserMobilePhone(userId: string, phone: string) {
  const admin = createAdminClient();
  const { data: authUser, error } = await admin.auth.admin.getUserById(userId);

  if (error || !authUser.user) {
    console.error("Portal user phone update lookup failed:", error);
    return;
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...authUser.user.user_metadata,
      mobile_phone: phone,
    },
  });

  if (updateError) {
    console.error("Portal user phone metadata update failed:", updateError);
  }
}

async function ensureProjectMember(
  projectId: string,
  userId: string,
  addedBy: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Project member lookup failed:", error);
    throw new Error("Unable to validate project membership.");
  }

  if (data) return;

  const { error: insertError } = await supabase.from("project_members").insert({
    project_id: projectId,
    user_id: userId,
    added_by: addedBy,
  });

  if (insertError) {
    console.error("Project member insert failed:", insertError);
    throw new Error(insertError.message);
  }
}

function generateTemporaryPassword() {
  return randomBytes(9).toString("base64url").slice(0, 12);
}

function normalizeEmail(value: FormDataEntryValue | null) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}