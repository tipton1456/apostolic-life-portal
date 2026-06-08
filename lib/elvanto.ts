import { createClient } from "@/lib/supabase/server";
import { sampleHousehold } from "./sample-household";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { syncPlanningCenterContactUpdate } from "./planning-center";

type ElvantoPerson = {
  id?: string;
  firstname?: string;
  preferred_name?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  birthday?: string;
  picture?: string;
  family_relationship?: string;
  family_id?: string;
  family?: {
    family_member?: ElvantoFamilyMember[];
  };
  mailing_address?: string;
  mailing_address2?: string;
  mailing_city?: string;
  mailing_state?: string;
  mailing_postcode?: string;
  mailing_country?: string;
  home_address?: string;
  home_address2?: string;
  home_city?: string;
  home_state?: string;
  home_postcode?: string;
  home_country?: string;
};

type ElvantoFamilyMember = {
  id?: string;
  firstname?: string;
  lastname?: string;
  relationship?: string;
};

type HouseholdPerson = {
  id: string;
  firstName: string;
  lastName: string;
  relationship?: string;
  email: string;
  phone: string;
  mobile: string;
  birthday: string;
  birthdayValue: string;
  picture?: string;
};

type Household = {
  primary: HouseholdPerson & { address: string; addressFields: AddressFields };
  family: HouseholdPerson[];
};

type AddressFields = {
  city: string;
  country: string;
  line1: string;
  line2: string;
  postcode: string;
  state: string;
};

type ContactUpdateInput = {
  address?: AddressFields;
  birthday?: string;
  email?: string;
  mobile?: string;
  personId: string;
  phone?: string;
  pictureUrl?: string;
};

const PERSON_DETAIL_FIELDS = [
  "family",
  "birthday",
  "mailing_address",
  "mailing_address2",
  "mailing_city",
  "mailing_state",
  "mailing_postcode",
  "mailing_country",
  "home_address",
  "home_address2",
  "home_city",
  "home_state",
  "home_postcode",
  "home_country",
];

export function hasSharedElvantoApiKey() {
  return Boolean(process.env.ELVANTO_API_KEY);
}

export async function getHousehold(email?: string): Promise<Household | null> {
  if (!email) return sampleHousehold;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return sampleHousehold;

  if (!user.email || user.email.toLowerCase() !== email.toLowerCase()) {
    console.error("Elvanto lookup blocked because login email did not match.");
    return null;
  }

  const authorization = getElvantoAuthorization();

  if (!authorization) return null;

  try {
    const primaryResult = await searchPeople(authorization, {
      "search[email]": email,
    });

    const primaryPeople = normalizeArray<ElvantoPerson>(
      primaryResult?.people?.person,
    );

    const primaryPerson =
      primaryPeople.find(
        (person) => person.family_relationship === "Primary Contact",
      ) ?? primaryPeople[0];

    if (!primaryPerson?.id) return null;

    const detailResult = await getPersonInfoWithFamily(
      authorization,
      primaryPerson.id,
    );

    const detailPerson =
      normalizeArray<ElvantoPerson>(detailResult?.person)[0] ?? primaryPerson;

    const familyMembers = normalizeArray<ElvantoFamilyMember>(
      detailPerson?.family?.family_member,
    );

    const familyDetails = await Promise.all(
      familyMembers
        .filter((member) => member.id && member.id !== detailPerson.id)
        .map(async (member) => {
          const memberDetail = await getPersonInfo(authorization, member.id!);

          const personDetail = normalizeArray<ElvantoPerson>(
            memberDetail?.person,
          )[0];

          return mapElvantoPerson({
            ...personDetail,
            family_relationship:
              member.relationship ?? personDetail?.family_relationship,
          });
        }),
    );

    return {
      primary: {
        ...mapElvantoPerson(detailPerson),
        address: formatAddress(detailPerson),
        addressFields: getAddressFields(detailPerson),
      },
      family: familyDetails,
    };
  } catch (error) {
    console.error("Elvanto API error:", error);
    return null;
  }
}

export async function updateContactFromForm(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/login");
  }

  const household = await getHousehold(user.email);

  if (!household) {
    throw new Error("Unable to find your household.");
  }

  const personId = String(formData.get("personId") || "");
  const personType = String(formData.get("personType") || "");
  const householdPeople = [household.primary, ...household.family];
  const person = householdPeople.find((householdPerson) => householdPerson.id === personId);

  if (!person) {
    throw new Error("You can only update people in your household.");
  }

  const update: ContactUpdateInput = {
    personId,
    birthday: normalizeDateInput(String(formData.get("birthday") || "")),
    mobile: normalizeOptionalInput(formData.get("mobile")),
    phone: normalizeOptionalInput(formData.get("phone")),
  };

  if (personType === "family") {
    update.email = normalizeOptionalInput(formData.get("email"));
  }

  if (personType === "primary") {
    update.pictureUrl = normalizeOptionalInput(formData.get("pictureUrl"));
    update.address = {
      line1: normalizeOptionalInput(formData.get("addressLine1")),
      line2: normalizeOptionalInput(formData.get("addressLine2")),
      city: normalizeOptionalInput(formData.get("city")),
      state: normalizeOptionalInput(formData.get("state")),
      postcode: normalizeOptionalInput(formData.get("postcode")),
      country: normalizeOptionalInput(formData.get("country")) || "United States",
    };
  }

  await updateElvantoContact(update);

  let updateStatus = "elvanto";

  if (personType === "primary") {
    try {
      const planningCenterResult = await syncPlanningCenterContactUpdate({
        address: update.address
          ? {
              city: update.address.city,
              countryCode: normalizeCountryCode(update.address.country),
              state: update.address.state,
              streetLine1: update.address.line1,
              streetLine2: update.address.line2,
              zip: update.address.postcode,
            }
          : undefined,
        birthdate: update.birthday,
        email: update.email,
        firstName: person.firstName,
        lastName: person.lastName,
        mobile: update.mobile,
        phone: update.phone,
        pictureUrl: update.pictureUrl,
        previousEmail: person.email,
      });

      updateStatus = planningCenterResult.matched ? "synced" : "elvanto";
    } catch (error) {
      console.error("Planning Center contact sync failed:", error);
      updateStatus = "partial";
    }
  }

  revalidatePath("/contact");
  redirect(`/contact?updated=${updateStatus}`);
}

function getElvantoAuthorization() {
  const apiKey = process.env.ELVANTO_API_KEY;

  if (!apiKey) {
    console.error("ELVANTO_API_KEY is not configured.");
    return null;
  }

  return `Basic ${Buffer.from(`${apiKey}:x`).toString("base64")}`;
}

function normalizeArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];

  return Array.isArray(value) ? value : [value];
}

async function searchPeople(
  authorization: string,
  searchParams: Record<string, string>,
) {
  const response = await fetch(
    "https://api.elvanto.com/v1/people/search.json",
    {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        page: "1",
        page_size: "20",
        ...searchParams,
      }),
      cache: "no-store",
    },
  );

  return response.json();
}

async function getPersonInfoWithFamily(authorization: string, personId: string) {
  const response = await fetch(
    "https://api.elvanto.com/v1/people/getInfo.json",
    {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: buildGetInfoBody(personId),
      cache: "no-store",
    },
  );

  return response.json();
}

async function getPersonInfo(authorization: string, personId: string) {
  const response = await fetch(
    "https://api.elvanto.com/v1/people/getInfo.json",
    {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: buildGetInfoBody(personId),
      cache: "no-store",
    },
  );

  return response.json();
}

function buildGetInfoBody(personId: string) {
  return new URLSearchParams({
    id: personId,
    ...Object.fromEntries(
      PERSON_DETAIL_FIELDS.map((field, index) => [`fields[${index}]`, field]),
    ),
  });
}

function mapElvantoPerson(person: Partial<ElvantoPerson>): HouseholdPerson {
  return {
    id: person.id || "",
    firstName: person.preferred_name || person.firstname || "",
    lastName: person.lastname || "",
    relationship: person.family_relationship || "Family Member",
    email: person.email || "Not listed",
    phone: person.phone || "Not listed",
    mobile: person.mobile || "Not listed",
    birthday: formatBirthday(person.birthday),
    birthdayValue: person.birthday || "",
    picture: person.picture,
  };
}

async function updateElvantoContact(update: ContactUpdateInput) {
  const authorization = getElvantoAuthorization();

  if (!authorization) {
    throw new Error("Elvanto is not configured.");
  }

  const body: Record<string, string> = {
    id: update.personId,
  };

  if (update.email !== undefined) body.email = update.email;
  if (update.phone !== undefined) body.phone = update.phone;
  if (update.mobile !== undefined) body.mobile = update.mobile;
  if (update.birthday !== undefined) body["fields[birthday]"] = update.birthday;

  if (update.address) {
    body["fields[mailing_address]"] = update.address.line1;
    body["fields[mailing_address2]"] = update.address.line2;
    body["fields[mailing_city]"] = update.address.city;
    body["fields[mailing_state]"] = update.address.state;
    body["fields[mailing_postcode]"] = update.address.postcode;
    body["fields[mailing_country]"] = update.address.country;
  }

  await postElvanto("people/edit.json", authorization, body);

  if (update.pictureUrl) {
    await postElvanto("people/edit.json", authorization, {
      id: update.personId,
      "fields[picture]": update.pictureUrl,
    }).catch((error) => {
      console.error("Elvanto picture update failed:", error);
    });
  }
}

async function postElvanto(
  path: string,
  authorization: string,
  body: Record<string, string>,
) {
  const response = await fetch(`https://api.elvanto.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  const text = await response.text();
  const result = text ? JSON.parse(text) : {};

  if (!response.ok || result?.status === "error" || result?.error) {
    console.error(`Elvanto ${path} failed:`, result);
    throw new Error("Elvanto contact update failed.");
  }

  return result;
}

function formatBirthday(birthday?: string) {
  if (!birthday) return "Not listed";

  const [year, month, day] = birthday.split("-").map(Number);

  if (!year || !month || !day) return birthday;

  const birthDate = new Date(Date.UTC(year, month - 1, day));
  const formattedBirthday = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(birthDate);

  return `${formattedBirthday} (Age ${calculateAge(year, month, day)})`;
}

function calculateAge(year: number, month: number, day: number) {
  const today = new Date();
  let age = today.getFullYear() - year;
  const hasBirthdayPassedThisYear =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);

  if (!hasBirthdayPassedThisYear) {
    age -= 1;
  }

  return age;
}

function formatAddress(person: Partial<ElvantoPerson>) {
  const mailingAddress = joinAddress([
    person.mailing_address,
    person.mailing_address2,
    person.mailing_city,
    person.mailing_state,
    person.mailing_postcode,
    person.mailing_country,
  ]);

  if (mailingAddress) return mailingAddress;

  return (
    joinAddress([
      person.home_address,
      person.home_address2,
      person.home_city,
      person.home_state,
      person.home_postcode,
      person.home_country,
    ]) || "Address not listed"
  );
}

function getAddressFields(person: Partial<ElvantoPerson>): AddressFields {
  const hasMailingAddress = Boolean(
    person.mailing_address ||
      person.mailing_address2 ||
      person.mailing_city ||
      person.mailing_state ||
      person.mailing_postcode ||
      person.mailing_country,
  );

  return hasMailingAddress
    ? {
        line1: person.mailing_address || "",
        line2: person.mailing_address2 || "",
        city: person.mailing_city || "",
        state: person.mailing_state || "",
        postcode: person.mailing_postcode || "",
        country: person.mailing_country || "United States",
      }
    : {
        line1: person.home_address || "",
        line2: person.home_address2 || "",
        city: person.home_city || "",
        state: person.home_state || "",
        postcode: person.home_postcode || "",
        country: person.home_country || "United States",
      };
}

function joinAddress(parts: Array<string | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

function normalizeOptionalInput(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function normalizeDateInput(value: string) {
  const trimmedValue = value.trim();

  return /^\d{4}-\d{2}-\d{2}$/.test(trimmedValue) ? trimmedValue : "";
}

function normalizeCountryCode(country: string) {
  const normalizedCountry = country.trim().toUpperCase();

  if (!normalizedCountry || normalizedCountry === "UNITED STATES") return "US";
  if (normalizedCountry.length === 2) return normalizedCountry;

  return normalizedCountry;
}
