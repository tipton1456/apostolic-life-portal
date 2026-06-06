import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  addPersonToGroup,
  getLeaderGroupDetail,
  removePersonFromGroup,
  searchPeopleForGroup,
} from "@/lib/elvanto-groups";
import { createClient } from "@/lib/supabase/server";
import PortalLogo from "../../portal-logo";

type PageProps = {
  params: Promise<{
    groupId: string;
  }>;
  searchParams: Promise<{
    edit?: string;
    q?: string;
  }>;
};

export default async function GroupDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { groupId } = await params;
  const { edit, q } = await searchParams;
  const isEditing = edit === "true";
  const query = q?.trim() ?? "";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [group, searchResults] = await Promise.all([
    getLeaderGroupDetail(groupId, user.email ?? undefined),
    isEditing
      ? searchPeopleForGroup(query, user.email ?? undefined)
      : Promise.resolve([]),
  ]);

  if (!group) {
    notFound();
  }

  const existingMemberIds = new Set(group.members.map((member) => member.id));

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <Link href="/groups" className="text-sm text-lime-400 hover:text-lime-300">
          ← Back to Group Management
        </Link>

        <header className="mt-8 border-b border-white/10 pb-6">
          <PortalLogo />
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
          <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-2xl font-semibold">Add Person To Group</h2>
            <form
              action={`/groups/${group.id}`}
              className="mt-4 flex flex-col gap-3 md:flex-row"
            >
              <input type="hidden" name="edit" value="true" />
              <input
                name="q"
                defaultValue={query}
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
                placeholder="Search by name, email, or mobile"
              />
              <button
                type="submit"
                className="rounded-xl bg-lime-400 px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-lime-300"
              >
                Search
              </button>
            </form>

            {query ? (
              <div className="mt-5 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
                {searchResults.length > 0 ? (
                  searchResults.map((person) => (
                    <div
                      key={person.id}
                      className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="font-semibold text-neutral-100">
                          {person.name}
                        </p>
                        <p className="mt-1 text-sm text-neutral-400">
                          {person.email} · {person.mobile}
                        </p>
                      </div>
                      {existingMemberIds.has(person.id) ? (
                        <span className="text-sm text-neutral-500">
                          Already in group
                        </span>
                      ) : (
                        <form action={addPersonToGroup}>
                          <input type="hidden" name="groupId" value={group.id} />
                          <input type="hidden" name="personId" value={person.id} />
                          <button
                            type="submit"
                            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-100 transition hover:border-lime-400/60 hover:text-lime-300"
                          >
                            Add Person
                          </button>
                        </form>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="px-4 py-3 text-sm text-neutral-400">
                    No matching people found.
                  </p>
                )}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-neutral-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Birthdate</th>
                  <th className="px-5 py-3 font-medium">Mobile</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  {isEditing ? (
                    <th className="px-5 py-3 text-right font-medium">Remove</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {group.members.map((member) => (
                  <tr key={member.id} className="transition hover:bg-white/[0.06]">
                    <td className="px-5 py-4 font-semibold text-neutral-100">
                      {member.name}
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
