import { redirect } from "next/navigation";
import Link from "next/link";
import { getHousehold } from "@/lib/elvanto";
import { createClient } from "@/lib/supabase/server";

export default async function ContactPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const household = await getHousehold(user.email ?? undefined);

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/dashboard"
          className="text-sm text-lime-400 hover:text-lime-300"
        >
          ← Back to Dashboard
        </Link>

        <header className="mt-8 border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Contact Information
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            My Household
          </h1>
          <p className="mt-3 max-w-2xl text-neutral-400">
            Review the contact information connected to your household.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/contact/request-update"
              className="inline-flex rounded-xl bg-lime-400 px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-lime-300"
            >
              Request Contact Update
            </Link>
          </div>
        </header>

        {household ? (
          <>
            <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-start gap-4">
                {household.primary.picture ? (
                  <img
                    src={household.primary.picture}
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
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-semibold">Family Members</h2>

              {household.family.length > 0 ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {household.family.map((person) => (
                    <div
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
                    </div>
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
