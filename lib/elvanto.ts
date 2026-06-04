import { createClient } from "@/lib/supabase/server";
import { sampleHousehold } from "./sample-household";

type ElvantoPerson = {
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
  if (!email) {
    return sampleHousehold;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return sampleHousehold;
  }

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
    const response = await fetch(
      "https://api.elvanto.com/v1/people/search.json",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          page: "1",
          page_size: "10",
          "search[email]": email,
        }),
        cache: "no-store",
      },
    );

    const data = await response.json();

    console.log(
      "Elvanto people search result:",
      JSON.stringify(data, null, 2),
    );

    const people: ElvantoPerson[] = data?.people?.person ?? [];

    if (!people.length) {
      return sampleHousehold;
    }

    const primaryPerson =
      people.find((person) => person.family_relationship !== "Child") ??
      people[0];

    const family = people
      .filter((person) => person !== primaryPerson)
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

function mapElvantoPerson(person: ElvantoPerson): HouseholdPerson {
  return {
    firstName: person.preferred_name || person.firstname || "",
    lastName: person.lastname || "",
    relationship: person.family_relationship || "Family Member",
    email: person.email || "Not listed",
    phone: person.mobile || person.phone || "Not listed",
  };
}
