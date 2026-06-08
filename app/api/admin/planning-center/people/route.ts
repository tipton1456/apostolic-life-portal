import { NextResponse } from "next/server";
import { isCurrentUserPortalAdmin } from "@/lib/portal-users";
import { searchPlanningCenterPeople } from "@/lib/planning-center";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ people: [] }, { status: 401 });
  }

  const isAdmin = await isCurrentUserPortalAdmin();

  if (!isAdmin) {
    return NextResponse.json({ people: [] }, { status: 403 });
  }

  const requestUrl = new URL(request.url);
  const query = requestUrl.searchParams.get("q") ?? "";
  const people = await searchPlanningCenterPeople(query);

  return NextResponse.json({ people });
}
