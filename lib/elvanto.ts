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
  family_relationship?: string;
  family_id?: string;
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
};

type Household = {
  primary: HouseholdPerson & {
    address: string;
  };
  family: HouseholdPerson[];
};

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
        address: "Address not listed",
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
      body: new URLSearchParams({
        id: personId,
        "fields[0]": "family",
      }),
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
      body: new URLSearchParams({
        id: personId,
      }),
      cache: "no-store",
    },
  );

  return response.json();
}

function mapElvantoPerson(person: Partial<ElvantoPerson>): HouseholdPerson {
  return {
    firstName: person.preferred_name || person.firstname || "",
    lastName: person.lastname || "",
    relationship: person.family_relationship || "Family Member",
    email: person.email || "Not listed",
    phone: person.mobile || person.phone || "Not listed",
  };
}