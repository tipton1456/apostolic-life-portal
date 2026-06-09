import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalIcon } from "@/app/icons";
import {
  getHouseholdForAdminClone,
  updateContactFromAdminClone,
  type Household,
  type HouseholdPerson,
} from "@/lib/elvanto";
import {
  hasPlanningCenterPersonForEmail,
  getUpcomingAssignments,
  getUpcomingAssignmentsForEmail,
  type UpcomingAssignment,
} from "@/lib/planning-center";
import { getCurrentPortalUser, hasPortalUserForEmail } from "@/lib/portal-users";
import CloneContactUpdateForm from "./clone-contact-update-form";

type PageProps = {
  searchParams: Promise<{
    email?: string;
    updated?: string;
  }>;
};

export default async function CloneDashboardPage({ searchParams }: PageProps) {
  const currentUser = await getCurrentPortalUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (!currentUser.isAdmin) {
    redirect("/dashboard");
  }

  const { email: emailParam, updated } = await searchParams;
  const email = normalizeEmail(emailParam);
  const [household, assignments, hasPortalAccount, hasPlanningCenterAccount] = email
    ? await Promise.all([
        getHouseholdForAdminClone(email),
        getUpcomingAssignments(email, 10),
        hasPortalUserForEmail(email),
        hasPlanningCenterPersonForEmail(email),
      ])
    : [null, [], false, false];
  const familyAssignments =
    household && email
      ? await getFamilyAssignmentSections(household.family, email, 10)
      : [];

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Administration
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Clone Dashboard
          </h1>
          <p className="mt-3 max-w-3xl text-neutral-400">
            Enter a member email to preview their household and Planning Center
            assignment data for troubleshooting.
          </p>
          {updated ? (
            <p className="mt-4 rounded-xl border border-lime-400/30 bg-lime-400/10 px-4 py-3 text-sm font-semibold text-lime-300">
              {getUpdateMessage(updated)}
            </p>
          ) : null}
        </header>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <form className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="flex-1 text-sm font-medium text-neutral-300">
              Member Email
              <input
                type="email"
                name="email"
                defaultValue={email}
                placeholder="member@example.com"
                className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
                required
              />
            </label>
            <button
              type="submit"
              className="rounded-xl bg-lime-400 px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-lime-300"
            >
              Load Dashboard
            </button>
          </form>
        </section>

        {!email ? (
          <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold">Choose a member</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              Search by email to load a read-only clone view.
            </p>
          </section>
        ) : (
          <section className="mt-8 space-y-8">
            <AccountStatusGrid
              statuses={[
                {
                  isReady: hasPortalAccount,
                  label: "Portal",
                  readyText: "Portal account found",
                  warningText: "No portal account found",
                },
                {
                  isReady: Boolean(household),
                  label: "Elvanto",
                  readyText: "Elvanto profile found",
                  warningText: "No Elvanto profile found",
                },
                {
                  isReady: hasPlanningCenterAccount,
                  label: "Planning Center",
                  readyText: "Planning Center person found",
                  warningText: "No Planning Center person found",
                },
              ]}
            />
            <CloneSummary email={email} household={household} />
            <ContactSection email={email} household={household} />
            <AssignmentsSection
              assignments={assignments}
              email={email}
              title="Member Assignments"
            />
            <FamilyAssignmentsSection
              familyAssignments={familyAssignments}
              hasHousehold={Boolean(household)}
            />
          </section>
        )}
      </div>
    </main>
  );
}

type AccountStatus = {
  isReady: boolean;
  label: string;
  readyText: string;
  warningText: string;
};

function AccountStatusGrid({ statuses }: { statuses: AccountStatus[] }) {
  return (
    <section className="grid gap-3 md:grid-cols-3">
      {statuses.map((status) => (
        <article
          key={status.label}
          className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              status.isReady
                ? "bg-green-400/15 text-green-300"
                : "bg-yellow-400/15 text-yellow-300"
            }`}
          >
            <PortalIcon
              className="h-5 w-5"
              name={status.isReady ? "check" : "caution"}
            />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-neutral-100">
              {status.label}
            </h2>
            <p
              className={`mt-0.5 text-xs ${
                status.isReady ? "text-green-200/80" : "text-yellow-200/80"
              }`}
            >
              {status.isReady ? status.readyText : status.warningText}
            </p>
          </div>
        </article>
      ))}
    </section>
  );
}

function CloneSummary({
  email,
  household,
}: {
  email: string;
  household: Household | null;
}) {
  return (
    <div className="rounded-2xl border border-lime-400/20 bg-lime-400/10 p-5">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lime-300">
        Viewing As
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-lime-50">
        {household
          ? `${household.primary.firstName} ${household.primary.lastName}`
          : email}
      </h2>
      <p className="mt-2 text-sm text-lime-50/80">
        This admin troubleshooting view does not change the active portal
        session, and giving records are intentionally not loaded. Contact
        changes require opening an Update Contact form.
      </p>
    </div>
  );
}

function ContactSection({
  email,
  household,
}: {
  email: string;
  household: Household | null;
}) {
  if (!household) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-xl font-semibold">No household found</h2>
        <p className="mt-3 text-sm leading-6 text-neutral-400">
          Elvanto did not return household details for {email}.
        </p>
      </div>
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-start gap-4">
          {household.primary.picture ? (
            <img
              src={household.primary.picture}
              alt={`${household.primary.firstName} ${household.primary.lastName}`}
              className="h-16 w-16 shrink-0 rounded-full object-cover"
            />
          ) : null}
          <div>
            <h2 className="text-2xl font-semibold">
              {household.primary.firstName} {household.primary.lastName}
            </h2>
            <p className="mt-1 text-sm text-lime-300">Primary Contact</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 text-sm">
          <Info label="Email" value={household.primary.email} />
          <Info label="Phone" value={formatUsPhone(household.primary.phone)} />
          <Info label="Mobile" value={formatUsPhone(household.primary.mobile)} />
          <Info label="Birthdate" value={household.primary.birthday} />
          <Info label="Address" value={household.primary.address} />
        </div>
        <AdminContactUpdateDetails
          cloneEmail={email}
          person={household.primary}
        />
      </article>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-2xl font-semibold">Family Contacts</h2>
        {household.family.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {household.family.map((person) => (
              <article
                key={person.id}
                className="rounded-xl border border-white/10 bg-neutral-950/50 p-4"
              >
                <div className="flex items-start gap-3">
                  {person.picture ? (
                    <img
                      src={person.picture}
                      alt={`${person.firstName} ${person.lastName}`}
                      className="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                  ) : null}
                  <div>
                    <p className="font-semibold text-neutral-100">
                      {person.firstName} {person.lastName}
                    </p>
                    <p className="text-xs font-semibold text-lime-300">
                      {person.relationship || "Family Member"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <Info label="Email" value={person.email} />
                  <Info label="Phone" value={formatUsPhone(person.phone)} />
                  <Info label="Mobile" value={formatUsPhone(person.mobile)} />
                  <Info label="Birthdate" value={person.birthday} />
                </div>
                <AdminContactUpdateDetails cloneEmail={email} person={person} />
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-neutral-400">
            No family members are connected to this Elvanto profile.
          </p>
        )}
      </section>
    </section>
  );
}

function AdminContactUpdateDetails({
  cloneEmail,
  person,
}: {
  cloneEmail: string;
  person: HouseholdPerson;
}) {
  return (
    <details className="group mt-5">
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-neutral-100 transition hover:border-lime-400/60 hover:text-lime-300 group-open:border-lime-400/60 group-open:text-lime-300 [&::-webkit-details-marker]:hidden">
        <PortalIcon className="h-4 w-4" name="update" />
        <span>Update Contact</span>
      </summary>

      <CloneContactUpdateForm
        action={updateContactFromAdminClone}
        cloneEmail={cloneEmail}
        person={person}
      />
    </details>
  );
}

function AssignmentsSection({
  assignments,
  email,
  title,
}: {
  assignments: UpcomingAssignment[];
  email: string;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="border-b border-white/10 px-5 py-4">
        <h2 className="text-2xl font-semibold">{title}</h2>
      </div>
      {assignments.length > 0 ? (
        <AssignmentTable assignments={assignments} />
      ) : (
        <div className="p-6">
          <p className="text-sm text-neutral-400">
            No Planning Center assignments found for {email}.
          </p>
        </div>
      )}
    </section>
  );
}

function FamilyAssignmentsSection({
  familyAssignments,
  hasHousehold,
}: {
  familyAssignments: FamilyAssignmentSection[];
  hasHousehold: boolean;
}) {
  if (!hasHousehold) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-2xl font-semibold">Family Assignments</h2>
      {familyAssignments.length > 0 ? (
        <div className="mt-4 space-y-4">
          {familyAssignments.map((section) => (
            <div
              key={section.id}
              className="overflow-hidden rounded-xl border border-white/10 bg-neutral-950/40"
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <div>
                  <p className="font-semibold text-neutral-100">{section.name}</p>
                  <p className="text-xs text-neutral-400">
                    {section.relationship || "Family Member"}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-neutral-400">
                  {section.assignments.length || "No"} assignments
                </span>
              </div>
              {section.assignments.length > 0 ? (
                <AssignmentTable assignments={section.assignments} />
              ) : (
                <p className="p-4 text-sm text-neutral-400">No Assignments</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-neutral-400">
          No additional household members are connected to this profile.
        </p>
      )}
    </section>
  );
}

function AssignmentTable({
  assignments,
}: {
  assignments: UpcomingAssignment[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-neutral-500">
          <tr>
            <th className="px-5 py-3 font-medium">Date</th>
            <th className="px-5 py-3 font-medium">Plan</th>
            <th className="px-5 py-3 font-medium">Position</th>
            <th className="px-5 py-3 font-medium">Team</th>
            <th className="px-5 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {assignments.map((assignment) => (
            <tr key={assignment.id} className="transition hover:bg-white/[0.06]">
              <td className="px-5 py-4 font-semibold text-lime-300">
                <Link href={assignment.detailHref}>{assignment.dates}</Link>
              </td>
              <td className="px-5 py-4 text-neutral-100">
                <Link href={assignment.detailHref}>
                  {assignment.serviceTypeName}
                </Link>
              </td>
              <td className="px-5 py-4 text-neutral-300">
                {assignment.position}
              </td>
              <td className="px-5 py-4 text-neutral-300">{assignment.team}</td>
              <td className="px-5 py-4">
                <StatusDot status={assignment.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type FamilyAssignmentSection = {
  assignments: UpcomingAssignment[];
  id: string;
  name: string;
  relationship?: string;
};

async function getFamilyAssignmentSections(
  family: Household["family"],
  userEmail: string | undefined,
  limit: number,
): Promise<FamilyAssignmentSection[]> {
  return Promise.all(
    family.map(async (person) => {
      const name = [person.firstName, person.lastName].filter(Boolean).join(" ");
      const email = normalizeEmail(person.email);
      const isSharedEmail = Boolean(
        email && userEmail && email === userEmail.toLowerCase(),
      );
      const assignments =
        email && !isSharedEmail
          ? await getUpcomingAssignmentsForEmail(email, limit)
          : [];

      return {
        assignments,
        id: person.id,
        name: name || "Family Member",
        relationship: person.relationship,
      };
    }),
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-neutral-200">{value || "Not listed"}</p>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-neutral-300">
      <span
        aria-label={`${status} status`}
        title={status}
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${getStatusColor(status)}`}
      />
      {status}
    </span>
  );
}

function getStatusColor(status: string) {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === "declined") return "bg-red-400";
  if (normalizedStatus === "confirmed") return "bg-green-400";

  return "bg-yellow-400";
}

function normalizeEmail(email?: string) {
  const normalized = email?.trim().toLowerCase();

  if (!normalized || normalized === "not listed") return "";

  return normalized;
}

function formatUsPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return phone;
}

function getUpdateMessage(updated: string) {
  if (updated === "synced") {
    return "Contact updated in Elvanto and synced to Planning Center where matched.";
  }

  if (updated === "partial") {
    return "Contact updated in Elvanto, but Planning Center sync needs review.";
  }

  if (updated === "photo-error") {
    return "Photo upload failed. Please use a JPG, PNG, or WebP image under 5MB.";
  }

  if (updated === "contact-error") {
    return "Contact update failed. Please review the contact fields and try again.";
  }

  return "Contact updated in Elvanto. No matching Planning Center person was found.";
}
