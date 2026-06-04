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
    const searchUrl = new URL(
      "https://api.elvanto.com/v1/people/search.json"
    );

    searchUrl.searchParams.set("search", email);

    const response = await fetch(searchUrl.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
      },
      cache: "no-store",
    });

    const data = await response.json();

    console.log(
      "Elvanto people search result:",
      JSON.stringify(data, null, 2)
    );

    // We are only testing connectivity right now.
    // Once we see a successful response, we'll map
    // the real Elvanto fields into the household model.

    return sampleHousehold;
  } catch (error) {
    console.error("Elvanto API error:", error);
    return sampleHousehold;
  }
}
