"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import AdminFormButton from "@/app/admin/admin-form-button";
import TaskAssigneeField from "@/app/projects/task-assignee-field";
import { PortalIcon } from "@/app/icons";
import { addProjectTaskUpdate } from "@/lib/project-task-updates";
import type { ProjectTaskUpdate } from "@/lib/project-task-updates";
import type { ProjectTask } from "@/lib/project-management";
import {
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  TASK_UPDATE_STATUS_OPTIONS,
} from "@/lib/project-task-options";
import {
  deleteProjectTask,
  updateProjectTask,
} from "@/lib/project-management";
import type { ProjectTaskFile } from "@/lib/project-files";
import { uploadProjectTaskFile } from "@/lib/project-files";
import {
  formatProjectFileDate,
  formatProjectFileSize,
} from "@/lib/project-files-utils";
import {
  formatDisplayDate,
  formatTaskPriority,
  formatTaskStatus,
} from "@/lib/project-management-utils";

type AssigneeOption = { value: string; label: string };

export default function ProjectTaskModals({
  projectId,
  tasks,
  currentUserId,
  canManageTasks,
  canReassignTasks,
  assigneeOptions,
  participantAssigneeOptions,
  taskFilesByTaskId,
  taskUpdatesByTaskId,
  isProjectCompleted,
}: {
  projectId: string;
  tasks: ProjectTask[];
  currentUserId: string;
  canManageTasks: boolean;
  canReassignTasks: boolean;
  assigneeOptions: AssigneeOption[];
  participantAssigneeOptions: AssigneeOption[];
  taskFilesByTaskId: Record<string, ProjectTaskFile[]>;
  taskUpdatesByTaskId: Record<string, ProjectTaskUpdate[]>;
  isProjectCompleted: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTaskId = searchParams.get("task");
  const showAddUpdate = searchParams.get("addUpdate") === "1";
  const activeTask = tasks.find((task) => task.id === activeTaskId) ?? null;

  useEffect(() => {
    if (!activeTask) return;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [activeTask]);

  if (!activeTask) {
    return null;
  }

  const taskFiles = taskFilesByTaskId[activeTask.id] ?? [];
  const taskUpdates = taskUpdatesByTaskId[activeTask.id] ?? [];
  const isAssignee = activeTask.assignedTo === currentUserId;
  const canEdit =
    canManageTasks || (isAssignee && activeTask.status !== "completed");
  const canReassignTask =
    canManageTasks || (canReassignTasks && isAssignee && activeTask.status !== "completed");
  const canAddUpdates = canEdit && !isProjectCompleted;
  const taskHref = `/projects/${projectId}?task=${activeTask.id}`;
  const addUpdateHref = `/projects/${projectId}?task=${activeTask.id}&addUpdate=1`;
  const closeHref = `/projects/${projectId}`;

  function closeToTask() {
    router.push(taskHref);
  }

  function closeAll() {
    router.push(closeHref);
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 p-4 backdrop-blur-sm"
        onClick={closeAll}
      >
        <div
          className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl shadow-black/50"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-neutral-950/95 px-5 py-4 backdrop-blur">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-lime-400">
                Task Workspace
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-neutral-100">
                {activeTask.title}
              </h2>
              <p className="mt-2 text-sm text-neutral-400">
                {formatTaskStatus(activeTask.status)} ·{" "}
                {formatTaskPriority(activeTask.priority)} · Due{" "}
                {formatDisplayDate(activeTask.dueDate)}
              </p>
            </div>
            <button
              type="button"
              onClick={closeAll}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-neutral-300 transition hover:bg-white/10"
            >
              Close
            </button>
          </div>

          <div className="space-y-6 px-5 py-5">
            {canEdit ? (
              <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  Task Details
                </h3>
                <form
                  action={updateProjectTask}
                  className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
                >
                  <input type="hidden" name="id" value={activeTask.id} />
                  <input type="hidden" name="projectId" value={projectId} />
                  {canManageTasks ? (
                    <>
                      <ModalField
                        label="Task title"
                        name="title"
                        defaultValue={activeTask.title}
                        required
                      />
                      <ModalField
                        label="Description"
                        name="description"
                        defaultValue={activeTask.description}
                      />
                      <ModalField
                        label="Start date"
                        name="startDate"
                        type="date"
                        defaultValue={activeTask.startDate ?? ""}
                      />
                      <ModalField
                        label="Due date"
                        name="dueDate"
                        type="date"
                        defaultValue={activeTask.dueDate ?? ""}
                      />
                      <ModalSelectField
                        label="Priority"
                        name="priority"
                        defaultValue={activeTask.priority}
                        options={TASK_PRIORITY_OPTIONS}
                      />
                      <TaskAssigneeField
                        label="Assigned to"
                        name="assignedTo"
                        defaultValue={activeTask.assignedTo ?? ""}
                        options={assigneeOptions}
                      />
                    </>
                  ) : (
                    <>
                      <input type="hidden" name="title" value={activeTask.title} />
                      <input
                        type="hidden"
                        name="description"
                        value={activeTask.description}
                      />
                      <input
                        type="hidden"
                        name="startDate"
                        value={activeTask.startDate ?? ""}
                      />
                      <input type="hidden" name="dueDate" value={activeTask.dueDate ?? ""} />
                      <input type="hidden" name="priority" value={activeTask.priority} />
                      {canReassignTask ? (
                        <TaskAssigneeField
                          label="Hand off to"
                          name="assignedTo"
                          defaultValue={activeTask.assignedTo ?? ""}
                          options={participantAssigneeOptions}
                          allowCreateNew={false}
                        />
                      ) : (
                        <input
                          type="hidden"
                          name="assignedTo"
                          value={activeTask.assignedTo ?? ""}
                        />
                      )}
                    </>
                  )}
                  <ModalSelectField
                    label="Status"
                    name="status"
                    defaultValue={activeTask.status}
                    options={TASK_STATUS_OPTIONS}
                  />
                  <div className="flex items-end justify-end md:col-span-2 xl:col-span-3">
                    <AdminFormButton pendingLabel="Saving...">Save Task</AdminFormButton>
                  </div>
                </form>
                {canManageTasks ? (
                  <form action={deleteProjectTask} className="mt-3 flex justify-end">
                    <input type="hidden" name="id" value={activeTask.id} />
                    <input type="hidden" name="projectId" value={projectId} />
                    <AdminFormButton
                      pendingLabel="Deleting..."
                      variant="danger"
                      className="rounded-lg px-3 py-2"
                    >
                      <PortalIcon className="h-4 w-4" name="trash" />
                      Delete Task
                    </AdminFormButton>
                  </form>
                ) : null}
              </section>
            ) : (
              <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-neutral-300">
                <p>{activeTask.description || "No task description provided."}</p>
              </section>
            )}

            <section className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  Task Updates
                </h3>
                {canAddUpdates ? (
                  <Link
                    href={addUpdateHref}
                    className="rounded-lg bg-lime-400 px-3 py-1.5 text-xs font-semibold text-neutral-950 transition hover:bg-lime-300"
                  >
                    Add Update
                  </Link>
                ) : null}
              </div>
              {taskUpdates.length > 0 ? (
                <div className="overflow-x-auto">
                  <div className="min-w-[760px]">
                    <div className="grid grid-cols-[6.5rem_minmax(0,0.9fr)_minmax(0,1.4fr)_5.5rem_4.5rem] gap-x-3 border-b border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                      <span>Date</span>
                      <span>Author</span>
                      <span>Comment</span>
                      <span>Status</span>
                      <span className="text-right">File</span>
                    </div>
                    <div className="divide-y divide-white/10">
                      {taskUpdates.map((update) => (
                        <details key={update.id} className="group">
                          <summary className="grid cursor-pointer list-none grid-cols-[6.5rem_minmax(0,0.9fr)_minmax(0,1.4fr)_5.5rem_4.5rem] items-center gap-x-3 px-4 py-2.5 text-sm transition hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden">
                            <span className="text-xs text-neutral-400">
                              {formatProjectFileDate(update.createdAt)}
                            </span>
                            <span className="truncate font-medium text-neutral-100">
                              {update.createdByName}
                            </span>
                            <span className="truncate text-neutral-300">
                              {update.comment}
                            </span>
                            <span className="truncate text-xs text-lime-300">
                              {formatUpdateStatus(update)}
                            </span>
                            <span className="text-right text-xs text-neutral-400">
                              {update.file ? "Yes" : "—"}
                            </span>
                          </summary>
                          <div className="border-t border-white/10 bg-neutral-950/50 px-4 py-3">
                            <p className="whitespace-pre-line text-sm leading-6 text-neutral-200">
                              {update.comment}
                            </p>
                            {update.file ? (
                              <a
                                href={`/api/projects/files/${update.file.id}/download`}
                                className="mt-3 inline-flex rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-lime-300 transition hover:border-lime-300/60 hover:bg-lime-400/10"
                              >
                                Download {update.file.fileName}
                              </a>
                            ) : null}
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="px-4 py-4 text-sm text-neutral-500">
                  No updates have been posted for this task yet.
                </p>
              )}
            </section>

            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  Task Files
                </h3>
                <span className="text-xs text-neutral-500">
                  {taskFiles.length} file{taskFiles.length === 1 ? "" : "s"}
                </span>
              </div>
              {taskFiles.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {taskFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex flex-col gap-2 rounded-lg border border-white/10 bg-neutral-950/40 px-3 py-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="font-medium text-neutral-100">{file.fileName}</p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {formatProjectFileSize(file.fileSize)} · {file.uploadedByName} ·{" "}
                          {formatProjectFileDate(file.createdAt)}
                        </p>
                      </div>
                      <a
                        href={`/api/projects/files/${file.id}/download`}
                        className="inline-flex w-fit rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-lime-300 transition hover:border-lime-300/60 hover:bg-lime-400/10"
                      >
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-neutral-500">
                  No files attached to this task yet.
                </p>
              )}
              {!isProjectCompleted && canEdit ? (
                <form
                  action={uploadProjectTaskFile}
                  encType="multipart/form-data"
                  className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]"
                >
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="taskId" value={activeTask.id} />
                  <label className="block text-sm font-medium text-neutral-300">
                    Attach file
                    <input
                      name="taskFile"
                      type="file"
                      required
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*"
                      className="mt-2 block w-full text-sm text-neutral-300 file:mr-4 file:rounded-lg file:border-0 file:bg-lime-400 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-neutral-950 hover:file:bg-lime-300"
                    />
                  </label>
                  <AdminFormButton pendingLabel="Uploading..." className="md:mt-7">
                    Upload File
                  </AdminFormButton>
                </form>
              ) : null}
            </section>
          </div>
        </div>
      </div>

      {showAddUpdate && canAddUpdates ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-950/90 p-4 backdrop-blur-sm"
          onClick={closeToTask}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl shadow-black/50"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-lime-400">
                  Task Update
                </p>
                <h3 className="mt-1 text-xl font-semibold text-neutral-100">
                  Add Update
                </h3>
              </div>
              <button
                type="button"
                onClick={closeToTask}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-neutral-300 transition hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
            <form
              action={addProjectTaskUpdate}
              encType="multipart/form-data"
              className="space-y-4 px-5 py-5"
            >
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="taskId" value={activeTask.id} />
              <label className="block text-sm font-medium text-neutral-300">
                Update comment
                <textarea
                  name="comment"
                  required
                  rows={5}
                  autoFocus
                  placeholder="Share progress, questions, or next steps..."
                  className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none ring-lime-400 transition focus:ring-2"
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium text-neutral-300">
                  Update status
                  <select
                    name="status"
                    defaultValue=""
                    className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none ring-lime-400 transition focus:ring-2"
                  >
                    {TASK_UPDATE_STATUS_OPTIONS.map((option) => (
                      <option key={option.value || "unchanged"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-neutral-300">
                  Attach file (optional)
                  <input
                    name="updateFile"
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*"
                    className="mt-2 block w-full text-sm text-neutral-300 file:mr-4 file:rounded-lg file:border-0 file:bg-lime-400 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-neutral-950 hover:file:bg-lime-300"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeToTask}
                  className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-neutral-300 transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <AdminFormButton pendingLabel="Saving...">Save Update</AdminFormButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ModalField({
  label,
  name,
  type = "text",
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block text-sm font-medium text-neutral-300">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
      />
    </label>
  );
}

function ModalSelectField({
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
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatUpdateStatus(update: ProjectTaskUpdate) {
  if (!update.newStatus) return "—";

  if (update.previousStatus) {
    return `${formatTaskStatus(update.previousStatus)} → ${formatTaskStatus(update.newStatus)}`;
  }

  return formatTaskStatus(update.newStatus);
}