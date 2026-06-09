"use client";

import { useMemo, useState } from "react";
import AdminFormButton from "@/app/admin/admin-form-button";
import { PortalIcon } from "@/app/icons";
import type { GroupDetail } from "@/lib/elvanto-groups";
import LeaderToggle from "./leader-toggle";

type GroupCommunicationPanelProps = {
  group: GroupDetail;
  isEditing: boolean;
  removePersonAction: (formData: FormData) => void;
  sendSmsAction: (formData: FormData) => void;
  smsStatus?: string;
  updateLeaderAction: (formData: FormData) => void;
};

export default function GroupCommunicationPanel({
  group,
  isEditing,
  removePersonAction,
  sendSmsAction,
  smsStatus,
  updateLeaderAction,
}: GroupCommunicationPanelProps) {
  const contactableMemberIds = useMemo(
    () =>
      group.members
        .filter((member) => hasContactPhone(member.mobile))
        .map((member) => member.id),
    [group.members],
  );
  const [selectedMemberIds, setSelectedMemberIds] =
    useState<string[]>(contactableMemberIds);
  const [isComposing, setIsComposing] = useState(false);
  const selectedMemberIdSet = new Set(selectedMemberIds);

  function toggleMember(memberId: string, checked: boolean) {
    setSelectedMemberIds((currentMemberIds) =>
      checked
        ? Array.from(new Set([...currentMemberIds, memberId]))
        : currentMemberIds.filter((currentMemberId) => currentMemberId !== memberId),
    );
  }

  return (
    <section className="mt-8 space-y-4">
      {smsStatus ? <SmsStatusMessage status={smsStatus} /> : null}

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Group Communication</h2>
            <p className="mt-1 text-sm text-neutral-400">
              {selectedMemberIds.length} selected for SMS
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedMemberIds(contactableMemberIds)}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-100 transition hover:border-lime-400/60 hover:text-lime-300"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={() => setSelectedMemberIds([])}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-100 transition hover:border-lime-400/60 hover:text-lime-300"
            >
              Deselect All
            </button>
            <button
              type="button"
              disabled={selectedMemberIds.length === 0}
              onClick={() => setIsComposing((currentValue) => !currentValue)}
              className="rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Contact Group
            </button>
          </div>
        </div>

        {isComposing ? (
          <form action={sendSmsAction} className="mt-5 border-t border-white/10 pt-5">
            <input type="hidden" name="groupId" value={group.id} />
            {selectedMemberIds.map((memberId) => (
              <input key={memberId} type="hidden" name="memberIds" value={memberId} />
            ))}
            <label className="block text-sm font-medium text-neutral-300">
              SMS Message
              <textarea
                name="message"
                required
                maxLength={1000}
                rows={5}
                className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
                placeholder="Type your message to the selected group members"
              />
            </label>
            <p className="mt-2 text-xs text-neutral-500">
              The message will include opt-out language. Recipients who have opted
              out are skipped automatically.
            </p>
            <AdminFormButton pendingLabel="Sending..." className="mt-4">
              Send SMS
            </AdminFormButton>
          </form>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-neutral-500">
              <tr>
                <th className="px-5 py-3 font-medium">Contact</th>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Leader</th>
                <th className="px-5 py-3 font-medium">Birthdate</th>
                <th className="px-5 py-3 font-medium">Mobile</th>
                <th className="px-5 py-3 font-medium">Email</th>
                {isEditing ? (
                  <th className="px-5 py-3 text-right font-medium">Edit</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {group.members.map((member) => {
                const hasPhone = hasContactPhone(member.mobile);

                return (
                  <tr key={member.id} className="transition hover:bg-white/[0.06]">
                    <td className="px-5 py-4">
                      <input
                        type="checkbox"
                        checked={selectedMemberIdSet.has(member.id)}
                        disabled={!hasPhone}
                        onChange={(event) =>
                          toggleMember(member.id, event.target.checked)
                        }
                        aria-label={`Select ${member.name} for SMS`}
                        className="h-4 w-4 rounded border-white/20 bg-neutral-900 text-lime-400 accent-lime-400 disabled:cursor-not-allowed disabled:opacity-40"
                      />
                    </td>
                    <td className="px-5 py-4 font-semibold text-neutral-100">
                      <div className="flex items-center gap-3">
                        {member.picture ? (
                          <img
                            src={member.picture}
                            alt={member.name}
                            className="h-8 w-8 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-400 text-xs font-bold text-neutral-950">
                            {getInitials(member.name)}
                          </span>
                        )}
                        <span>{member.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {member.isLeader ? (
                        <span
                          aria-label="Leader"
                          title="Leader"
                          className="block h-2.5 w-2.5 rounded-full bg-green-400"
                        />
                      ) : (
                        <span className="text-neutral-600">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-neutral-300">
                      {member.birthdate}
                    </td>
                    <td className="px-5 py-4 text-neutral-300">
                      {member.mobile}
                    </td>
                    <td className="px-5 py-4 text-neutral-300">
                      {member.email}
                    </td>
                    {isEditing ? (
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-4">
                          <LeaderToggle
                            groupId={group.id}
                            isLeader={member.isLeader}
                            memberId={member.id}
                            memberName={member.name}
                            updateLeaderAction={updateLeaderAction}
                          />
                          <form action={removePersonAction}>
                            <input type="hidden" name="groupId" value={group.id} />
                            <input
                              type="hidden"
                              name="personId"
                              value={member.id}
                            />
                            <button
                              type="submit"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-red-300 transition hover:border-red-300/60 hover:bg-red-400/10"
                              aria-label={`Remove ${member.name}`}
                              title={`Remove ${member.name}`}
                            >
                              <PortalIcon className="h-4 w-4" name="trash" />
                            </button>
                          </form>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function SmsStatusMessage({ status }: { status: string }) {
  const message = getSmsStatusMessage(status);
  const isError = ["config", "log-error", "missing"].includes(status);

  return (
    <p
      className={
        isError
          ? "rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-300"
          : "rounded-xl border border-lime-400/30 bg-lime-400/10 px-4 py-3 text-sm font-semibold text-lime-300"
      }
    >
      {message}
    </p>
  );
}

function getSmsStatusMessage(status: string) {
  if (status === "sent") return "SMS message queued for the selected group members.";
  if (status === "demo") return "Demo SMS message simulated.";
  if (status === "config") return "Twilio SMS is not configured correctly.";
  if (status === "log-error") return "Communication logging is not set up yet.";
  if (status === "missing") return "Select at least one member and enter a message.";

  return "SMS request completed.";
}

function hasContactPhone(value: string) {
  return Boolean(value && value.toLowerCase() !== "not listed");
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
