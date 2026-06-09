import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  addPersonToGroup,
  getLeaderGroupDetail,
  removePersonFromGroup,
  updateGroupMemberLeader,
} from "@/lib/elvanto-groups";
import { getCurrentSessionUser } from "@/lib/demo";
import GroupMemberSearch from "./group-member-search";
import LeaderToggle from "./leader-toggle";

type PageProps = {
  params: Promise<{
    groupId: string;
  }>;
  searchParams: Promise<{
    edit?: string;
  }>;
};

export default async function GroupDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { groupId } = await params;
  const { edit } = await searchParams;
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

        <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-neutral-500">
                <tr>
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
                {group.members.map((member) => (
                  <tr key={member.id} className="transition hover:bg-white/[0.06]">
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
                            updateLeaderAction={updateGroupMemberLeader}
                          />
                          <form action={removePersonFromGroup}>
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
                              <TrashIcon />
                            </button>
                          </form>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
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
