import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sendGroupEmail, sendGroupSms } from "@/lib/communications";
import {
  addPersonToGroup,
  getLeaderGroupDetail,
  removePersonFromGroup,
  updateGroupMemberLeader,
} from "@/lib/elvanto-groups";
import { getCurrentSessionUser } from "@/lib/demo";
import GroupCommunicationPanel from "./group-communication-panel";
import GroupMemberSearch from "./group-member-search";

type PageProps = {
  params: Promise<{
    groupId: string;
  }>;
  searchParams: Promise<{
    edit?: string;
    email?: string;
    sms?: string;
  }>;
};

export default async function GroupDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { groupId } = await params;
  const { edit, email, sms } = await searchParams;
  const isEditing = edit === "true";
  const user = await getCurrentSessionUser();

  if (!user) {
    redirect("/login");
  }

  const group = await getLeaderGroupDetail(groupId, user.email ?? undefined);

  if (!group) {
    notFound();
  }

  const existingMemberIds = group.members.map((member) => member.id);

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Group Management
          </p>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">
                {group.name}
              </h1>
              <p className="mt-3 text-neutral-400">
                {group.members.length} members
              </p>
            </div>
            <Link
              href={isEditing ? `/groups/${group.id}` : `/groups/${group.id}?edit=true`}
              className={
                isEditing
                  ? "rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-neutral-100 transition hover:border-lime-400/60"
                  : "rounded-xl bg-lime-400 px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-lime-300"
              }
            >
              {isEditing ? "Done Editing" : "Edit Group"}
            </Link>
          </div>
        </header>

        {isEditing ? (
          <GroupMemberSearch
            addPersonAction={addPersonToGroup}
            existingMemberIds={existingMemberIds}
            groupId={group.id}
          />
        ) : null}

        <GroupCommunicationPanel
          group={group}
          isEditing={isEditing}
          removePersonAction={removePersonFromGroup}
          sendEmailAction={sendGroupEmail}
          sendSmsAction={sendGroupSms}
          emailStatus={email}
          smsStatus={sms}
          updateLeaderAction={updateGroupMemberLeader}
        />
      </div>
    </main>
  );
}
