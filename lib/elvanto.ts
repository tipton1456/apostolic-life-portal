import { createClient } from "@/lib/supabase/server";
import { sampleHousehold } from "./sample-household";

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
  firstName: string;
  lastName: string;
  relationship?: string;
  email: string;
  phone: string;
  mobile: string;
  birthday: string;
  picture?: string;
};

type Household = {
  primary: HouseholdPerson & { address: string };
  family: HouseholdPerson[];
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

export async function getHousehold(email?: string): Promise<Household> {
  if (!email) return sampleHousehold;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return sampleHousehold;

  const { data: connection, error } = await supabase
    .from("elvanto_connections")
    .select("access_token")
    .eq("user_id", user.id)
    .single();

  if (error || !connection?.access_token) {
    console.error("No Elvanto connection found", error);
    return sampleHousehold;
  }

  try {
    const primaryResult = await searchPeople(connection.access_token, {
      "search[email]": email,
    });

    const primaryPeople: ElvantoPerson[] = primaryResult?.people?.person ?? [];

    const primaryPerson =
      primaryPeople.find(
        (person) => person.family_relationship === "Primary Contact",
      ) ?? primaryPeople[0];

    if (!primaryPerson?.id) return sampleHousehold;

    const detailResult = await getPersonInfoWithFamily(
      connection.access_token,
      primaryPerson.id,
    );

    const detailPerson = detailResult?.person?.[0] ?? primaryPerson;

    const familyMembers: ElvantoFamilyMember[] =
      detailPerson?.family?.family_member ?? [];

    const familyDetails = await Promise.all(
      familyMembers
        .filter((member) => member.id && member.id !== detailPerson.id)
        .map(async (member) => {
          const memberDetail = await getPersonInfo(
            connection.access_token,
            member.id!,
          );

          const personDetail = memberDetail?.person?.[0];

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
      },
      family: familyDetails,
    };
  } catch (error) {
    console.error("Elvanto API error:", error);
    return sampleHousehold;
  }
}

async function searchPeople(
  accessToken: string,
  searchParams: Record<string, string>,
) {
  const response = await fetch(
    "https://api.elvanto.com/v1/people/search.json",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
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

async function getPersonInfoWithFamily(accessToken: string, personId: string) {
  const response = await fetch(
    "https://api.elvanto.com/v1/people/getInfo.json",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: buildGetInfoBody(personId),
      cache: "no-store",
    },
  );

  return response.json();
}

async function getPersonInfo(accessToken: string, personId: string) {
  const response = await fetch(
    "https://api.elvanto.com/v1/people/getInfo.json",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
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
    firstName: person.preferred_name || person.firstname || "",
    lastName: person.lastname || "",
    relationship: person.family_relationship || "Family Member",
    email: person.email || "Not listed",
    phone: person.phone || "Not listed",
    mobile: person.mobile || "Not listed",
    birthday: formatBirthday(person.birthday),
    picture: person.picture,
  };
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

function joinAddress(parts: Array<string | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}
