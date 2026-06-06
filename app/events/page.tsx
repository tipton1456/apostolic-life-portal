import { redirect } from "next/navigation";
import { getUpcomingEvents } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";

export default async function EventsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const events = await getUpcomingEvents();

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Apostolic Life
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">Events</h1>
          <p className="mt-3 max-w-2xl text-neutral-400">
            Upcoming church events from the Apostolic Life public calendar.
          </p>
        </header>

        <section className="mt-8 space-y-3">
          {events.length > 0 ? (
            events.map((event) => (
              <details
                key={event.id}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
              >
                <summary className="grid cursor-pointer list-none gap-3 px-5 py-4 transition hover:bg-white/[0.05] md:grid-cols-[1fr_12rem_10rem] [&::-webkit-details-marker]:hidden">
                  <div>
                    <h2 className="font-semibold text-neutral-100">
                      {event.title}
                    </h2>
                    <p className="mt-1 text-sm text-neutral-400">
                      {event.location}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-lime-300 md:text-right">
                    {event.dateLabel}
                  </p>
                  <p className="text-sm text-neutral-300 md:text-right">
                    {event.timeLabel}
                  </p>
                </summary>

                <div className="grid gap-5 border-t border-white/10 p-5 md:grid-cols-[14rem_1fr]">
                  {event.imageUrl ? (
                    <img
                      src={event.imageUrl}
                      alt={event.title}
                      className="aspect-video w-full rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-white/[0.08] text-sm text-neutral-400">
                      No image
                    </div>
                  )}
                  <div>
                    <p className="whitespace-pre-line text-sm leading-6 text-neutral-300">
                      {event.description || "No additional details listed."}
                    </p>
                    {event.sourceUrl ? (
                      <a
                        href={event.sourceUrl}
                        className="mt-4 inline-flex text-sm font-semibold text-lime-400 hover:text-lime-300"
                      >
                        View on Apostolic Life
                      </a>
                    ) : null}
                  </div>
                </div>
              </details>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-2xl font-semibold">No events found</h2>
              <p className="mt-3 text-sm leading-6 text-neutral-400">
                The public events calendar did not return upcoming events.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
