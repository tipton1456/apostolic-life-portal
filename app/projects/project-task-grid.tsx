"use client";

import { useMemo, useState } from "react";
import AdminFormButton from "@/app/admin/admin-form-button";
import TaskAssigneeField from "@/app/projects/task-assignee-field";
import TaskListTable from "@/app/projects/task-list-table";
import { createProjectTask, type ProjectTask } from "@/lib/project-management";
import {
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
} from "@/lib/project-task-options";
import type { ProjectTaskUpdate } from "@/lib/project-task-updates";
import { isTaskOverdue } from "@/lib/project-management-utils";

type TaskView = "outstanding" | "overdue" | "completed" | "all";

const TASK_VIEWS: Array<{ id: TaskView; label: string }> = [
  { id: "outstanding", label: "Outstanding" },
  { id: "overdue", label: "Overdue" },
  { id: "completed", label: "Completed" },
  { id: "all", label: "All Tasks" },
];

const EMPTY_MESSAGES: Record<TaskView, string> = {
  outstanding: "No outstanding tasks. Everything is complete.",
  overdue: "No overdue tasks.",
  completed: "No completed tasks yet.",
  all: "No tasks have been added to this project yet.",
};

export default function ProjectTaskGrid({
  tasks,
  projectId,
  currentUserId,
  canManageTasks,
  isProjectCompleted,
  assigneeOptions,
  taskUpdatesByTaskId,
  highlightedTaskId,
}: {
  tasks: ProjectTask[];
  projectId: string;
  currentUserId: string;
  canManageTasks: boolean;
  isProjectCompleted: boolean;
  assigneeOptions: Array<{ value: string; label: string }>;
  taskUpdatesByTaskId: Record<string, ProjectTaskUpdate[]>;
  highlightedTaskId?: string;
}) {
  const [view, setView] = useState<TaskView>("outstanding");
  const [showAddTask, setShowAddTask] = useState(false);

  const filteredTasks = useMemo(() => filterTasks(tasks, view), [tasks, view]);
  const canAddTasks = canManageTasks && !isProjectCompleted;

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-lime-200">Project Tasks</h2>
          <p className="mt-1 text-sm text-neutral-400">
            {filteredTasks.length} task{filteredTasks.length === 1 ? "" : "s"} shown
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {TASK_VIEWS.map((option) => {
            const isActive = view === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setView(option.id)}
                className={
                  isActive
                    ? "rounded-lg bg-lime-400 px-3 py-2 text-xs font-semibold text-neutral-950 transition"
                    : "rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-neutral-300 transition hover:border-lime-300/40 hover:bg-lime-400/10 hover:text-lime-200"
                }
              >
                {option.label}
              </button>
            );
          })}
          {canAddTasks ? (
            <button
              type="button"
              onClick={() => setShowAddTask((current) => !current)}
              className="rounded-lg bg-lime-400 px-3 py-2 text-xs font-semibold text-neutral-950 transition hover:bg-lime-300"
            >
              {showAddTask ? "Close" : "New Task"}
            </button>
          ) : null}
        </div>
      </div>

      {showAddTask && canAddTasks ? (
        <form
          action={createProjectTask}
          className="grid gap-4 border-b border-white/10 px-5 py-5 md:grid-cols-2 xl:grid-cols-[1.2fr_1.2fr_0.8fr_0.8fr_0.8fr_0.8fr_0.9fr_auto]"
        >
          <input type="hidden" name="projectId" value={projectId} />
          <Field label="Task title" name="title" required />
          <Field label="Description" name="description" />
          <Field label="Start date" name="startDate" type="date" />
          <Field label="Due date" name="dueDate" type="date" />
          <SelectField
            label="Status"
            name="status"
            defaultValue="todo"
            options={TASK_STATUS_OPTIONS}
          />
          <SelectField
            label="Priority"
            name="priority"
            defaultValue="medium"
            options={TASK_PRIORITY_OPTIONS}
          />
          <TaskAssigneeField
            label="Assigned to"
            name="assignedTo"
            defaultValue=""
            options={assigneeOptions}
          />
          <AdminFormButton pendingLabel="Adding..." className="md:col-start-2 xl:col-start-8">
            Add Task
          </AdminFormButton>
        </form>
      ) : null}

      {filteredTasks.length > 0 ? (
        <TaskListTable
          canManageTasks={canManageTasks}
          currentUserId={currentUserId}
          highlightedTaskId={highlightedTaskId}
          projectId={projectId}
          taskUpdatesByTaskId={taskUpdatesByTaskId}
          tasks={filteredTasks}
        />
      ) : (
        <p className="px-5 py-4 text-sm text-neutral-400">{EMPTY_MESSAGES[view]}</p>
      )}
    </section>
  );
}

function filterTasks(tasks: ProjectTask[], view: TaskView) {
  switch (view) {
    case "outstanding":
      return tasks.filter((task) => task.status !== "completed");
    case "overdue":
      return tasks.filter((task) => isTaskOverdue(task));
    case "completed":
      return tasks.filter((task) => task.status === "completed");
    case "all":
      return tasks;
    default:
      return tasks;
  }
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

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <label className="block text-sm font-medium text-neutral-300">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
      >
        {options.map((option) => (
          <option key={option.value || "unassigned"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}