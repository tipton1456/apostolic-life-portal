import type { ReactNode } from "react";
import AdminFormButton from "@/app/admin/admin-form-button";
import { addProjectMember, removeProjectMember } from "@/lib/project-management";
import type { ProjectMember } from "@/lib/project-management";

type TeamUser = {
  id: string;
  fullName: string;
  email: string;
};

export default function ProjectTeamPanel({
  projectId,
  managers,
  members,
  canManageMembers,
  availableUsers,
}: {
  projectId: string;
  managers: TeamUser[];
  members: ProjectMember[];
  canManageMembers: boolean;
  availableUsers: TeamUser[];
}) {
  return (
    <aside className="w-full shrink-0 rounded-xl border border-white/10 bg-white/[0.03] p-4 xl:w-80">
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-400">
        Project Team
      </h2>

      <div className="mt-4 space-y-4">
        <TeamGroup
          label="Managers"
          emptyMessage="No project managers assigned."
          people={managers.map((manager) => ({
            id: manager.id,
            name: manager.fullName,
            email: manager.email,
          }))}
        />

        <TeamGroup
          label="Participants"
          emptyMessage="No participants on this project yet."
          people={members.map((member) => ({
            id: member.userId,
            name: member.fullName,
            email: member.email,
            remove: canManageMembers ? (
              <form action={removeProjectMember} className="shrink-0">
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="userId" value={member.userId} />
                <button
                  type="submit"
                  className="rounded-md px-2 py-1 text-[11px] font-semibold text-neutral-500 transition hover:bg-white/10 hover:text-red-300"
                  title={`Remove ${member.fullName}`}
                >
                  Remove
                </button>
              </form>
            ) : undefined,
          }))}
        />
      </div>

      {canManageMembers ? (
        <details className="mt-4 rounded-lg border border-white/10 bg-neutral-950/40">
          <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-semibold text-lime-300 marker:hidden">
            <span className="inline-flex w-full items-center justify-between gap-2">
              Add participant
              <span className="text-xs text-neutral-500">+</span>
            </span>
          </summary>
          <div className="border-t border-white/10 p-3">
            {availableUsers.length > 0 ? (
              <form action={addProjectMember} className="space-y-3">
                <input type="hidden" name="projectId" value={projectId} />
                <label className="block text-xs font-medium text-neutral-400">
                  Portal user
                  <select
                    name="userId"
                    required
                    className="mt-2 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none ring-lime-400 transition focus:ring-2"
                  >
                    {availableUsers.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.fullName} ({candidate.email})
                      </option>
                    ))}
                  </select>
                </label>
                <AdminFormButton
                  pendingLabel="Adding..."
                  className="w-full rounded-lg px-3 py-2 text-sm"
                >
                  Add Participant
                </AdminFormButton>
              </form>
            ) : (
              <p className="text-xs text-neutral-500">
                All portal users are already on this project.
              </p>
            )}
          </div>
        </details>
      ) : null}
    </aside>
  );
}

function TeamGroup({
  label,
  emptyMessage,
  people,
}: {
  label: string;
  emptyMessage: string;
  people: Array<{
    id: string;
    name: string;
    email: string;
    remove?: ReactNode;
  }>;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </p>
      {people.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {people.map((person) => (
            <li
              key={person.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-100">
                  {person.name}
                </p>
                <p className="truncate text-xs text-neutral-500">{person.email}</p>
              </div>
              {person.remove}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-neutral-500">{emptyMessage}</p>
      )}
    </div>
  );
}