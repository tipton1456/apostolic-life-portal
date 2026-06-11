import Link from "next/link";
import type { AccessibleProjectTask } from "@/lib/project-management";
import {
  formatDisplayDate,
  formatTaskPriority,
  formatTaskStatus,
} from "@/lib/project-management-utils";

export default function ProjectTasksPreview({
  tasks,
  viewAllHref,
  title = "Your Project Tasks",
}: {
  tasks: AccessibleProjectTask[];
  viewAllHref: string;
  title?: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Project Tasks
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-lime-200">{title}</h2>
        </div>
        <Link
          href={viewAllHref}
          className="text-sm font-semibold text-lime-400 transition hover:text-lime-300"
        >
          View All Projects
        </Link>
      </div>
      {tasks.length > 0 ? (
        <div className="divide-y divide-white/10">
          {tasks.map((task) => (
            <Link
              key={task.id}
              href={`/projects/${task.projectId}?task=${task.id}`}
              className="flex flex-col gap-2 px-5 py-4 transition hover:bg-white/[0.06] md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-semibold text-neutral-100">{task.title}</p>
                <p className="mt-1 text-sm text-neutral-400">
                  {task.projectName} · {formatTaskStatus(task.status)} ·{" "}
                  {formatTaskPriority(task.priority)} priority
                </p>
              </div>
              <p
                className={
                  task.isOverdue
                    ? "text-sm font-semibold text-red-300"
                    : "text-sm text-neutral-300"
                }
              >
                Due {formatDisplayDate(task.dueDate)}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="px-5 py-4 text-sm text-neutral-400">
          No open project tasks are assigned to you right now.
        </p>
      )}
    </section>
  );
}