import { redirect } from "next/navigation";
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
        <a href="/" className="text-sm text-lime-400 hover:text-lime-300">
          ← Back to Dashboard
        </a>

        <header className="mt-8 border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Contact Information
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            My Household
          </h1>
         <p className="mt-4 rounded-xl border border-lime-400/20 bg-lime-400/10 px-4 py-3 text-sm text-lime-200">
		  Signed in as {user.email}
		</p>
		  <a
			  href="/api/elvanto/connect"
			  className="mt-4 inline-flex rounded-xl bg-lime-400 px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-lime-300"
			>
			  Connect Elvanto
			</a>      
		</header>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-2xl font-semibold">
            {household.primary.firstName} {household.primary.lastName}
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Info label="Email" value={household.primary.email} />
            <Info label="Phone" value={household.primary.phone} />
            <Info label="Address" value={household.primary.address} />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold">Family Members</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {household.family.map((person) => (
              <div
                key={`${person.firstName}-${person.lastName}`}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <p className="text-lg font-semibold">
                  {person.firstName} {person.lastName}
                </p>
                <p className="mt-1 text-sm text-lime-400">
                  {person.relationship}
                </p>
                <div className="mt-4 space-y-3">
                  <Info label="Email" value={person.email || "Not listed"} />
                  <Info label="Phone" value={person.phone || "Not listed"} />
                </div>
              </div>
            ))}
          </div>
        </section>
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