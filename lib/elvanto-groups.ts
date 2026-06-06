import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ElvantoGroupPerson = {
  id?: string;
  firstname?: string;
  preferred_name?: string;
  lastname?: string;
  email?: string;
  mobile?: string;
  birthday?: string;
  position?: string;
};

type ElvantoGroup = {
  id?: string;
  name?: string;
  people?: {
    person?: ElvantoGroupPerson | ElvantoGroupPerson[];
  };
};

type ElvantoPerson = {
  id?: string;
  firstname?: string;
  preferred_name?: string;
  lastname?: string;
  email?: string;
  mobile?: string;
  birthday?: string;
};

export type LeaderGroup = {
  id: string;
  name: string;
  position: "Leader";
};

export type GroupMember = {
  id: string;
  name: string;
  birthdate: string;
  mobile: string;
  email: string;
  position: string;
  isLeader: boolean;
};

export type GroupDetail = {
  id: string;
  name: string;
  members: GroupMember[];
};

export type PersonSearchResult = {
  id: string;
  name: string;
  email: string;
  mobile: string;
};

export async function getLeaderGroupsForEmail(email?: string) {
  if (!email) return [];

  const authorization = getElvantoAuthorization();

  if (!authorization) return [];

  const matchedPeople = await getPeopleByEmail(authorization, email);
  const matchedPersonIds = new Set(matchedPeople.map((person) => person.id));

  if (matchedPersonIds.size === 0) return [];

  const groups = await getAllGroupsWithPeople(authorization);
  const leaderGroups = new Map<string, LeaderGroup>();

  for (const group of groups) {
    if (!group.id || !group.name) continue;

    const members = normalizeArray(group.people?.person);
    const isLeader = members.some(
      (person) =>
        person.id &&
        matchedPersonIds.has(person.id) &&
        isLeaderPosition(person.position),
    );

    if (isLeader) {
      leaderGroups.set(group.id, {
        id: group.id,
        name: group.name,
        position: "Leader",
      });
    }
  }

  return Array.from(leaderGroups.values()).sort((firstGroup, secondGroup) =>
    firstGroup.name.localeCompare(secondGroup.name),
  );
}

export async function getLeaderGroupDetail(
  groupId: string,
  email?: string,
): Promise<GroupDetail | null> {
  if (!email) return null;

  const leaderGroups = await getLeaderGroupsForEmail(email);
  const canAccessGroup = leaderGroups.some((group) => group.id === groupId);

  if (!canAccessGroup) return null;

  const authorization = getElvantoAuthorization();

  if (!authorization) return null;

  const group = await getGroupInfo(authorization, groupId);

  if (!group?.id || !group.name) return null;

  const members = await Promise.all(
    dedupePeople(normalizeArray(group.people?.person)).map(async (person) => {
      const detail = person.id
        ? await getPersonInfo(authorization, person.id)
        : null;

      return mapGroupMember({
        ...person,
        ...detail,
        position: person.position,
      });
    }),
  );

  return {
    id: group.id,
    name: group.name,
    members: members.sort((firstMember, secondMember) =>
      firstMember.name.localeCompare(secondMember.name),
    ),
  };
}

export async function searchPeopleForGroup(query: string, email?: string) {
  if (!email || query.trim().length < 2) return [];

  const authorization = getElvantoAuthorization();

  if (!authorization) return [];

  const people = await getAllPeople(authorization);
  const normalizedQuery = query.trim().toLowerCase();

  return people
    .filter((person) => {
      const haystack = [
        person.firstname,
        person.preferred_name,
        person.lastname,
        person.email,
        person.mobile,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    })
    .slice(0, 12)
    .map(mapPersonSearchResult);
}

export async function addPersonToGroup(formData: FormData) {
  "use server";

  const groupId = String(formData.get("groupId") || "");
  const personId = String(formData.get("personId") || "");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const leaderGroups = await getLeaderGroupsForEmail(user.email ?? undefined);
  const canEditGroup = leaderGroups.some((group) => group.id === groupId);

  if (!canEditGroup) throw new Error("You do not lead this group.");

  const authorization = getElvantoAuthorization();

  if (!authorization) throw new Error("Elvanto is not configured.");

  await postElvanto(authorization, "groups/addPerson.json", {
    id: groupId,
    person_id: personId,
  });

  revalidatePath(`/groups/${groupId}`);
}

export async function removePersonFromGroup(formData: FormData) {
  "use server";

  const groupId = String(formData.get("groupId") || "");
  const personId = String(formData.get("personId") || "");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const leaderGroups = await getLeaderGroupsForEmail(user.email ?? undefined);
  const canEditGroup = leaderGroups.some((group) => group.id === groupId);

  if (!canEditGroup) throw new Error("You do not lead this group.");

  const authorization = getElvantoAuthorization();

  if (!authorization) throw new Error("Elvanto is not configured.");

  await postElvanto(authorization, "groups/removePerson.json", {
    id: groupId,
    person_id: personId,
  });

  revalidatePath(`/groups/${groupId}`);
}

export async function updateGroupMemberLeader(formData: FormData) {
  "use server";

  const groupId = String(formData.get("groupId") || "");
  const personId = String(formData.get("personId") || "");
  const makeLeader = formData.get("makeLeader") === "true";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const leaderGroups = await getLeaderGroupsForEmail(user.email ?? undefined);
  const canEditGroup = leaderGroups.some((group) => group.id === groupId);

  if (!canEditGroup) throw new Error("You do not lead this group.");

  const authorization = getElvantoAuthorization();

  if (!authorization) throw new Error("Elvanto is not configured.");

  const body: Record<string, string> = {
    id: groupId,
    person_id: personId,
  };

  if (makeLeader) {
    body.position = "Leader";
  }

  await postElvanto(authorization, "groups/addPerson.json", body);

  revalidatePath(`/groups/${groupId}`);
}

function getElvantoAuthorization() {
  const apiKey = process.env.ELVANTO_API_KEY;

  if (!apiKey) {
    console.error("ELVANTO_API_KEY is not configured.");
    return null;
  }

  return `Basic ${Buffer.from(`${apiKey}:x`).toString("base64")}`;
}

async function getPeopleByEmail(authorization: string, email: string) {
  const result = await postElvanto(authorization, "people/search.json", {
    page: "1",
    page_size: "20",
    "search[email]": email,
  });

  return normalizeArray<ElvantoPerson>(result?.people?.person);
}

async function getAllGroupsWithPeople(authorization: string) {
  const result = await postElvanto(authorization, "groups/getAll.json", {
    page: "1",
    page_size: "1000",
    "fields[0]": "people",
  });

  return normalizeArray<ElvantoGroup>(result?.groups?.group);
}

async function getGroupInfo(authorization: string, groupId: string) {
  const result = await postElvanto(authorization, "groups/getInfo.json", {
    id: groupId,
    "fields[0]": "people",
  });

  return normalizeArray<ElvantoGroup>(result?.group)[0] ?? null;
}

async function getPersonInfo(authorization: string, personId: string) {
  const result = await postElvanto(authorization, "people/getInfo.json", {
    id: personId,
    "fields[0]": "birthday",
  });

  return normalizeArray<ElvantoPerson>(result?.person)[0] ?? null;
}

async function getAllPeople(authorization: string) {
  const result = await postElvanto(authorization, "people/getAll.json", {
    page: "1",
    page_size: "1000",
    "fields[0]": "birthday",
  });

  return normalizeArray<ElvantoPerson>(result?.people?.person);
}

async function postElvanto(
  authorization: string,
  path: string,
  body: Record<string, string>,
) {
  const response = await fetch(`https://api.elvanto.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
    cache: "no-store",
  });

  const text = await response.text();
  const result = text ? JSON.parse(text) : {};

  if (!response.ok || result?.status === "error" || result?.error) {
    console.error(`Elvanto ${path} failed:`, result);
    throw new Error("Elvanto group request failed.");
  }

  return result;
}

function mapGroupMember(person: Partial<ElvantoGroupPerson>): GroupMember {
  const position = person.position || "Member";

  return {
    id: person.id ?? "",
    name: formatName(person),
    birthdate: formatBirthday(person.birthday),
    mobile: person.mobile || "Not listed",
    email: person.email || "Not listed",
    position,
    isLeader: isLeaderPosition(position),
  };
}

function mapPersonSearchResult(person: ElvantoPerson): PersonSearchResult {
  return {
    id: person.id ?? "",
    name: formatName(person),
    email: person.email || "Not listed",
    mobile: person.mobile || "Not listed",
  };
}

function formatName(person: Partial<ElvantoPerson | ElvantoGroupPerson>) {
  return [person.preferred_name || person.firstname, person.lastname]
    .filter(Boolean)
    .join(" ");
}

function formatBirthday(birthday?: string) {
  if (!birthday) return "Not listed";

  const [year, month, day] = birthday.split("-").map(Number);

  if (!year || !month || !day) return birthday;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function isLeaderPosition(position?: string) {
  return position?.toLowerCase() === "leader";
}

function dedupePeople(people: ElvantoGroupPerson[]) {
  const dedupedPeople = new Map<string, ElvantoGroupPerson>();

  for (const person of people) {
    const key = person.id || `${person.firstname}-${person.lastname}-${person.email}`;

    if (!dedupedPeople.has(key)) dedupedPeople.set(key, person);
  }

  return Array.from(dedupedPeople.values());
}

function normalizeArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];

  return Array.isArray(value) ? value : [value];
}
