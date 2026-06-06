import { redirect } from "next/navigation";
import { getPrayerBoardMessages } from "@/lib/groupme";
import { createClient } from "@/lib/supabase/server";

export default async function PrayerBoardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const prayerBoard = await getPrayerBoardMessages();

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-4xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Prayer Board
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            GroupMe Prayer Requests
          </h1>
          <p className="mt-3 max-w-2xl text-neutral-400">
            Recent messages from the prayer board conversation. Replies happen
            in GroupMe.
          </p>

          {prayerBoard.conversationUrl ? (
            <a
              href={prayerBoard.conversationUrl}
              className="mt-5 inline-flex rounded-xl bg-lime-400 px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-lime-300"
            >
              Open GroupMe Conversation
            </a>
          ) : null}
        </header>

        <section className="mt-8 space-y-4">
          {!prayerBoard.isConfigured ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-2xl font-semibold">GroupMe not connected</h2>
              <p className="mt-3 text-sm leading-6 text-neutral-400">
                Add GROUPME_ACCESS_TOKEN and GROUPME_PRAYER_GROUP_ID to the
                environment to show prayer board messages here.
              </p>
            </div>
          ) : prayerBoard.messages.length > 0 ? (
            prayerBoard.messages.map((message) => (
              <article
                key={message.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex items-start gap-3">
                  {message.avatarUrl ? (
                    <img
                      src={message.avatarUrl}
                      alt={message.author}
                      className="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lime-400 text-sm font-bold text-neutral-950">
                      {getInitials(message.author)}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                      <h2 className="font-semibold text-neutral-100">
                        {message.author}
                      </h2>
                      <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">
                        {message.createdAtLabel}
                      </p>
                    </div>

                    {message.text ? (
                      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-neutral-300">
                        {message.text}
                      </p>
                    ) : null}

                    {message.imageUrls.length > 0 ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {message.imageUrls.map((imageUrl) => (
                          <img
                            key={imageUrl}
                            src={imageUrl}
                            alt=""
                            className="max-h-80 w-full rounded-xl object-cover"
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-2xl font-semibold">No messages found</h2>
              <p className="mt-3 text-sm leading-6 text-neutral-400">
                GroupMe did not return recent prayer board messages.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
