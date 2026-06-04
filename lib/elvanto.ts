import { createClient } from "@/lib/supabase/server";
import { sampleHousehold } from "./sample-household";

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
          "fields[0]": "family_id",
          "fields[1]": "family_relationship",
        }),
        cache: "no-store",
      },
    );

    const data = await response.json();

    console.log(
      "Elvanto people search result:",
      JSON.stringify(data, null, 2),
    );

    return sampleHousehold;
  } catch (error) {
    console.error("Elvanto API error:", error);
    return sampleHousehold;
  }
}
