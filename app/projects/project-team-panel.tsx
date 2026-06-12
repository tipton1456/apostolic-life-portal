import AdminFormButton from "@/app/admin/admin-form-button";
import { PortalIcon } from "@/app/icons";
import { addNewProjectParticipant, addProjectMember } from "@/lib/project-management";

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

          <div className="mt-4 space-y-4">
            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <h3 className="text-sm font-semibold text-neutral-100">
                Add user from portal
              </h3>
              <p className="mt-1 text-xs text-neutral-500">
                Choose someone already registered on the portal who is not on this
                project yet.
              </p>
              {availableUsers.length > 0 ? (
                <form action={addProjectMember} className="mt-3 space-y-3">
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
                    Add From Portal
                  </AdminFormButton>
                </form>
              ) : (
                <p className="mt-3 text-xs text-neutral-500">
                  Every eligible portal user is already on this project.
                </p>
              )}
            </section>

            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <h3 className="text-sm font-semibold text-neutral-100">Add a new user</h3>
              <p className="mt-1 text-xs text-neutral-500">
                Create a new portal account with the participant role and add them
                to this project.
              </p>
              <form action={addNewProjectParticipant} className="mt-3 space-y-3">
                <input type="hidden" name="projectId" value={projectId} />
                <ParticipantField
                  label="Email (username)"
                  name="newParticipantEmail"
                  type="email"
                  required
                />
                <ParticipantField
                  label="Mobile phone"
                  name="newParticipantPhone"
                  type="tel"
                  required
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <ParticipantField label="First name" name="newParticipantFirstName" required />
                  <ParticipantField label="Last name" name="newParticipantLastName" required />
                </div>
                <AdminFormButton
                  pendingLabel="Creating..."
                  className="rounded-lg px-3 py-2 text-sm"
                >
                  Add New User
                </AdminFormButton>
              </form>
            </section>
          </div>
        </details>
      ) : null}
    </div>
  );
}

function ParticipantField({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-medium text-neutral-400">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        className="mt-2 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none ring-lime-400 transition focus:ring-2"
      />
    </label>
  );
}

function formatNameList(names: string[]) {
  if (names.length === 0) {
    return "None";
  }

  return names.join(", ");
}