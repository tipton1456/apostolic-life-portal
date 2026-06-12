import Link from "next/link";
import { redirect } from "next/navigation";
import ProjectTasksPreview from "@/app/projects/project-tasks-preview";
import { getUpcomingEvents } from "@/lib/events";
import { getPrayerBoardMessages } from "@/lib/groupme";
import { getUpcomingAssignments } from "@/lib/planning-center";
import { getCurrentSessionUser } from "@/lib/demo";
import {
  canCurrentUserAccessProjects,
  listAccessibleProjectTasks,
} from "@/lib/project-management";

export default async function DashboardPage() {
  const user = await getCurrentSessionUser();

  if (!user) {
    redirect("/login");
  }

  const [assignments, prayerBoard, events, showProjectTasks] = await Promise.all([
    getUpcomingAssignments(user.email ?? undefined),
    getPrayerBoardMessages(5),
    getUpcomingEvents(3),
    user.isDemo ? Promise.resolve(false) : canCurrentUserAccessProjects(),
  ]);
  const projectTasks = showProjectTasks
    ? await listAccessibleProjectTasks(8).catch((error) => {
        console.error("Dashboard project tasks preview failed:", error);
        return [];
      })
    : [];

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-8 pt-3 sm:px-6 sm:pt-4">
        <header className="mb-8 border-b border-white/10 pb-5 sm:mb-10 sm:pb-6">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Member Portal
          </h1>
          <p className="mt-3 max-w-2xl text-neutral-400">
            A simple place for members to view contact information, family
            details, schedules, events, and future church resources.
          </p>
        </header>

        <section className="mb-10">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
                Upcoming Schedule
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                Next 3 Assignments
              </h2>
            </div>
            <Link
              href="/assignments"
              className="text-sm font-semibold text-lime-400 hover:text-lime-300"
            >
              View All
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            {assignments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-neutral-500">
                    <tr>
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">Assignment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {assignments.map((assignment) => (
                      <tr
                        key={assignment.id}
                        className="transition hover:bg-white/[0.06]"
                      >
                        <td className="px-5 py-4 font-semibold text-lime-300">
                          <Link
                            href={assignment.detailHref}
                            className="block"
                          >
                            {assignment.dates}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-neutral-100">
                          <Link
                            href={assignment.detailHref}
                            className="block"
                          >
                            {assignment.serviceTypeName}
                            <span className="mx-2 text-neutral-500">|</span>
                            <span className="text-neutral-300">
                              {assignment.position}
                            </span>
                            <span className="mx-2 text-neutral-500">|</span>
                            <span className="text-neutral-300">
                              {assignment.team}
                            </span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6">
                <h3 className="text-xl font-semibold">No assignments found</h3>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
                  We could not find upcoming Planning Center assignments for
                  {user.email ? ` ${user.email}` : " this login email"} yet.
                </p>
              </div>
            )}
          </div>
        </section>

        {showProjectTasks ? (
          <section className="mb-10">
            <ProjectTasksPreview
              tasks={projectTasks}
              title="Your Project Tasks"
              viewAllHref="/projects"
            />
          </section>
        ) : null}

        <section className="mb-10">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
                Prayer Board
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                Last 5 Prayer Board Entries
              </h2>
            </div>
            <Link
              href="/prayer-board"
              className="text-sm font-semibold text-lime-400 hover:text-lime-300"
            >
              View All
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            {prayerBoard.messages.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-neutral-500">
                    <tr>
                      <th className="px-5 py-3 font-medium">Name</th>
                      <th className="px-5 py-3 font-medium">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {prayerBoard.messages.map((message) => (
                      <tr
                        key={message.id}
                        className="transition hover:bg-white/[0.06]"
                      >
                        <td className="w-48 px-5 py-4">
                          <p className="font-semibold text-lime-300">
                            {message.author}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-neutral-500">
                            {message.createdAtLabel}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-neutral-200">
                          <Link href="/prayer-board" className="block">
                            {message.text || "Attachment"}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6">
                <h3 className="text-xl font-semibold">No prayer entries found</h3>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
                  GroupMe did not return recent prayer board entries.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="mb-10">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
                Upcoming Events
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Next 3 Events</h2>
            </div>
            <Link
              href="/events"
              className="text-sm font-semibold text-lime-400 hover:text-lime-300"
            >
              View All
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {events.length > 0 ? (
              events.map((event) => (
                <Link
                  key={event.id}
                  href="/events"
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-lime-400/60 hover:bg-white/[0.06]"
                >
                  {event.imageUrl ? (
                    <img
                      src={event.imageUrl}
                      alt={event.title}
                      className="h-28 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-28 w-full items-center justify-center bg-white/[0.08] text-sm text-neutral-400">
                      No image
                    </div>
                  )}
                  <div className="p-4">
                    <p className="text-sm font-semibold text-lime-300">
                      {event.dateLabel} · {event.timeLabel}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-neutral-100">
                      {event.title}
                    </h3>
                    <p className="mt-2 text-sm text-neutral-400">
                      {event.location}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:col-span-3">
                <h3 className="text-xl font-semibold">No events found</h3>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
                  The public events calendar did not return upcoming events.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}