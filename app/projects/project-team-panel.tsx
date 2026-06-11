import AdminFormButton from "@/app/admin/admin-form-button";
import { PortalIcon } from "@/app/icons";
import { addProjectMember } from "@/lib/project-management";

export default function ProjectTeamPanel({
  projectId,
  managerNames,
  participantNames,
  canManageMembers,
  availableUsers,
}: {
  projectId: string;
  managerNames: string[];
  participantNames: string[];
  canManageMembers: boolean;
  availableUsers: Array<{ id: string; fullName: string; email: string }>;
}) {
  return (
    <div className="min-w-0 text-sm leading-6 text-neutral-300 lg:max-w-xs xl:max-w-sm">
      <p>
        <span className="font-semibold text-neutral-200">PM:</span>{" "}
        {formatNameList(managerNames)}
      </p>
      <p className="mt-2">
        <span className="font-semibold text-neutral-200">participants:</span>{" "}
        {formatNameList(participantNames)}
      </p>

      {canManageMembers ? (
        <details className="mt-4">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-lime-400 marker:hidden hover:text-lime-300">
            <PortalIcon className="h-4 w-4" name="userPlus" />
            Add participant
          </summary>
          <div className="mt-3">
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
                  className="rounded-lg px-3 py-2 text-sm"
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
    </div>
  );
}

function formatNameList(names: string[]) {
  if (names.length === 0) {
    return "None";
  }

  return names.join(", ");
}