"use client";

import { useState } from "react";
import {
  ADD_PORTAL_USER_ASSIGNEE_VALUE,
  CREATE_NEW_ASSIGNEE_VALUE,
} from "@/lib/project-participant-constants";

export default function TaskAssigneeField({
  name = "assignedTo",
  label = "Assigned to",
  defaultValue = "",
  options,
  portalUserOptions = [],
  allowCreateNew = true,
  required = false,
}: {
  name?: string;
  label?: string;
  defaultValue?: string;
  options: Array<{ value: string; label: string }>;
  portalUserOptions?: Array<{ value: string; label: string }>;
  allowCreateNew?: boolean;
  required?: boolean;
}) {
  const [assignedTo, setAssignedTo] = useState(defaultValue);
  const showPortalUserPicker = assignedTo === ADD_PORTAL_USER_ASSIGNEE_VALUE;
  const showCreateFields = assignedTo === CREATE_NEW_ASSIGNEE_VALUE;

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-neutral-300">
        {label}
        <select
          name={name}
          value={assignedTo}
          required={required}
          onChange={(event) => setAssignedTo(event.target.value)}
          className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
        >
          {options.map((option) => (
            <option key={option.value || "unassigned"} value={option.value}>
              {option.label}
            </option>
          ))}
          {allowCreateNew && portalUserOptions.length > 0 ? (
            <option value={ADD_PORTAL_USER_ASSIGNEE_VALUE}>
              Add user from portal...
            </option>
          ) : null}
          {allowCreateNew ? (
            <option value={CREATE_NEW_ASSIGNEE_VALUE}>Add a new user...</option>
          ) : null}
        </select>
      </label>

      {showPortalUserPicker ? (
        <div className="rounded-xl border border-lime-400/20 bg-lime-400/5 p-4">
          <label className="block text-sm font-medium text-neutral-300">
            Portal user
            <select
              name="existingPortalUserId"
              required
              defaultValue=""
              className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
            >
              <option value="" disabled>
                Select a portal user
              </option>
              {portalUserOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-3 text-sm text-neutral-400">
            This adds the selected portal user to the project with the participant
            role, then assigns the task to them.
          </p>
        </div>
      ) : null}

      {showCreateFields ? (
        <div className="grid gap-3 rounded-xl border border-lime-400/20 bg-lime-400/5 p-4 md:grid-cols-2">
          <p className="text-sm text-neutral-200 md:col-span-2">
            This creates a new portal account with the participant role, adds them
            to the project, assigns the task, and sends a login SMS.
          </p>
          <Field label="Email (username)" name="newParticipantEmail" type="email" required />
          <Field label="Mobile phone" name="newParticipantPhone" type="tel" required />
          <Field label="First name" name="newParticipantFirstName" required />
          <Field label="Last name" name="newParticipantLastName" required />
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-neutral-300">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
      />
    </label>
  );
}