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

    console.log(
      "Elvanto primary search result:",
      JSON.stringify(primaryResult, null, 2),
    );

    const primaryPeople: ElvantoPerson[] =
      primaryResult?.people?.person ?? [];

    const primaryPerson =
      primaryPeople.find(
        (person) => person.family_relationship === "Primary Contact",
      ) ?? primaryPeople[0];

    if (!primaryPerson) return sampleHousehold;

    let householdPeople: ElvantoPerson[] = [primaryPerson];

    if (primaryPerson.family_id) {
      const familyResult = await searchPeople(connection.access_token, {
        "search[family_id]": primaryPerson.family_id,
      });

      console.log(
        "Elvanto family search result:",
        JSON.stringify(familyResult, null, 2),
      );

      householdPeople = familyResult?.people?.person ?? [primaryPerson];
    }

    const family = householdPeople
      .filter((person) => person.id !== primaryPerson.id)
      .map(mapElvantoPerson);

    return {
      primary: {
        ...mapElvantoPerson(primaryPerson),
        address: "Address not listed",
      },
      family,
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

function mapElvantoPerson(person: ElvantoPerson): HouseholdPerson {
  return {
    firstName: person.preferred_name || person.firstname || "",
    lastName: person.lastname || "",
    relationship: person.family_relationship || "Family Member",
    email: person.email || "Not listed",
    phone: person.mobile || person.phone || "Not listed",
  };
}