import { isDemoEmail } from "./demo";

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
  archived_at?: string | null;
  deleted_at?: string | null;
  name?: string;
  sequence?: number;
};

type PcoTeamLeaderAttributes = {
  send_responses_for_accepts?: boolean;
};

type PcoServiceTypeAttributes = {
  name?: string;
};

type PcoItemAttributes = {
  description?: string;
  item_type?: string;
  length?: number;
  sequence?: number;
  service_position?: string;
  title?: string;
};

type PcoPersonAttributes = {
  avatar?: string;
  first_name?: string;
  demographic_avatar_url?: string;
  last_name?: string;
  name?: string;
};

type PcoServicesPersonAttributes = {
  birthdate?: string;
  first_name?: string;
  full_name?: string;
  last_name?: string;
  photo_thumbnail_url?: string;
};

type PcoEmailAttributes = {
  address?: string;
  location?: string;
  primary?: boolean;
};

type PcoPhoneNumberAttributes = {
  location?: string;
  number?: string;
  primary?: boolean;
};

type PcoAddressAttributes = {
  city?: string;
  country_code?: string;
  location?: string;
  primary?: boolean;
  state?: string;
  street_line_1?: string;
  street_line_2?: string;
  zip?: string;
};

export type PlanningCenterContactUpdate = {
  address?: {
    city: string;
    countryCode: string;
    state: string;
    streetLine1: string;
    streetLine2: string;
    zip: string;
  };
  birthdate?: string;
  email?: string;
  firstName: string;
  lastName: string;
  mobile?: string;
  phone?: string;
  pictureFile?: File;
  pictureUrl?: string;
  previousEmail?: string;
};

export type UpcomingAssignment = {
  id: string;
  dates: string;
  detailHref: string;
  planId: string;
  position: string;
  seriesArtUrl?: string;
  serviceTypeId: string;
  serviceTypeName: string;
  sortDate?: string;
  status: string;
  team: string;
  times: string;
};

export type PlanningCenterPersonSearchResult = {
  id: string;
  name: string;
  thumbnail?: string;
};

export type PlanningCenterTeamSummary = {
  href: string;
  id: string;
  leaders: string;
  name: string;
  serviceTypeName?: string;
  teamName?: string;
  type: "Planning Center Team";
};

export type PlanningCenterTeamMember = {
  birthdate: string;
  email: string;
  id: string;
  isLeader: boolean;
  mobile: string;
  name: string;
  picture?: string;
  position: string;
};

export type PlanningCenterTeamDetail = {
  id: string;
  members: PlanningCenterTeamMember[];
  name: string;
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

export type MinisterPlatformAssignment = {
  date: string;
  dateLabel: string;
  id: string;
  name: string;
  planId: string;
  planName: string;
  position: "Minister" | "Platform";
  serviceTypeId: string;
  sortDate: string;
  status: string;
};

export async function getUpcomingAssignments(
  email?: string,
  limit = 3,
): Promise<UpcomingAssignment[]> {
  if (isDemoEmail(email)) return sampleAssignments.slice(0, limit);

  const personId = await getPlanningCenterServicesPersonId(email);

  if (!personId) {
    return shouldUseSampleData() ? sampleAssignments.slice(0, limit) : [];
  }

  return getUpcomingAssignmentsForPersonId(personId, limit);
}

export async function getUpcomingAssignmentsForEmail(
  email?: string,
  limit = 3,
): Promise<UpcomingAssignment[]> {
  if (isDemoEmail(email) || email?.endsWith("@example.com")) {
    return sampleAssignments.slice(0, limit).map((assignment, index) => ({
      ...assignment,
      id: `${assignment.id}-family-${index}`,
      position: index % 2 === 0 ? "Student Check-In" : "Youth Vocals",
      team: index % 2 === 0 ? "Kids Ministry" : "Youth Team",
    }));
  }

  const personId = await getPlanningCenterServicesPersonId(email);

  if (!personId) return [];

  return getUpcomingAssignmentsForPersonId(personId, limit);
}

export async function hasPlanningCenterPersonForEmail(email?: string) {
  if (isDemoEmail(email)) return true;

  const [peoplePersonId, servicesPersonId] = await Promise.all([
    getPlanningCenterPersonId(email),
    getPlanningCenterServicesPersonId(email),
  ]);

  return Boolean(peoplePersonId || servicesPersonId);
}

export async function getUpcomingAssignmentsForPersonId(
  personId: string,
  limit = 25,
): Promise<UpcomingAssignment[]> {
  if (!personId || !hasPlanningCenterCredentials()) return [];

  const response = await pcoFetch<PcoScheduleAttributes>(
    `/services/v2/people/${personId}/schedules`,
    {
      filter: "future",
      include: "plan,plan.art",
      order: "starts_at",
      per_page: String(limit),
    },
  );

  const planResources = normalizeResources<any>(response.included).filter(
    (resource) => resource.type === "Plan",
  );

  const plansById = new Map(
    planResources.map((plan) => [
      plan.id,
      plan.attributes?.title || null,
    ]),
  );

  const seriesArtByPlanId = new Map<string, string>();

  const allIncluded = normalizeResources<any>(response.included);
  for (const plan of planResources) {
    // Try to find art via relationship (art or series_art)
    const artRel =
      getRelationship(plan, "art") || getRelationship(plan, "series_art");
    if (artRel?.id) {
      const artRes = allIncluded.find(
        (r: any) =>
          r.id === artRel.id &&
          (r.type === "Art" ||
            r.type === "Attachment" ||
            /art/i.test(r.type || "")),
      );
      if (artRes) {
        const attrs = artRes.attributes || {};
        const url =
          attrs.thumbnail_url ||
          attrs.url ||
          attrs.download_url ||
          attrs.artwork_url;
        if (url) {
          seriesArtByPlanId.set(plan.id, url);
        }
      }
    }
    // Fallback: direct attributes on plan
    const attrs = plan.attributes || {};
    const directArt =
      attrs.art?.thumbnail_url ||
      attrs.series_art?.thumbnail_url ||
      attrs.series_art?.url ||
      attrs.artwork?.thumbnail_url;
    if (directArt) {
      seriesArtByPlanId.set(plan.id, directArt);
    }
  }

  return normalizeResources(response.data)
    .map(mapSchedule)
    .filter((assignment): assignment is UpcomingAssignment => Boolean(assignment))
    .map((assignment) => {
      const updated: UpcomingAssignment = { ...assignment };
      const planTitle = plansById.get(assignment.planId);
      if (planTitle) {
        updated.serviceTypeName = planTitle;
      }
      const artUrl = seriesArtByPlanId.get(assignment.planId);
      if (artUrl) {
        updated.seriesArtUrl = artUrl;
      }
      return updated;
    });
}

export async function getPlanningCenterPerson(
  personId: string,
): Promise<PlanningCenterPersonSearchResult | null> {
  if (!personId || !hasPlanningCenterCredentials()) return null;

  const response = await pcoFetch<PcoPersonAttributes>(
    `/people/v2/people/${personId}`,
  );
  const person = normalizeResources<PcoPersonAttributes>(response.data)[0];

  return person ? mapPersonSearchResult(person) : null;
}

export async function searchPlanningCenterPeople(
  query: string,
): Promise<PlanningCenterPersonSearchResult[]> {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2 || !hasPlanningCenterCredentials()) return [];

  const response = await pcoFetch<PcoPersonAttributes>("/people/v2/people", {
    "where[search_name]": trimmedQuery,
    order: "name",
    per_page: "10",
  });

  return normalizeResources<PcoPersonAttributes>(response.data).map(
    mapPersonSearchResult,
  );
}

export async function getPlanningCenterTeamsForEmail(
  email?: string,
): Promise<PlanningCenterTeamSummary[]> {
  if (isDemoEmail(email)) return samplePlanningCenterTeams;

  const personId = await getPlanningCenterServicesPersonId(email);

  if (!personId || !hasPlanningCenterCredentials()) return [];

  const { leaderIdsByTeamId, serviceTypeNameById, teams } =
    await getPlanningCenterPersonTeamBundle(personId);
  const summaries = await Promise.all(
    teams.map((team) => {
      const serviceType = getRelationship(team, "service_type");
      const serviceTypeName =
        serviceTypeNameById.get(serviceType?.id ?? "") ?? "Service";

      return mapPlanningCenterMemberTeamSummary(
        team,
        serviceTypeName,
        leaderIdsByTeamId.get(team.id),
      );
    }),
  );

  return summaries.sort(
    (firstTeam, secondTeam) =>
      (firstTeam.serviceTypeName ?? "").localeCompare(
        secondTeam.serviceTypeName ?? "",
      ) || (firstTeam.teamName ?? "").localeCompare(secondTeam.teamName ?? ""),
  );
}

export async function getPlanningCenterLeaderTeamsForEmail(
  email?: string,
): Promise<PlanningCenterTeamSummary[]> {
  if (isDemoEmail(email)) {
    return samplePlanningCenterTeams.filter((team) => team.id === "demo-pco-tech");
  }

  const personId = await getPlanningCenterServicesPersonId(email);

  if (!personId || !hasPlanningCenterCredentials()) return [];

  const { leaderIdsByTeamId, teams } =
    await getPlanningCenterPersonTeamBundle(personId);
  const leaderTeams = await Promise.all(
    teams.map(async (team) => {
      const leaderIds =
        leaderIdsByTeamId.get(team.id) ??
        (await getPlanningCenterTeamLeaderIds(team.id));

      return leaderIds.has(personId)
        ? await mapPlanningCenterTeamSummary(team, leaderIds)
        : null;
    }),
  );

  return leaderTeams
    .filter((team): team is PlanningCenterTeamSummary => Boolean(team))
    .sort((firstTeam, secondTeam) => firstTeam.name.localeCompare(secondTeam.name));
}

export async function getPlanningCenterLeaderTeamDetail(
  teamId: string,
  email?: string,
): Promise<PlanningCenterTeamDetail | null> {
  if (isDemoEmail(email)) {
    return samplePlanningCenterTeamDetails.find((team) => team.id === teamId) ?? null;
  }

  const personId = await getPlanningCenterServicesPersonId(email);

  if (!personId || !hasPlanningCenterCredentials()) return null;

  const [team, leaderIds] = await Promise.all([
    getPlanningCenterTeam(teamId),
    getPlanningCenterTeamLeaderIds(teamId),
  ]);

  if (!team || !leaderIds.has(personId)) return null;

  const members = await getPlanningCenterTeamPeople(teamId);

  return {
    id: team.id,
    members: members
      .map((member) => mapPlanningCenterTeamMember(member, leaderIds))
      .sort((firstMember, secondMember) =>
        firstMember.name.localeCompare(secondMember.name),
      ),
    name: team.attributes?.name ?? "Planning Center Team",
  };
}

export async function getPlanDetail(
  serviceTypeId: string,
  planId: string,
  userEmail?: string,
): Promise<PlanDetail | null> {
  if (isSamplePlan(serviceTypeId, planId) || isDemoEmail(userEmail)) {
    return samplePlanDetail(serviceTypeId, planId);
  }

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
  if (isSamplePlan(serviceTypeId, planId)) {
    return sampleFullTeamsDetail(serviceTypeId, planId);
  }

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
  if (isSamplePlan(serviceTypeId, planId)) {
    return samplePlanOrderDetail(serviceTypeId, planId);
  }

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

export async function getMinisterPlatformSchedule(): Promise<
  MinisterPlatformAssignment[]
> {
  if (!hasPlanningCenterCredentials()) return sampleMinisterPlatformSchedule();

  const serviceTypesResponse =
    await pcoFetch<PcoServiceTypeAttributes>("/services/v2/service_types", {
      per_page: "50",
    });
  const serviceTypes =
    normalizeResources<PcoServiceTypeAttributes>(serviceTypesResponse.data);

  const plansByServiceType = await Promise.all(
    serviceTypes.map(async (serviceType) => {
      const plansResponse = await pcoFetch<PcoPlanAttributes>(
        `/services/v2/service_types/${serviceType.id}/plans`,
        {
          filter: "future",
          order: "sort_date",
          per_page: "12",
        },
      );

      return normalizeResources<PcoPlanAttributes>(plansResponse.data).map(
        (plan) => ({
          plan,
          serviceType,
        }),
      );
    }),
  );
  const upcomingPlans = plansByServiceType
    .flat()
    .sort((firstPlan, secondPlan) =>
      (firstPlan.plan.attributes?.sort_date ?? "").localeCompare(
        secondPlan.plan.attributes?.sort_date ?? "",
      ),
    )
    .slice(0, 40);
  const assignments = await Promise.all(
    upcomingPlans.map(async ({ plan, serviceType }) => {
      const mappedPlan = mapPlan(plan, serviceType.id, plan.id);
      const reportPlan = {
        ...mappedPlan,
        title:
          mappedPlan.title === "Service Plan"
            ? serviceType.attributes?.name ?? mappedPlan.title
            : mappedPlan.title,
      };
      const members = await getPlanTeamMembers(serviceType.id, plan.id);

      return members
        .map((member) =>
          mapMinisterPlatformAssignment(
            member,
            reportPlan,
            plan.attributes?.sort_date,
          ),
        )
        .filter(
          (
            assignment,
          ): assignment is MinisterPlatformAssignment => Boolean(assignment),
        );
    }),
  );

  return assignments
    .flat()
    .sort((firstAssignment, secondAssignment) =>
      firstAssignment.sortDate.localeCompare(secondAssignment.sortDate),
    );
}

export async function syncPlanningCenterContactUpdate(
  update: PlanningCenterContactUpdate,
) {
  const personId = await findPlanningCenterPersonForContact(update);

  if (!personId) {
    return { matched: false };
  }

  const personAttributes: Record<string, string> = {};

  if (update.birthdate) personAttributes.birthdate = update.birthdate;
  if (update.pictureFile && update.pictureFile.size > 0) {
    personAttributes.avatar = await uploadPlanningCenterFile(update.pictureFile);
  } else if (update.pictureUrl) {
    personAttributes.avatar = update.pictureUrl;
  }

  if (Object.keys(personAttributes).length > 0) {
    await pcoJsonApiFetch(`/people/v2/people/${personId}`, "PATCH", {
      type: "Person",
      id: personId,
      attributes: personAttributes,
    });
  }

  if (update.email) {
    await upsertPlanningCenterEmail(personId, update.email);
  }

  if (update.phone) {
    await upsertPlanningCenterPhoneNumber(personId, update.phone, "Home");
  }

  if (update.mobile) {
    await upsertPlanningCenterPhoneNumber(personId, update.mobile, "Mobile");
  }

  if (update.address) {
    await upsertPlanningCenterAddress(personId, update.address);
  }

  return { matched: true };
}

export async function getPlanningCenterProfilePicture(email?: string) {
  if (isDemoEmail(email)) return "https://i.pravatar.cc/160?img=12";

  const personId = await getPlanningCenterPersonId(email);

  if (!personId) return null;

  const response = await pcoFetch<PcoPersonAttributes>(
    `/people/v2/people/${personId}`,
  );
  const person = normalizeResources<PcoPersonAttributes>(response.data)[0];

  return (
    person?.attributes?.demographic_avatar_url ??
    person?.attributes?.avatar ??
    null
  );
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

function isSamplePlan(serviceTypeId: string, planId: string) {
  return serviceTypeId.startsWith("sample") || planId.startsWith("sample");
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

async function getPlanningCenterServicesPersonId(email?: string) {
  if (!email || !hasPlanningCenterCredentials()) return null;

  const lookupEmailSet = new Set(getPlanningCenterLookupEmails(email));
  let offset = 0;
  const perPage = 100;

  while (offset < 1000) {
    const response = await pcoFetch<PcoServicesPersonAttributes>(
      "/services/v2/people",
      {
        include: "emails",
        offset: String(offset),
        per_page: String(perPage),
      },
    );
    const people = normalizeResources<PcoServicesPersonAttributes>(response.data);
    const emailsById = new Map(
      normalizeResources<PcoEmailAttributes>(response.included)
        .filter((resource) => resource.type === "Email")
        .map((resource) => [
          resource.id,
          resource.attributes?.address?.trim().toLowerCase(),
        ]),
    );

    for (const person of people) {
      const emailRelationships = normalizeRelationshipArray(
        person.relationships?.emails?.data,
      );
      const hasMatchingEmail = emailRelationships.some((emailRelationship) => {
        const address = emailsById.get(emailRelationship.id);

        return Boolean(address && lookupEmailSet.has(address));
      });

      if (hasMatchingEmail) {
        return person.id;
      }
    }

    if (people.length < perPage) break;

    offset += perPage;
  }

  return null;
}

async function findPlanningCenterPersonForContact(
  update: PlanningCenterContactUpdate,
) {
  const lookupEmails = [update.previousEmail, update.email].filter(
    (email): email is string => Boolean(email?.trim()),
  );

  for (const email of lookupEmails) {
    const personId = await getPlanningCenterPersonId(email);

    if (personId) return personId;
  }

  if (!hasPlanningCenterCredentials()) return null;

  const searchName = [update.firstName, update.lastName].filter(Boolean).join(" ");

  if (!searchName) return null;

  const response = await pcoFetch("/people/v2/people", {
    "where[search_name]": searchName,
    per_page: "2",
  });
  const people = normalizeResources(response.data);

  return people.length === 1 ? people[0].id : null;
}

async function upsertPlanningCenterEmail(personId: string, email: string) {
  const existingEmail = await getPrimaryPlanningCenterResource<PcoEmailAttributes>(
    `/people/v2/people/${personId}/emails`,
  );
  const attributes = {
    address: email,
    location: "Home",
    primary: true,
  };

  if (existingEmail) {
    await pcoJsonApiFetch(`/people/v2/emails/${existingEmail.id}`, "PATCH", {
      type: "Email",
      id: existingEmail.id,
      attributes,
    });
    return;
  }

  await pcoJsonApiFetch(`/people/v2/people/${personId}/emails`, "POST", {
    type: "Email",
    attributes,
  });
}

async function upsertPlanningCenterPhoneNumber(
  personId: string,
  number: string,
  location: "Home" | "Mobile",
) {
  const phoneNumbers = await getPlanningCenterResources<PcoPhoneNumberAttributes>(
    `/people/v2/people/${personId}/phone_numbers`,
  );
  const existingPhone =
    phoneNumbers.find(
      (phoneNumber) =>
        phoneNumber.attributes?.location?.toLowerCase() === location.toLowerCase(),
    ) ?? (location === "Home" ? findPrimaryResource(phoneNumbers) : undefined);
  const attributes = {
    number,
    location,
    primary: location === "Home",
  };

  if (existingPhone) {
    await pcoJsonApiFetch(
      `/people/v2/phone_numbers/${existingPhone.id}`,
      "PATCH",
      {
        type: "PhoneNumber",
        id: existingPhone.id,
        attributes,
      },
    );
    return;
  }

  await pcoJsonApiFetch(`/people/v2/people/${personId}/phone_numbers`, "POST", {
    type: "PhoneNumber",
    attributes,
  });
}

async function upsertPlanningCenterAddress(
  personId: string,
  address: NonNullable<PlanningCenterContactUpdate["address"]>,
) {
  const existingAddress =
    await getPrimaryPlanningCenterResource<PcoAddressAttributes>(
      `/people/v2/people/${personId}/addresses`,
    );
  const attributes = {
    city: address.city,
    state: address.state,
    zip: address.zip,
    country_code: address.countryCode || "US",
    location: "Home",
    primary: true,
    street_line_1: address.streetLine1,
    street_line_2: address.streetLine2,
  };

  if (existingAddress) {
    await pcoJsonApiFetch(`/people/v2/addresses/${existingAddress.id}`, "PATCH", {
      type: "Address",
      id: existingAddress.id,
      attributes,
    });
    return;
  }

  await pcoJsonApiFetch(`/people/v2/people/${personId}/addresses`, "POST", {
    type: "Address",
    attributes,
  });
}

async function getPrimaryPlanningCenterResource<
  TAttributes extends { primary?: boolean },
>(path: string) {
  const resources = await getPlanningCenterResources<TAttributes>(path);

  return findPrimaryResource(resources);
}

async function getPlanningCenterResources<TAttributes = Record<string, unknown>>(
  path: string,
) {
  const response = await pcoFetch<TAttributes>(path, {
    per_page: "100",
  });

  return normalizeResources<TAttributes>(response.data);
}

async function getPlanningCenterPersonTeamBundle(personId: string) {
  const response = await pcoFetch<PcoTeamAttributes>(
    `/services/v2/people/${personId}/teams`,
    {
      include: "service_type,team_leaders",
      per_page: "100",
    },
  );

  const teamLeaderPersonIdsById = new Map(
    normalizeResources<PcoTeamLeaderAttributes>(response.included)
      .filter((resource) => resource.type === "TeamLeader")
      .map((leader) => [
        leader.id,
        getRelationship(leader, "person")?.id,
      ]),
  );
  const serviceTypeNameById = new Map(
    normalizeResources<PcoServiceTypeAttributes>(response.included)
      .filter((resource) => resource.type === "ServiceType")
      .map((serviceType) => [
        serviceType.id,
        serviceType.attributes?.name ?? "Service",
      ]),
  );
  const teams = normalizeResources<PcoTeamAttributes>(response.data).filter(
    (team) => !team.attributes?.archived_at && !team.attributes?.deleted_at,
  );
  const leaderIdsByTeamId = new Map<string, Set<string>>();

  for (const team of teams) {
    const leaderIds = normalizeRelationshipArray(
      team.relationships?.team_leaders?.data,
    )
      .map((leader) => teamLeaderPersonIdsById.get(leader.id))
      .filter((id): id is string => Boolean(id));

    if (leaderIds.length > 0) {
      leaderIdsByTeamId.set(team.id, new Set(leaderIds));
    }
  }

  return { leaderIdsByTeamId, serviceTypeNameById, teams };
}

async function getPlanningCenterTeam(teamId: string) {
  const response = await pcoFetch<PcoTeamAttributes>(
    `/services/v2/teams/${teamId}`,
  );

  return normalizeResources<PcoTeamAttributes>(response.data)[0] ?? null;
}

async function getPlanningCenterTeamPeople(teamId: string) {
  const response = await pcoFetch<PcoServicesPersonAttributes>(
    `/services/v2/teams/${teamId}/people`,
    {
      per_page: "100",
    },
  );

  return normalizeResources<PcoServicesPersonAttributes>(response.data);
}

async function getPlanningCenterTeamLeaderIds(teamId: string) {
  const response = await pcoFetch(`/services/v2/teams/${teamId}/team_leaders`, {
    per_page: "100",
  });

  return new Set(
    normalizeResources(response.data)
      .map((leader) => getRelationship(leader, "person")?.id)
      .filter((id): id is string => Boolean(id)),
  );
}

async function mapPlanningCenterMemberTeamSummary(
  team: JsonApiResource<PcoTeamAttributes>,
  serviceTypeName: string,
  knownLeaderIds?: Set<string>,
): Promise<PlanningCenterTeamSummary> {
  const leaderIds = knownLeaderIds ?? (await getPlanningCenterTeamLeaderIds(team.id));
  const leaderNames = await getPlanningCenterServicePersonNames(
    Array.from(leaderIds),
  );
  const teamName = team.attributes?.name ?? "Team";
  const serviceType = getRelationship(team, "service_type");

  return {
    href: `/groups/planning-center/${team.id}`,
    id: `${serviceType?.id ?? "service"}-${team.id}`,
    leaders: leaderNames.length > 0 ? leaderNames.join(", ") : "Not listed",
    name: formatPlanningCenterMemberTeamName(serviceTypeName, teamName),
    serviceTypeName,
    teamName,
    type: "Planning Center Team",
  };
}

async function mapPlanningCenterTeamSummary(
  team: JsonApiResource<PcoTeamAttributes>,
  knownLeaderIds?: Set<string>,
): Promise<PlanningCenterTeamSummary> {
  const leaderIds = knownLeaderIds ?? (await getPlanningCenterTeamLeaderIds(team.id));
  const leaderNames = await getPlanningCenterServicePersonNames(
    Array.from(leaderIds),
  );
  const teamName = team.attributes?.name ?? "Planning Center Team";

  return {
    href: `/groups/planning-center/${team.id}`,
    id: team.id,
    leaders: leaderNames.length > 0 ? leaderNames.join(", ") : "Not listed",
    name: teamName,
    teamName,
    type: "Planning Center Team",
  };
}

function formatPlanningCenterMemberTeamName(
  serviceTypeName: string,
  teamName: string,
) {
  return `${serviceTypeName} | ${teamName}`;
}

async function getPlanningCenterServicePersonNames(personIds: string[]) {
  const people = await Promise.all(
    personIds.map(async (personId) => {
      const response = await pcoFetch<PcoServicesPersonAttributes>(
        `/services/v2/people/${personId}`,
      );

      return normalizeResources<PcoServicesPersonAttributes>(response.data)[0];
    }),
  );

  return people
    .map((person) => formatServicesPersonName(person))
    .filter(Boolean)
    .sort((firstName, secondName) => firstName.localeCompare(secondName));
}

function findPrimaryResource<TAttributes extends { primary?: boolean }>(
  resources: Array<JsonApiResource<TAttributes>>,
) {
  return (
    resources.find((resource) => resource.attributes?.primary) ??
    resources[0] ??
    null
  );
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
      filter: "not_deleted",
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

async function pcoJsonApiFetch(
  path: string,
  method: "PATCH" | "POST",
  data: {
    attributes: Record<string, unknown>;
    id?: string;
    type: string;
  },
) {
  const clientId = getPlanningCenterClientId();
  const clientSecret = getPlanningCenterClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error("Planning Center credentials are not configured.");
  }

  const response = await fetch(`https://api.planningcenteronline.com${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString(
        "base64",
      )}`,
      "Content-Type": "application/vnd.api+json",
      "User-Agent":
        process.env.PLANNING_CENTER_USER_AGENT ??
        "Apostolic Life Portal (admin@apostoliclifeupc.com)",
    },
    body: JSON.stringify({ data }),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error(
      `Planning Center API write error ${response.status}: ${await response.text()}`,
    );
    throw new Error("Planning Center contact update failed.");
  }

  return response;
}

async function uploadPlanningCenterFile(file: File) {
  const clientId = getPlanningCenterClientId();
  const clientSecret = getPlanningCenterClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error("Planning Center credentials are not configured.");
  }

  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch("https://upload.planningcenteronline.com/v2/files", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString(
        "base64",
      )}`,
      "User-Agent":
        process.env.PLANNING_CENTER_USER_AGENT ??
        "Apostolic Life Portal (admin@apostoliclifeupc.com)",
    },
    body: formData,
    cache: "no-store",
  });

  const result = (await response.json()) as {
    data?: Array<{
      id?: string;
    }>;
  };
  const fileId = result.data?.[0]?.id;

  if (!response.ok || !fileId) {
    console.error("Planning Center file upload failed:", result);
    throw new Error("Planning Center photo upload failed.");
  }

  return fileId;
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

function mapPersonSearchResult(
  person: JsonApiResource<PcoPersonAttributes>,
): PlanningCenterPersonSearchResult {
  const attributes = person.attributes ?? {};
  const fallbackName = [attributes.first_name, attributes.last_name]
    .filter(Boolean)
    .join(" ");

  return {
    id: person.id,
    name: attributes.name || fallbackName || "Planning Center Person",
    thumbnail: attributes.demographic_avatar_url ?? attributes.avatar,
  };
}

function mapPlanningCenterTeamMember(
  person: JsonApiResource<PcoServicesPersonAttributes>,
  leaderIds: Set<string>,
): PlanningCenterTeamMember {
  return {
    birthdate: formatPlanningCenterBirthday(person.attributes?.birthdate),
    email: "Not listed",
    id: person.id,
    isLeader: leaderIds.has(person.id),
    mobile: "Not listed",
    name: formatServicesPersonName(person) || "Planning Center Person",
    picture: person.attributes?.photo_thumbnail_url,
    position: leaderIds.has(person.id) ? "Leader" : "Member",
  };
}

function formatServicesPersonName(
  person?: JsonApiResource<PcoServicesPersonAttributes>,
) {
  const attributes = person?.attributes;

  if (!attributes) return "";

  return (
    attributes.full_name ||
    [attributes.first_name, attributes.last_name].filter(Boolean).join(" ")
  );
}

function formatPlanningCenterBirthday(birthdate?: string) {
  if (!birthdate) return "Not listed";

  const [year, month, day] = birthdate.split("-").map(Number);

  if (!year || !month || !day) return birthdate;

  const formattedBirthday = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));

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

function mapMinisterPlatformAssignment(
  member: TeamAssignment,
  plan: PlanSummary,
  sortDate?: string,
): MinisterPlatformAssignment | null {
  const isMinister = /minister/i.test(member.position);
  const isPlatform = /platform/i.test(member.teamName);

  if (!isMinister && !isPlatform) return null;

  return {
    date: getDateKey(plan.dates, plan),
    dateLabel: plan.dates,
    id: `${plan.serviceTypeId}-${plan.planId}-${member.id}`,
    name: member.name,
    planId: plan.planId,
    planName: plan.title,
    position: isMinister ? "Minister" : "Platform",
    serviceTypeId: plan.serviceTypeId,
    sortDate: sortDate ?? getPlanSortDate(plan),
    status: member.status,
  };
}

function getPlanSortDate(plan: PlanSummary) {
  const parsedDate = new Date(plan.dates);

  return Number.isNaN(parsedDate.getTime())
    ? plan.dates
    : parsedDate.toISOString();
}

function getDateKey(dateLabel: string, plan: PlanSummary) {
  const parsedDate = new Date(dateLabel);

  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.toISOString().slice(0, 10);
  }

  return `${plan.serviceTypeId}-${plan.planId}`;
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

function normalizeRelationshipArray(
  relationship: JsonApiRelationship["data"] | null | undefined,
) {
  if (!relationship) return [];

  return Array.isArray(relationship) ? relationship : [relationship];
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

const samplePlanningCenterTeams: PlanningCenterTeamSummary[] = [
  {
    href: "/groups/planning-center/demo-pco-tech",
    id: "demo-service-sunday-am-demo-pco-tech",
    leaders: "Daniel Demo, Maria Demo",
    name: "Sunday Worship | Tech Team",
    serviceTypeName: "Sunday Worship",
    teamName: "Tech Team",
    type: "Planning Center Team",
  },
  {
    href: "/groups/planning-center/demo-pco-worship",
    id: "demo-service-sunday-pm-demo-pco-worship",
    leaders: "Avery Johnson",
    name: "Sunday Evening | Worship Team",
    serviceTypeName: "Sunday Evening",
    teamName: "Worship Team",
    type: "Planning Center Team",
  },
];

const samplePlanningCenterTeamDetails: PlanningCenterTeamDetail[] = [
  {
    id: "demo-pco-tech",
    name: "Tech Team",
    members: [
      {
        birthdate: "Jan 14, 1984 (Age 42)",
        email: "demo@apostoliclife.local",
        id: "demo-pco-member-1",
        isLeader: true,
        mobile: "Not listed",
        name: "Daniel Demo",
        picture: "https://i.pravatar.cc/120?img=12",
        position: "Leader",
      },
      {
        birthdate: "Mar 8, 1986 (Age 40)",
        email: "Not listed",
        id: "demo-pco-member-2",
        isLeader: true,
        mobile: "Not listed",
        name: "Maria Demo",
        picture: "https://i.pravatar.cc/120?img=47",
        position: "Leader",
      },
      {
        birthdate: "Not listed",
        email: "Not listed",
        id: "demo-pco-member-3",
        isLeader: false,
        mobile: "Not listed",
        name: "Jordan Carter",
        picture: "https://i.pravatar.cc/120?img=36",
        position: "Member",
      },
    ],
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

function sampleMinisterPlatformSchedule(): MinisterPlatformAssignment[] {
  return [
    {
      date: "2026-06-14",
      dateLabel: "June 14, 2026",
      id: "sample-mp-1",
      name: "Danny Robbins",
      planId: "sample-am",
      planName: "Sunday AM",
      position: "Minister",
      serviceTypeId: "sample-sunday-am",
      sortDate: "2026-06-14T10:00:00.000Z",
      status: "Confirmed",
    },
    {
      date: "2026-06-14",
      dateLabel: "June 14, 2026",
      id: "sample-mp-2",
      name: "Shannon Dillon",
      planId: "sample-am",
      planName: "Sunday AM",
      position: "Platform",
      serviceTypeId: "sample-sunday-am",
      sortDate: "2026-06-14T10:00:00.000Z",
      status: "Confirmed",
    },
    {
      date: "2026-06-14",
      dateLabel: "June 14, 2026",
      id: "sample-mp-3",
      name: "Carl Sheppard",
      planId: "sample-pm",
      planName: "Sunday PM",
      position: "Platform",
      serviceTypeId: "sample-sunday-pm",
      sortDate: "2026-06-14T18:00:00.000Z",
      status: "Unconfirmed",
    },
    {
      date: "2026-06-21",
      dateLabel: "June 21, 2026",
      id: "sample-mp-4",
      name: "James McChristian",
      planId: "sample-am-2",
      planName: "Sunday AM",
      position: "Platform",
      serviceTypeId: "sample-sunday-am",
      sortDate: "2026-06-21T10:00:00.000Z",
      status: "Declined",
    },
  ];
}
