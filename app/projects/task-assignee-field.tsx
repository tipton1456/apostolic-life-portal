"use client";

import { useState } from "react";
import { CREATE_NEW_ASSIGNEE_VALUE } from "@/lib/project-participant-constants";

export default function TaskAssigneeField({
  name = "assignedTo",
  label = "Assigned to",
  defaultValue = "",
  options,
}: {
  name?: string;
  label?: string;
  defaultValue?: string;
  options: Array<{ value: string; label: string }>;
}) {
  const [assignedTo, setAssignedTo] = useState(defaultValue);
  const showCreateFields = assignedTo === CREATE_NEW_ASSIGNEE_VALUE;

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-neutral-300">
        {label}
        <select
          name={name}
          value={assignedTo}
          onChange={(event) => setAssignedTo(event.target.value)}
          className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
        >
          {options.map((option) => (
            <option key={option.value || "unassigned"} value={option.value}>
              {option.label}
            </option>
          ))}
          <option value={CREATE_NEW_ASSIGNEE_VALUE}>
            Create account for someone not listed...
          </option>
        </select>
      </label>

      {showCreateFields ? (
        <div className="grid gap-3 rounded-xl border border-lime-400/20 bg-lime-400/5 p-4 md:grid-cols-2">
          <p className="text-sm text-neutral-200 md:col-span-2">
            This person does not have a portal account yet. Enter their details to
            create one, add them to the project, assign the task, and send a login
            SMS.
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