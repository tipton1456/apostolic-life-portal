"use client";

import { useState } from "react";
import type { ProjectMilestone } from "@/lib/project-milestone-utils";
import type { ProjectTask } from "@/lib/project-management";

export default function TaskDueDateField({
  milestones,
  projectStartDate,
  projectEndDate,
  defaultDueDateMode = "custom",
  defaultMilestoneId = "",
  defaultDueDate = "",
}: {
  milestones: ProjectMilestone[];
  projectStartDate: string | null;
  projectEndDate: string | null;
  defaultDueDateMode?: ProjectTask["dueDateMode"];
  defaultMilestoneId?: string;
  defaultDueDate?: string;
}) {
  const [dueDateMode, setDueDateMode] = useState<ProjectTask["dueDateMode"]>(
    defaultDueDateMode,
  );

  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="text-sm font-medium text-neutral-300">Due date type</legend>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-neutral-300">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="dueDateMode"
              value="custom"
              checked={dueDateMode === "custom"}
              onChange={() => setDueDateMode("custom")}
              className="accent-lime-400"
            />
            Custom date
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="dueDateMode"
              value="milestone"
              checked={dueDateMode === "milestone"}
              onChange={() => setDueDateMode("milestone")}
              disabled={milestones.length === 0}
              className="accent-lime-400 disabled:opacity-40"
            />
            Milestone
          </label>
        </div>
      </fieldset>

      {dueDateMode === "milestone" ? (
        <label className="block text-sm font-medium text-neutral-300">
          Milestone
          <select
            name="milestoneId"
            defaultValue={defaultMilestoneId}
            required
            className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
          >
            <option value="">Select a milestone...</option>
            {milestones.map((milestone) => (
              <option key={milestone.id} value={milestone.id}>
                {milestone.name} ({milestone.milestoneDate})
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="block text-sm font-medium text-neutral-300">
          Due date
          <input
            name="dueDate"
            type="date"
            defaultValue={defaultDueDate}
            min={projectStartDate ?? undefined}
            max={projectEndDate ?? undefined}
            className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
          />
        </label>
      )}
    </div>
  );
}