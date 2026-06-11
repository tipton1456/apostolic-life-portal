type TwilioMessageResponse = {
  code?: number;
  message?: string;
  sid?: string;
  status?: string;
};

export function getTwilioConfig() {
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

export async function sendTwilioSms({
  body,
  to,
  twilioConfig = getTwilioConfig(),
}: {
  body: string;
  to: string;
  twilioConfig?: ReturnType<typeof getTwilioConfig>;
}) {
  if (!twilioConfig) {
    return {
      failureMessage: "Twilio SMS is not configured.",
      ok: false as const,
    };
  }

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

export function normalizePhoneNumber(value: string) {
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

export function getRecipientPhone(phone: string) {
  const phoneNumber = normalizePhoneNumber(phone);

  return phoneNumber ? { number: phoneNumber, type: "contact" } : null;
}

export function appendSmsOptOut(message: string) {
  return /\bstop\b/i.test(message) ? message : `${message}\nReply STOP to opt out.`;
}