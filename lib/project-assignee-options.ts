export type AssigneeOption = {
  value: string;
  label: string;
};

export type AssigneePerson = {
  id: string;
  fullName: string;
};

export function buildManagerTaskAssigneeOptions({
  members,
  managers,
  portalParticipants,
}: {
  members: Array<{ userId: string; fullName: string }>;
  managers: AssigneePerson[];
  portalParticipants: AssigneePerson[];
}): AssigneeOption[] {
  const options = new Map<string, string>([["", "Unassigned"]]);

  for (const member of members) {
    options.set(member.userId, member.fullName);
  }

  for (const manager of managers) {
    if (!options.has(manager.id)) {
      options.set(manager.id, `${manager.fullName} (Project Manager)`);
    }
  }

  for (const participant of portalParticipants) {
    if (!options.has(participant.id)) {
      options.set(participant.id, `${participant.fullName} (Portal Participant)`);
    }
  }

  return Array.from(options.entries()).map(([value, label]) => ({ value, label }));
}

export function buildParticipantHandoffOptions({
  currentUserId,
  members,
  managers,
  portalParticipants,
}: {
  currentUserId: string;
  members: Array<{ userId: string; fullName: string }>;
  managers: AssigneePerson[];
  portalParticipants: AssigneePerson[];
}): AssigneeOption[] {
  const options = new Map<string, string>([[currentUserId, "Keep assigned to me"]]);

  for (const manager of managers) {
    if (manager.id !== currentUserId && !options.has(manager.id)) {
      options.set(manager.id, `${manager.fullName} (Project Manager)`);
    }
  }

  for (const member of members) {
    if (member.userId !== currentUserId && !options.has(member.userId)) {
      options.set(member.userId, member.fullName);
    }
  }

  for (const participant of portalParticipants) {
    if (participant.id !== currentUserId && !options.has(participant.id)) {
      options.set(participant.id, `${participant.fullName} (Portal Participant)`);
    }
  }

  return Array.from(options.entries()).map(([value, label]) => ({ value, label }));
}

export function buildPortalUserPickerOptions(
  users: AssigneePerson[],
): AssigneeOption[] {
  return users.map((user) => ({
    value: user.id,
    label: user.fullName,
  }));
}

export function buildAssigneeNameById({
  members,
  managers,
  portalParticipants,
}: {
  members: AssigneePerson[];
  managers: AssigneePerson[];
  portalParticipants: AssigneePerson[];
}) {
  const names = new Map<string, string>();

  for (const member of members) {
    names.set(member.id, member.fullName);
  }

  for (const manager of managers) {
    if (!names.has(manager.id)) {
      names.set(manager.id, manager.fullName);
    }
  }

  for (const participant of portalParticipants) {
    if (!names.has(participant.id)) {
      names.set(participant.id, participant.fullName);
    }
  }

  return names;
}