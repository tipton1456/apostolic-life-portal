import { redirect } from "next/navigation";
import { getHousehold, updateContactFromForm } from "@/lib/elvanto";
import { getPlanningCenterProfilePicture } from "@/lib/planning-center";
import { createClient } from "@/lib/supabase/server";
import ContactSaveButton from "./contact-save-button";

type PageProps = {
  searchParams: Promise<{
    updated?: string;
  }>;
};

export default async function ContactPage({ searchParams }: PageProps) {
  const { updated } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [household, planningCenterProfilePicture] = await Promise.all([
    getHousehold(user.email ?? undefined),
    getPlanningCenterProfilePicture(user.email ?? undefined),
  ]);
  const primaryPicture = household
    ? getPrimaryPicture(
        planningCenterProfilePicture,
        household.primary.picture,
        updated,
      )
    : undefined;

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Contact Information
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            My Household
          </h1>
          <p className="mt-3 max-w-2xl text-neutral-400">
            Update contact details connected to your household.
          </p>

          {updated ? (
            <p className="mt-4 rounded-xl border border-lime-400/30 bg-lime-400/10 px-4 py-3 text-sm font-semibold text-lime-300">
              {getUpdateMessage(updated)}
            </p>
          ) : null}
        </header>

        {household ? (
          <>
            <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-start gap-4">
                {primaryPicture ? (
                  <img
                    src={primaryPicture}
                    alt={`${household.primary.firstName} ${household.primary.lastName}`}
                    className="h-20 w-20 shrink-0 rounded-full object-cover"
                  />
                ) : null}
                <h2 className="text-2xl font-semibold">
                  {household.primary.firstName} {household.primary.lastName}
                </h2>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Info label="Email" value={household.primary.email} />
                <Info label="Phone" value={household.primary.phone} />
                <Info label="Mobile" value={household.primary.mobile} />
                <Info label="Birthdate" value={household.primary.birthday} />
                <Info label="Address" value={household.primary.address} />
              </div>

              <details className="group mt-6">
                <UpdateContactSummary />

                <form
                  action={updateContactFromForm}
                  className="mt-5 border-t border-white/10 pt-5"
                >
                  <input
                    type="hidden"
                    name="personId"
                    value={household.primary.id}
                  />
                  <input type="hidden" name="personType" value="primary" />

                  <div className="grid gap-4 md:grid-cols-2">
                    <TextInput
                      label="Phone"
                      name="phone"
                      defaultValue={editableValue(household.primary.phone)}
                    />
                    <TextInput
                      label="Mobile"
                      name="mobile"
                      defaultValue={editableValue(household.primary.mobile)}
                    />
                    <DateInput
                      label="Birthdate"
                      name="birthday"
                      defaultValue={household.primary.birthdayValue}
                    />
                    <FileInput label="Profile Picture" name="profilePicture" />
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <TextInput
                      label="Address"
                      name="addressLine1"
                      defaultValue={household.primary.addressFields.line1}
                    />
                    <TextInput
                      label="Address 2"
                      name="addressLine2"
                      defaultValue={household.primary.addressFields.line2}
                    />
                    <TextInput
                      label="City"
                      name="city"
                      defaultValue={household.primary.addressFields.city}
                    />
                    <TextInput
                      label="State"
                      name="state"
                      defaultValue={household.primary.addressFields.state}
                    />
                    <TextInput
                      label="Zip"
                      name="postcode"
                      defaultValue={household.primary.addressFields.postcode}
                    />
                    <TextInput
                      label="Country"
                      name="country"
                      defaultValue={household.primary.addressFields.country}
                    />
                  </div>

                  <ContactSaveButton label="Save My Contact Information" />
                </form>
              </details>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-semibold">Family Members</h2>

              {household.family.length > 0 ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {household.family.map((person) => (
                    <article
                      key={`${person.firstName}-${person.lastName}-${person.relationship}`}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                    >
                      <div className="flex items-start gap-4">
                        {person.picture ? (
                          <img
                            src={person.picture}
                            alt={`${person.firstName} ${person.lastName}`}
                            className="h-16 w-16 shrink-0 rounded-full object-cover"
                          />
                        ) : null}
                        <div>
                          <p className="text-lg font-semibold">
                            {person.firstName} {person.lastName}
                          </p>
                          <p className="mt-1 text-sm text-lime-400">
                            {person.relationship}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-3">
                        <Info label="Email" value={person.email} />
                        <Info label="Phone" value={person.phone} />
                        <Info label="Mobile" value={person.mobile} />
                        <Info label="Birthdate" value={person.birthday} />
                      </div>

                      <details className="group mt-5">
                        <UpdateContactSummary />

                        <form
                          action={updateContactFromForm}
                          className="mt-5 border-t border-white/10 pt-5"
                        >
                          <input
                            type="hidden"
                            name="personId"
                            value={person.id}
                          />
                          <input type="hidden" name="personType" value="family" />
                          <div className="space-y-3">
                            <TextInput
                              label="Email"
                              name="email"
                              type="email"
                              defaultValue={editableValue(person.email)}
                            />
                            <TextInput
                              label="Phone"
                              name="phone"
                              defaultValue={editableValue(person.phone)}
                            />
                            <TextInput
                              label="Mobile"
                              name="mobile"
                              defaultValue={editableValue(person.mobile)}
                            />
                            <DateInput
                              label="Birthdate"
                              name="birthday"
                              defaultValue={person.birthdayValue}
                            />
                          </div>
                          <ContactSaveButton label={`Save ${person.firstName}`} />
                        </form>
                      </details>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <p className="text-neutral-300">
                    No additional household members are currently connected to
                    this Elvanto profile.
                  </p>
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-2xl font-semibold">No household found</h2>
            <p className="mt-3 max-w-2xl text-neutral-400">
              We could not find an Elvanto contact using your portal login
              email, or the shared Elvanto connection is not configured yet.
              Contact the church office if your portal email needs to be
              updated in either system.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-neutral-200">{value}</p>
    </div>
  );
}

function UpdateContactSummary() {
  return (
    <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-neutral-100 transition hover:border-lime-400/60 hover:text-lime-300 group-open:border-lime-400/60 group-open:text-lime-300 [&::-webkit-details-marker]:hidden">
      <PencilIcon />
      <span>Update Contact</span>
    </summary>
  );
}

function PencilIcon() {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TextInput({
  defaultValue,
  label,
  name,
  type = "text",
}: {
  defaultValue: string;
  label: string;
  name: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">
        {label}
      </span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-neutral-100 outline-none ring-lime-400 transition focus:ring-2"
      />
    </label>
  );
}

function DateInput({
  defaultValue,
  label,
  name,
}: {
  defaultValue: string;
  label: string;
  name: string;
}) {
  return (
    <TextInput
      defaultValue={defaultValue}
      label={label}
      name={name}
      type="date"
    />
  );
}

function FileInput({ label, name }: { label: string; name: string }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">
        {label}
      </span>
      <input
        type="file"
        name={name}
        accept="image/*"
        className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 outline-none ring-lime-400 transition file:mr-4 file:rounded-lg file:border-0 file:bg-lime-400 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-neutral-950 hover:file:bg-lime-300 focus:ring-2"
      />
      <span className="mt-1 block text-xs text-neutral-500">
        JPG, PNG, or WebP under 5MB. Photo uploads sync to Planning Center when
        matched.
      </span>
    </label>
  );
}

function editableValue(value: string) {
  return value === "Not listed" ? "" : value;
}

function getPrimaryPicture(
  planningCenterProfilePicture: string | null,
  elvantoPicture: string | undefined,
  updated: string | undefined,
) {
  const picture = planningCenterProfilePicture ?? elvantoPicture;

  if (!picture) return undefined;
  if (!updated || !planningCenterProfilePicture) return picture;

  const separator = picture.includes("?") ? "&" : "?";

  return `${picture}${separator}updated=${encodeURIComponent(updated)}`;
}

function getUpdateMessage(updated: string) {
  if (updated === "synced") {
    return "Contact information saved in Elvanto. Matching updates were also sent to Planning Center.";
  }

  if (updated === "partial") {
    return "Contact information saved in Elvanto. Planning Center did not complete the update.";
  }

  return "Contact information saved in Elvanto.";
}
