type JsonApiRelationship = {
  data?: { id: string; type: string } | Array<{ id: string; type: string }> | null;
};

type JsonApiResource<TAttributes = Record<string, unknown>> = {
  id: string;
  type: string;
  attributes?: TAttributes;
  relationships?: Record<string, JsonApiRelationship>;
};

type JsonApiResponse<TAttributes = Record<string, unknown>> = {
  data?: JsonApiResource<TAttributes> | Array<JsonApiResource<TAttributes>>;
  included?: Array<JsonApiResource>;
};

type PcoScheduleAttributes = {
  dates?: string;
  organization_name?: string;
  position_display_times?: string;
  service_type_name?: string;
  short_dates?: string;
  sort_date?: string;
  status?: string;
  team_name?: string;
  team_position_name?: string;
};

type PcoPlanAttributes = {
  can_view_order?: boolean;
  dates?: string;
  items_count?: number;
  last_time_at?: string;
  planning_center_url?: string;
  series_title?: string;
  short_dates?: string;
  sort_date?: string;
  title?: string;
  total_length?: number;
};

type PcoTeamMemberAttributes = {
  name?: string;
  photo_thumbnail?: string;
  status?: string;
  team_position_name?: string;
};

type PcoTeamAttributes = {
  name?: string;
  sequence?: number;
};

type PcoItemAttributes = {
  description?: string;
  item_type?: string;
  length?: number;
  sequence?: number;
  service_position?: string;
  title?: string;
};

export type UpcomingAssignment = {
  id: string;
  dates: string;
  detailHref: string;
  planId: string;
  position: string;
  serviceTypeId: string;
  serviceTypeName: string;
  sortDate?: string;
  status: string;
  team: string;
  times: string;
};

export type PlanSummary = {
  canViewOrder: boolean;
  dates: string;
  orderHref: string;
  planningCenterUrl?: string;
  seriesTitle?: string;
  serviceTypeId: string;
  planId: string;
  teamsHref: string;
  title: string;
  totalLength: string;
};

export type TeamAssignment = {
  id: string;
  name: string;
  photoThumbnail?: string;
  position: string;
  status: string;
  teamId?: string;
  teamName: string;
};

export type PlanOrderItem = {
  id: string;
  description?: string;
  length: string;
  servicePosition?: string;
  title: string;
  type: string;
};

export type PlanDetail = {
  assignment?: UpcomingAssignment;
  myTeamName?: string;
  plan: PlanSummary;
  teamMembers: TeamAssignment[];
};

export type FullTeamsDetail = {
  plan: PlanSummary;
  teams: Array<{
    id: string;
    name: string;
    members: TeamAssignment[];
  }>;
};

export type PlanOrderDetail = {
  items: PlanOrderItem[];
  plan: PlanSummary;
};

export async function getUpcomingAssignments(
  email?: string,
): Promise<UpcomingAssignment[]> {
  const personId = await getPlanningCenterPersonId(email);

  if (!personId) return shouldUseSampleData() ? sampleAssignments : [];

  const response = await pcoFetch<PcoScheduleAttributes>(
    `/services/v2/people/${personId}/schedules`,
    {
      filter: "future",
      order: "starts_at",
      per_page: "3",
    },
  );

  return normalizeResources(response.data)
    .map(mapSchedule)
    .filter((assignment): assignment is UpcomingAssignment => Boolean(assignment));
}

export async function getPlanDetail(
  serviceTypeId: string,
  planId: string,
  userEmail?: string,
): Promise<PlanDetail | null> {
  const [plan, assignments] = await Promise.all([
    getPlanSummary(serviceTypeId, planId),
    getUpcomingAssignments(userEmail),
  ]);

  if (!plan) {
    return shouldUseSampleData() ? samplePlanDetail(serviceTypeId, planId) : null;
  }

  const assignment = assignments.find(
    (item) =>
      item.planId === planId && item.serviceTypeId === serviceTypeId,
  );

  const allTeamMembers = await getPlanTeamMembers(serviceTypeId, planId);
  const teamMembers = assignment?.team
    ? allTeamMembers.filter((member) => member.teamName === assignment.team)
    : allTeamMembers;

  return {
    assignment,
    myTeamName: assignment?.team,
    plan,
    teamMembers,
  };
}

export async function getFullTeamsDetail(
  serviceTypeId: string,
  planId: string,
): Promise<FullTeamsDetail | null> {
  const plan = await getPlanSummary(serviceTypeId, planId);

  if (!plan) {
    return shouldUseSampleData()
      ? sampleFullTeamsDetail(serviceTypeId, planId)
      : null;
  }

  const members = await getPlanTeamMembers(serviceTypeId, planId);
  const groupedMembers = new Map<string, TeamAssignment[]>();

  for (const member of members) {
    groupedMembers.set(member.teamName, [
      ...(groupedMembers.get(member.teamName) ?? []),
      member,
    ]);
  }

  return {
    plan,
    teams: Array.from(groupedMembers.entries()).map(([name, teamMembers]) => ({
      id: name.toLowerCase().replaceAll(/\s+/g, "-"),
      name,
      members: teamMembers,
    })),
  };
}

export async function getPlanOrderDetail(
  serviceTypeId: string,
  planId: string,
): Promise<PlanOrderDetail | null> {
  const plan = await getPlanSummary(serviceTypeId, planId);

  if (!plan) {
    return shouldUseSampleData()
      ? samplePlanOrderDetail(serviceTypeId, planId)
      : null;
  }

  const response = await pcoFetch<PcoItemAttributes>(
    `/services/v2/service_types/${serviceTypeId}/plans/${planId}/items`,
    {
      order: "sequence",
      per_page: "100",
    },
  );

  return {
    plan,
    items: normalizeResources(response.data).map(mapOrderItem),
  };
}

function hasPlanningCenterCredentials() {
  return Boolean(getPlanningCenterClientId() && getPlanningCenterClientSecret());
}

function shouldUseSampleData() {
  return (
    process.env.PLANNING_CENTER_USE_SAMPLE_DATA === "true" ||
    process.env.NODE_ENV !== "production"
  );
}

async function getPlanningCenterPersonId(email?: string) {
  if (!email || !hasPlanningCenterCredentials()) return null;

  for (const lookupEmail of getPlanningCenterLookupEmails(email)) {
    const response = await pcoFetch("/people/v2/emails", {
      "where[address]": lookupEmail,
      per_page: "1",
    });

    const emailRecord = normalizeResources(response.data)[0];
    const person = getRelationship(emailRecord, "person");

    if (person?.id) return person.id;
  }

  return null;
}

function getPlanningCenterLookupEmails(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const mappedEmail = getPlanningCenterEmailAliases().get(normalizedEmail);
  const emails = mappedEmail
    ? [normalizedEmail, mappedEmail.trim().toLowerCase()]
    : [normalizedEmail];

  return Array.from(new Set(emails));
}

function getPlanningCenterEmailAliases() {
  const aliases = new Map<string, string>();
  const rawAliases = process.env.PLANNING_CENTER_EMAIL_ALIASES;

  if (!rawAliases) return aliases;

  for (const pair of rawAliases.split(",")) {
    const [portalEmail, planningCenterEmail] = pair
      .split("=")
      .map((value) => value.trim().toLowerCase());

    if (portalEmail && planningCenterEmail) {
      aliases.set(portalEmail, planningCenterEmail);
    }
  }

  return aliases;
}

async function getPlanSummary(serviceTypeId: string, planId: string) {
  if (!hasPlanningCenterCredentials()) return null;

  const response = await pcoFetch<PcoPlanAttributes>(
    `/services/v2/service_types/${serviceTypeId}/plans/${planId}`,
  );
  const plan = normalizeResources<PcoPlanAttributes>(response.data)[0];

  if (!plan) return null;

  return mapPlan(plan, serviceTypeId, planId);
}

async function getPlanTeamMembers(serviceTypeId: string, planId: string) {
  const response = await pcoFetch<PcoTeamMemberAttributes>(
    `/services/v2/service_types/${serviceTypeId}/plans/${planId}/team_members`,
    {
      include: "team",
      filter: "not_declined",
      per_page: "100",
    },
  );

  const includedTeams = normalizeResources<PcoTeamAttributes>(response.included);
  const teamNameById = new Map(
    includedTeams
      .filter((resource) => resource.type === "Team")
      .map((team) => [team.id, team.attributes?.name ?? "Team"]),
  );

  return normalizeResources<PcoTeamMemberAttributes>(response.data).map(
    (member) => mapTeamMember(member, teamNameById),
  );
}

async function pcoFetch<TAttributes = Record<string, unknown>>(
  path: string,
  searchParams?: Record<string, string>,
) {
  const clientId = getPlanningCenterClientId();
  const clientSecret = getPlanningCenterClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error("Planning Center credentials are not configured.");
  }

  const url = new URL(`https://api.planningcenteronline.com${path}`);

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString(
        "base64",
      )}`,
      "User-Agent":
        process.env.PLANNING_CENTER_USER_AGENT ??
        "Apostolic Life Portal (admin@apostoliclifeupc.com)",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    console.error(
      `Planning Center API error ${response.status}: ${await response.text()}`,
    );
    return {};
  }

  return (await response.json()) as JsonApiResponse<TAttributes>;
}

function getPlanningCenterClientId() {
  return process.env.PLANNING_CENTER_CLIENT_ID ?? process.env.PCO_CLIENT_ID;
}

function getPlanningCenterClientSecret() {
  return (
    process.env.PLANNING_CENTER_CLIENT_SECRET ?? process.env.PCO_CLIENT_SECRET
  );
}

function mapSchedule(
  schedule: JsonApiResource<PcoScheduleAttributes>,
): UpcomingAssignment | null {
  const plan = getRelationship(schedule, "plan");
  const serviceType = getRelationship(schedule, "service_type");

  if (!plan?.id || !serviceType?.id) return null;

  const attributes = schedule.attributes ?? {};

  return {
    id: schedule.id,
    dates: attributes.short_dates ?? attributes.dates ?? "Upcoming",
    detailHref: `/schedule/${serviceType.id}/${plan.id}`,
    planId: plan.id,
    position: attributes.team_position_name ?? "Scheduled",
    serviceTypeId: serviceType.id,
    serviceTypeName: attributes.service_type_name ?? "Service",
    sortDate: attributes.sort_date,
    status: formatStatus(attributes.status),
    team: attributes.team_name ?? "Team",
    times: attributes.position_display_times ?? "Time not listed",
  };
}

function mapPlan(
  plan: JsonApiResource<PcoPlanAttributes>,
  serviceTypeId: string,
  planId: string,
): PlanSummary {
  const attributes = plan.attributes ?? {};

  return {
    canViewOrder: attributes.can_view_order ?? true,
    dates: attributes.dates ?? attributes.short_dates ?? "Service date",
    orderHref: `/schedule/${serviceTypeId}/${planId}/order`,
    planningCenterUrl: attributes.planning_center_url,
    seriesTitle: attributes.series_title,
    serviceTypeId,
    planId,
    teamsHref: `/schedule/${serviceTypeId}/${planId}/teams`,
    title: attributes.title || attributes.series_title || "Service Plan",
    totalLength: formatDuration(attributes.total_length),
  };
}

function mapTeamMember(
  member: JsonApiResource<PcoTeamMemberAttributes>,
  teamNameById: Map<string, string>,
): TeamAssignment {
  const attributes = member.attributes ?? {};
  const team = getRelationship(member, "team");

  return {
    id: member.id,
    name: attributes.name ?? "Scheduled Person",
    photoThumbnail: attributes.photo_thumbnail,
    position: attributes.team_position_name ?? "Team Member",
    status: formatStatus(attributes.status),
    teamId: team?.id,
    teamName: (team?.id && teamNameById.get(team.id)) || "Team",
  };
}

function mapOrderItem(item: JsonApiResource<PcoItemAttributes>): PlanOrderItem {
  const attributes = item.attributes ?? {};

  return {
    id: item.id,
    description: stripHtml(attributes.description),
    length: formatDuration(attributes.length),
    servicePosition: attributes.service_position,
    title: attributes.title || "Untitled item",
    type: formatItemType(attributes.item_type),
  };
}

function normalizeResources<TAttributes>(
  value:
    | JsonApiResource<TAttributes>
    | Array<JsonApiResource<TAttributes>>
    | null
    | undefined,
) {
  if (!value) return [];

  return Array.isArray(value) ? value : [value];
}

function getRelationship(resource: JsonApiResource | undefined, name: string) {
  const data = resource?.relationships?.[name]?.data;

  if (!data || Array.isArray(data)) return null;

  return data;
}

function formatStatus(status?: string) {
  if (!status) return "Unconfirmed";
  if (status === "C") return "Confirmed";
  if (status === "D") return "Declined";
  if (status === "U") return "Unconfirmed";

  return status;
}

function formatItemType(type?: string) {
  if (!type) return "Item";

  return type
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDuration(seconds?: number) {
  if (!seconds) return "Not timed";

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

function stripHtml(value?: string) {
  return value?.replace(/<[^>]*>/g, "").trim();
}

const sampleAssignments: UpcomingAssignment[] = [
  {
    id: "sample-1",
    dates: "Jun 9",
    detailHref: "/schedule/sample-service/sample-plan",
    planId: "sample-plan",
    position: "Keys",
    serviceTypeId: "sample-service",
    serviceTypeName: "Sunday Worship",
    status: "Confirmed",
    team: "Worship Team",
    times: "9:00 AM Rehearsal, 10:30 AM Service",
  },
  {
    id: "sample-2",
    dates: "Jun 16",
    detailHref: "/schedule/sample-service/sample-plan",
    planId: "sample-plan",
    position: "Vocals",
    serviceTypeId: "sample-service",
    serviceTypeName: "Sunday Worship",
    status: "Unconfirmed",
    team: "Worship Team",
    times: "9:00 AM Rehearsal, 10:30 AM Service",
  },
  {
    id: "sample-3",
    dates: "Jun 23",
    detailHref: "/schedule/sample-service/sample-plan",
    planId: "sample-plan",
    position: "Slides",
    serviceTypeId: "sample-service",
    serviceTypeName: "Sunday Worship",
    status: "Confirmed",
    team: "Production Team",
    times: "10:00 AM Call, 10:30 AM Service",
  },
];

function samplePlan(serviceTypeId: string, planId: string): PlanSummary {
  return {
    canViewOrder: true,
    dates: "Sunday, June 9, 2026",
    orderHref: `/schedule/${serviceTypeId}/${planId}/order`,
    seriesTitle: "Living Faith",
    serviceTypeId,
    planId,
    teamsHref: `/schedule/${serviceTypeId}/${planId}/teams`,
    title: "Sunday Worship",
    totalLength: "1 hr 20 min",
  };
}

function samplePlanDetail(serviceTypeId: string, planId: string): PlanDetail {
  return {
    assignment: sampleAssignments[0],
    myTeamName: "Worship Team",
    plan: samplePlan(serviceTypeId, planId),
    teamMembers: [
      {
        id: "sample-member-1",
        name: "Avery Johnson",
        position: "Worship Leader",
        status: "Confirmed",
        teamName: "Worship Team",
      },
      {
        id: "sample-member-2",
        name: "Morgan Lee",
        position: "Acoustic Guitar",
        status: "Confirmed",
        teamName: "Worship Team",
      },
      {
        id: "sample-member-3",
        name: "Taylor Smith",
        position: "Keys",
        status: "Unconfirmed",
        teamName: "Worship Team",
      },
    ],
  };
}

function sampleFullTeamsDetail(
  serviceTypeId: string,
  planId: string,
): FullTeamsDetail {
  return {
    plan: samplePlan(serviceTypeId, planId),
    teams: [
      {
        id: "worship-team",
        name: "Worship Team",
        members: samplePlanDetail(serviceTypeId, planId).teamMembers,
      },
      {
        id: "production-team",
        name: "Production Team",
        members: [
          {
            id: "sample-member-4",
            name: "Jordan Carter",
            position: "Sound",
            status: "Confirmed",
            teamName: "Production Team",
          },
          {
            id: "sample-member-5",
            name: "Riley Thomas",
            position: "Slides",
            status: "Confirmed",
            teamName: "Production Team",
          },
        ],
      },
    ],
  };
}

function samplePlanOrderDetail(
  serviceTypeId: string,
  planId: string,
): PlanOrderDetail {
  return {
    plan: samplePlan(serviceTypeId, planId),
    items: [
      {
        id: "sample-item-1",
        length: "5 min",
        title: "Pre-Service Prayer",
        type: "Item",
      },
      {
        id: "sample-item-2",
        length: "18 min",
        servicePosition: "Service",
        title: "Worship Set",
        type: "Song",
      },
      {
        id: "sample-item-3",
        description: "Pastor's message",
        length: "40 min",
        servicePosition: "Service",
        title: "Sermon",
        type: "Item",
      },
    ],
  };
}
