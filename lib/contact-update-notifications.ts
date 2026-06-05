type ContactUpdateNotification = {
  request: string;
  userEmail?: string;
  userId: string;
};

const RESEND_API_URL = "https://api.resend.com/emails";

export async function sendContactUpdateNotification({
  request,
  userEmail,
  userId,
}: ContactUpdateNotification) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = normalizeEmailEnv(process.env.CONTACT_UPDATE_NOTIFICATION_EMAIL);
  const from = normalizeEmailEnv(process.env.CONTACT_UPDATE_FROM_EMAIL);

  if (!apiKey || !to || !from) {
    console.warn(
      "Contact update email skipped. Configure RESEND_API_KEY, CONTACT_UPDATE_NOTIFICATION_EMAIL, and CONTACT_UPDATE_FROM_EMAIL.",
    );
    return;
  }

  const submittedBy = userEmail ?? userId;
  const subject = "New contact update request";
  const text = [
    "A new contact update request was submitted.",
    "",
    `Submitted by: ${submittedBy}`,
    `User ID: ${userId}`,
    "",
    "Request:",
    request,
  ].join("\n");

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
      html: buildEmailHtml({ request, submittedBy, userId }),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Contact update email failed:", errorText);
    return;
  }

  const result = (await response.json()) as { id?: string };
  console.log("Contact update email sent:", {
    id: result.id,
    to,
  });
}

function buildEmailHtml({
  request,
  submittedBy,
  userId,
}: {
  request: string;
  submittedBy: string;
  userId: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif; color: #171717; line-height: 1.5;">
      <h1 style="font-size: 22px;">New contact update request</h1>
      <p><strong>Submitted by:</strong> ${escapeHtml(submittedBy)}</p>
      <p><strong>User ID:</strong> ${escapeHtml(userId)}</p>
      <p><strong>Request:</strong></p>
      <div style="white-space: pre-wrap; border-left: 4px solid #a3e635; padding-left: 12px;">${escapeHtml(
        request,
      )}</div>
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
