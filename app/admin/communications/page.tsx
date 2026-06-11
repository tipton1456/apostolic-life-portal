import { redirect } from "next/navigation";
import type { CommunicationLog } from "@/lib/communications";
import { listCommunicationLogs } from "@/lib/communications";
import { getCurrentPortalUser } from "@/lib/portal-users";

const GRID_COLUMNS =
  "grid-cols-[2rem_minmax(0,1.4fr)_minmax(0,1fr)_4rem_5.5rem_3rem_3rem_3rem_6.5rem]";

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
      <div className="mx-auto max-w-7xl">
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

        <section className="mt-8">
          {logs.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
              <div
                className={`grid ${GRID_COLUMNS} items-center gap-x-3 border-b border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500`}
              >
                <span aria-hidden="true" />
                <span>Group</span>
                <span>Sender</span>
                <span>Channel</span>
                <span>Status</span>
                <span className="text-right">Sent</span>
                <span className="text-right">Fail</span>
                <span className="text-right">Skip</span>
                <span className="text-right">Date</span>
              </div>

              <div className="divide-y divide-white/10">
                {logs.map((log) => (
                  <CommunicationLogRow key={log.id} log={log} />
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6">
              <h2 className="text-lg font-semibold">No messages sent yet</h2>
              <p className="mt-2 text-sm text-neutral-400">
                Group SMS and email messages will appear here after they are sent.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function CommunicationLogRow({ log }: { log: CommunicationLog }) {
  return (
    <details className="group">
      <summary
        className={`grid ${GRID_COLUMNS} cursor-pointer list-none items-center gap-x-3 px-3 py-2.5 text-sm transition hover:bg-white/[0.05] [&::-webkit-details-marker]:hidden`}
      >
        <span
          aria-hidden="true"
          className="text-xs text-lime-300 transition group-open:rotate-90"
        >
          ›
        </span>
        <span className="min-w-0 truncate font-medium text-neutral-100">
          {log.groupName}
        </span>
        <span className="min-w-0 truncate text-neutral-400">{log.senderEmail}</span>
        <span className="uppercase text-neutral-300">{log.channel}</span>
        <StatusLabel status={log.status} />
        <span className="text-right tabular-nums text-neutral-200">
          {log.successCount}
        </span>
        <span
          className={
            log.failureCount > 0
              ? "text-right tabular-nums text-yellow-300"
              : "text-right tabular-nums text-neutral-400"
          }
        >
          {log.failureCount}
        </span>
        <span className="text-right tabular-nums text-neutral-400">
          {log.skippedCount}
        </span>
        <span className="text-right text-xs text-neutral-400">
          {formatDateTime(log.createdAt)}
        </span>
      </summary>

      <div className="border-t border-white/10 bg-neutral-950/50 px-3 py-3 pl-8">
        {log.subject ? (
          <p className="text-xs text-neutral-300">
            <span className="font-semibold text-neutral-100">Subject:</span>{" "}
            {log.subject}
          </p>
        ) : null}

        {log.attachmentNames.length > 0 ? (
          <p className="mt-1 text-xs text-neutral-400">
            <span className="font-semibold text-neutral-300">Attachments:</span>{" "}
            {log.attachmentNames.join(", ")}
          </p>
        ) : null}

        <p className="mt-2 whitespace-pre-line rounded-lg border border-white/10 bg-neutral-950/80 px-3 py-2 text-xs leading-5 text-neutral-300">
          {log.messageBody}
        </p>

        {log.recipients.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="border-b border-white/10 text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Recipient</th>
                  <th className="px-2 py-1.5 font-medium">
                    {log.channel === "email" ? "Email" : "Phone"}
                  </th>
                  <th className="px-2 py-1.5 font-medium">Status</th>
                  <th className="px-2 py-1.5 font-medium">
                    {log.channel === "email" ? "Resend ID" : "Twilio SID"}
                  </th>
                  <th className="px-2 py-1.5 font-medium">Failure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {log.recipients.map((recipient) => (
                  <tr key={recipient.id}>
                    <td className="px-2 py-2 font-medium text-neutral-100">
                      {recipient.personName}
                    </td>
                    <td className="px-2 py-2 text-neutral-300">
                      {recipient.contactLabel || "Not listed"}
                    </td>
                    <td className="px-2 py-2 text-neutral-300">
                      {recipient.status}
                    </td>
                    <td className="px-2 py-2 text-neutral-400">
                      {recipient.providerMessageId || "-"}
                    </td>
                    <td className="px-2 py-2 text-neutral-400">
                      {recipient.failureMessage || recipient.failureCode || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-xs text-neutral-500">No recipient records.</p>
        )}
      </div>
    </details>
  );
}

function StatusLabel({ status }: { status: string }) {
  const isWarning =
    status.includes("failure") ||
    status.includes("error") ||
    status.includes("failed") ||
    status.includes("partial");

  return (
    <span
      className={
        isWarning
          ? "truncate text-xs uppercase text-yellow-300"
          : "truncate text-xs uppercase text-lime-300"
      }
      title={status.replaceAll("_", " ")}
    >
      {formatStatus(status)}
    </span>
  );
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}