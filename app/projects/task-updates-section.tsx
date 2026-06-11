import AdminFormButton from "@/app/admin/admin-form-button";
import { addProjectTaskUpdate } from "@/lib/project-task-updates";
import type { ProjectTaskUpdate } from "@/lib/project-task-updates";
import type { ProjectTask, TaskStatus } from "@/lib/project-management";
import {
  formatProjectFileDate,
  formatProjectFileSize,
} from "@/lib/project-files-utils";
import { formatTaskStatus } from "@/lib/project-management-utils";

const TASK_UPDATE_STATUS_OPTIONS = [
  { value: "", label: "Keep current status" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "blocked", label: "Blocked" },
];

export default function TaskUpdatesSection({
  task,
  projectId,
  updates,
  canAddUpdates,
}: {
  task: ProjectTask;
  projectId: string;
  updates: ProjectTaskUpdate[];
  canAddUpdates: boolean;
}) {
  return (
    <div className="border-t border-white/10 px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Task Updates
        </h3>
        <span className="text-xs text-neutral-500">
          {updates.length} update{updates.length === 1 ? "" : "s"}
        </span>
      </div>

      {canAddUpdates ? (
        <form
          action={addProjectTaskUpdate}
          encType="multipart/form-data"
          className="mt-4 space-y-3 rounded-xl border border-white/10 bg-neutral-950/40 p-4"
        >
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="taskId" value={task.id} />
          <label className="block text-sm font-medium text-neutral-300">
            Update comment
            <textarea
              name="comment"
              required
              rows={4}
              placeholder="Share progress, questions, or next steps..."
              className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none ring-lime-400 transition focus:ring-2"
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
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
          <div className="flex justify-end">
            <AdminFormButton pendingLabel="Posting...">Post Update</AdminFormButton>
          </div>
        </form>
      ) : (
        <p className="mt-3 text-sm text-neutral-500">
          {task.status === "completed"
            ? "This task is completed. Earlier updates remain visible below."
            : "You can view updates on this task, but only the assignee or a project manager can add new ones."}
        </p>
      )}

      {updates.length > 0 ? (
        <div className="mt-4 space-y-2">
          {updates.map((update) => (
            <TaskUpdateRow key={update.id} update={update} />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-neutral-500">
          No updates have been posted for this task yet.
        </p>
      )}
    </div>
  );
}

function TaskUpdateRow({ update }: { update: ProjectTaskUpdate }) {
  const statusSummary = formatStatusChange(update.previousStatus, update.newStatus);

  return (
    <details className="group overflow-hidden rounded-xl border border-white/10 bg-neutral-950/40">
      <summary className="grid cursor-pointer list-none gap-2 px-4 py-3 transition hover:bg-white/[0.05] md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-neutral-100">
            {update.createdByName}
          </p>
          <p className="mt-1 line-clamp-1 text-xs text-neutral-400">
            {update.comment}
          </p>
        </div>
        {statusSummary ? (
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-lime-300">
            {statusSummary}
          </span>
        ) : (
          <span className="text-xs text-neutral-500">Comment</span>
        )}
        <span className="text-xs text-neutral-500 md:text-right">
          {formatProjectFileDate(update.createdAt)}
        </span>
      </summary>
      <div className="border-t border-white/10 px-4 py-3">
        <p className="whitespace-pre-line text-sm leading-6 text-neutral-200">
          {update.comment}
        </p>
        {update.file ? (
          <div className="mt-3 flex flex-col gap-2 rounded-lg border border-white/10 bg-neutral-950/70 px-3 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-100">
                {update.file.fileName}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                {formatProjectFileSize(update.file.fileSize)}
              </p>
            </div>
            <a
              href={`/api/projects/files/${update.file.id}/download`}
              className="inline-flex w-fit rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-lime-300 transition hover:border-lime-300/60 hover:bg-lime-400/10"
            >
              Download
            </a>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function formatStatusChange(
  previousStatus: TaskStatus | null,
  newStatus: TaskStatus | null,
) {
  if (!newStatus) return null;

  if (previousStatus) {
    return `${formatTaskStatus(previousStatus)} → ${formatTaskStatus(newStatus)}`;
  }

  return formatTaskStatus(newStatus);
}