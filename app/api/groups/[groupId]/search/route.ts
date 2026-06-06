import { NextResponse } from "next/server";
import {
  getLeaderGroupsForEmail,
  searchPeopleForGroup,
} from "@/lib/elvanto-groups";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    groupId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { groupId } = await context.params;
  const requestUrl = new URL(request.url);
  const query = requestUrl.searchParams.get("q") ?? "";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ people: [] }, { status: 401 });
  }

  const leaderGroups = await getLeaderGroupsForEmail(user.email ?? undefined);
  const canEditGroup = leaderGroups.some((group) => group.id === groupId);

  if (!canEditGroup) {
    return NextResponse.json({ people: [] }, { status: 403 });
  }

  const people = await searchPeopleForGroup(query, user.email ?? undefined);

  return NextResponse.json({ people });
}
