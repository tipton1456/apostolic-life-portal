import { redirect } from "next/navigation";
import { listCommunicationLogs } from "@/lib/communications";
import { getCurrentPortalUser } from "@/lib/portal-users";

export default async function CommunicationLogPage() {
  const currentUser = await getCurrentPortalUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (!currentUser.isAdmin) {
    redirect("/dashboard");
  }

  const logs = await listCommunicationLogs();

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Administration
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Communication Log
          </h1>
          <p className="mt-3 max-w-2xl text-neutral-400">
            Review SMS and email messages sent from group management and
            recipient results.
          </p>
        </header>

        <section className="mt-8 space-y-4">
          {logs.length > 0 ? (
            logs.map((log) => (
              <details
                key={log.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
              >
                <summary className="grid cursor-pointer list-none gap-3 px-5 py-4 transition hover:bg-white/[0.05] md:grid-cols-[1fr_8rem_12rem_10rem_10rem] [&::-webkit-details-marker]:hidden">
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-100">
                      {log.groupName}
                    </h2>
                    <p className="mt-1 text-sm text-neutral-400">
                      {log.senderEmail} · {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                  <ChannelBadge channel={log.channel} />
                  <StatusBadge status={log.status} />
                  <p className="text-sm text-neutral-300 md:text-right">
                    {log.successCount} sent
                  </p>
                  <p className="text-sm text-neutral-300 md:text-right">
                    {log.failureCount} failed · {log.skippedCount} skipped
                  </p>
                </summary>

                <div className="border-t border-white/10 p-5">
                  {log.subject ? (
                    <p className="mb-4 text-sm font-semibold text-neutral-100">
                      Subject: {log.subject}
                    </p>
                  ) : null}

                  {log.attachmentNames.length > 0 ? (
                    <p className="mb-4 text-sm text-neutral-400">
                      Attachments: {log.attachmentNames.join(", ")}
                    </p>
                  ) : null}

                  <p className="whitespace-pre-line rounded-xl border border-white/10 bg-neutral-950/60 p-4 text-sm leading-6 text-neutral-300">
                    {log.messageBody}
                  </p>

                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-neutral-500">
                        <tr>
                          <th className="px-3 py-2 font-medium">Recipient</th>
                          <th className="px-3 py-2 font-medium">
                            {log.channel === "email" ? "Email" : "Phone"}
                          </th>
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-3 py-2 font-medium">
                            {log.channel === "email" ? "Resend ID" : "Twilio SID"}
                          </th>
                          <th className="px-3 py-2 font-medium">Failure</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {log.recipients.map((recipient) => (
                          <tr key={recipient.id}>
                            <td className="px-3 py-3 font-semibold text-neutral-100">
                              {recipient.personName}
                            </td>
                            <td className="px-3 py-3 text-neutral-300">
                              {recipient.contactLabel || "Not listed"}
                            </td>
                            <td className="px-3 py-3 text-neutral-300">
                              {recipient.status}
                            </td>
                            <td className="px-3 py-3 text-neutral-400">
                              {recipient.providerMessageId || "-"}
                            </td>
                            <td className="px-3 py-3 text-neutral-400">
                              {recipient.failureMessage ||
                                recipient.failureCode ||
                                "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold">No messages sent yet</h2>
              <p className="mt-3 text-sm text-neutral-400">
                Group SMS and email messages will appear here after they are sent.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  return (
    <span className="h-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-300 md:justify-self-end">
      {channel}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isWarning = status.includes("failure") || status.includes("error");

  return (
    <span
      className={
        isWarning
          ? "h-fit rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-yellow-300 md:justify-self-end"
          : "h-fit rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-lime-300 md:justify-self-end"
      }
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}