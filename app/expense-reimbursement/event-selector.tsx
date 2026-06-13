"use client";

import { useState } from "react";
import type { ProjectOption } from "@/lib/project-management";

type EventSelectorProps = {
  activeProjects: ProjectOption[];
  defaultValue?: string;
};

export default function EventSelector({ activeProjects, defaultValue }: EventSelectorProps) {
  const [mode, setMode] = useState<"project" | "custom">(
    defaultValue && !activeProjects.some((p) => p.name === defaultValue) ? "custom" : "project"
  );
  const [selectedProjectName, setSelectedProjectName] = useState(
    defaultValue && activeProjects.some((p) => p.name === defaultValue) ? defaultValue : ""
  );
  const [customEvent, setCustomEvent] = useState(
    defaultValue && !activeProjects.some((p) => p.name === defaultValue) ? defaultValue : ""
  );

  // The final value for the hidden "event" field that gets sent to Cognito and used for project matching
  const finalEvent = mode === "project" ? selectedProjectName : customEvent;

  return (
    <div>
      <label className="block text-sm font-medium text-neutral-300">
        Event
        <select
          className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
          value={mode === "project" ? selectedProjectName : "__custom__"}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "__custom__") {
              setMode("custom");
            } else {
              setMode("project");
              setSelectedProjectName(val);
            }
          }}
          required
        >
          <option value="">Select an open project or custom event…</option>
          {activeProjects.map((project) => (
            <option key={project.id} value={project.name}>
              {project.name} (active)
            </option>
          ))}
          <option value="__custom__">Custom event name</option>
        </select>
      </label>

      {/* Hidden input that carries the final text value for "event" (project name or custom text).
          This is what gets sent in the FormData as "event" to the Cognito submission
          and what the reverse reconcile uses for exact project name matching. */}
      <input type="hidden" name="event" value={finalEvent} />

      {mode === "custom" && (
        <div className="mt-3">
          <label className="block text-sm font-medium text-neutral-300">
            Custom Event Name
            <input
              type="text"
              name="eventCustom"
              value={customEvent}
              onChange={(e) => setCustomEvent(e.target.value)}
              placeholder="Enter custom event name"
              className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
              required
            />
          </label>
          <p className="mt-1 text-xs text-neutral-400">
            This text will be sent as the Event to the Cognito form and used for project matching if it exactly matches a project name.
          </p>
        </div>
      )}

      {mode === "project" && selectedProjectName && (
        <p className="mt-1 text-xs text-neutral-400">
          The project name “{selectedProjectName}” will be sent as the Event value to Cognito.
        </p>
      )}
    </div>
  );
}