import { createAdminClient } from "@/lib/supabase/admin";
import { getRecipientPhone } from "@/lib/twilio-sms";

type ElvantoSearchResponse = {
  status?: string;
  people?: {
    person?: Array<{
      id?: string;
      email?: string;
      mobile?: string;
      phone?: string;
    }> | {
      id?: string;
      email?: string;
      mobile?: string;
      phone?: string;
    };
  };
};

export async function getMobilePhoneForPortalUser({
  email,
  firstName,
  lastName,
}: {
  email: string;
  firstName?: string;
  lastName?: string;
}) {
  const elvantoPhone = await getElvantoPhoneForEmail(email);

  if (elvantoPhone) return elvantoPhone;

  const planningCenterPhone = await getPlanningCenterPhoneForEmail({
    email,
    firstName,
    lastName,
  });

  return planningCenterPhone;
}

async function getElvantoPhoneForEmail(email: string) {
  const apiKey = process.env.ELVANTO_API_KEY;

  if (!apiKey) return null;

  const authorization = `Basic ${Buffer.from(`${apiKey}:x`).toString("base64")}`;

  try {
    const response = await fetch(
      "https://api.elvanto.com/v1/people/search.json",
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          email,
          page: "1",
          page_size: "5",
        }),
        cache: "no-store",
      },
    );
    const result = (await response.json()) as ElvantoSearchResponse;
    const people = normalizeElvantoPeople(result.people?.person);

    for (const person of people) {
      const phone = pickListedPhone(person.mobile, person.phone);

      if (phone) return phone;
    }
  } catch (error) {
    console.error("Elvanto phone lookup failed:", error);
  }

  return null;
}

async function getPlanningCenterPhoneForEmail({
  email,
  firstName,
  lastName,
}: {
  email: string;
  firstName?: string;
  lastName?: string;
}) {
  const appId = process.env.PLANNING_CENTER_APPLICATION_ID;
  const secret = process.env.PLANNING_CENTER_SECRET;

  if (!appId || !secret) return null;

  const auth = Buffer.from(`${appId}:${secret}`).toString("base64");

  try {
    const emailResponse = await fetch(
      `https://api.planningcenteronline.com/people/v2/emails?where[address]=${encodeURIComponent(email)}&per_page=1`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
        cache: "no-store",
      },
    );

    if (!emailResponse.ok) return null;

    const emailPayload = (await emailResponse.json()) as {
      data?: Array<{
        relationships?: {
          person?: {
            data?: {
              id?: string;
            };
          };
        };
      }>;
    };
    let personId = emailPayload.data?.[0]?.relationships?.person?.data?.id ?? null;

    if (!personId && firstName && lastName) {
      const searchResponse = await fetch(
        `https://api.planningcenteronline.com/people/v2/people?where[search_name]=${encodeURIComponent(`${firstName} ${lastName}`)}&per_page=1`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
          cache: "no-store",
        },
      );

      if (searchResponse.ok) {
        const searchPayload = (await searchResponse.json()) as {
          data?: Array<{ id?: string }>;
        };
        personId = searchPayload.data?.[0]?.id ?? null;
      }
    }

    if (!personId) return null;

    const phoneResponse = await fetch(
      `https://api.planningcenteronline.com/people/v2/people/${personId}/phone_numbers?per_page=25`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
        cache: "no-store",
      },
    );

    if (!phoneResponse.ok) return null;

    const phonePayload = (await phoneResponse.json()) as {
      data?: Array<{
        attributes?: {
          number?: string;
          location?: string;
          primary?: boolean;
        };
      }>;
    };
    const phoneNumbers = phonePayload.data ?? [];
    const mobile = phoneNumbers.find(
      (entry) => entry.attributes?.location?.toLowerCase() === "mobile",
    );
    const primary = phoneNumbers.find((entry) => entry.attributes?.primary);
    const fallback = phoneNumbers[0];

    return (
      normalizeListedPhone(mobile?.attributes?.number) ??
      normalizeListedPhone(primary?.attributes?.number) ??
      normalizeListedPhone(fallback?.attributes?.number)
    );
  } catch (error) {
    console.error("Planning Center phone lookup failed:", error);
    return null;
  }
}

export async function getPortalUserContactProfile(userId: string) {
  const admin = createAdminClient();
  const [{ data: profile }, { data: authUser }] = await Promise.all([
    admin
      .from("portal_users")
      .select("email,first_name,last_name")
      .eq("id", userId)
      .maybeSingle(),
    admin.auth.admin.getUserById(userId),
  ]);

  const email = profile?.email ?? authUser.user?.email ?? "";
  const firstName = profile?.first_name ?? "";
  const lastName = profile?.last_name ?? "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || email;

  const phone = email
    ? await getMobilePhoneForPortalUser({ email, firstName, lastName })
    : null;

  return {
    email,
    firstName,
    fullName,
    lastName,
    phone,
  };
}

function normalizeElvantoPeople(
  value:
    | Array<{
        id?: string;
        email?: string;
        mobile?: string;
        phone?: string;
      }>
    | {
        id?: string;
        email?: string;
        mobile?: string;
        phone?: string;
      }
    | undefined,
) {
  if (!value) return [];

  return Array.isArray(value) ? value : [value];
}

function pickListedPhone(...values: Array<string | undefined>) {
  for (const value of values) {
    const normalized = normalizeListedPhone(value);

    if (normalized) return normalized;
  }

  return null;
}

function normalizeListedPhone(value?: string) {
  if (!value) return null;

  return getRecipientPhone(value)?.number ?? null;
}