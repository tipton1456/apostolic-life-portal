export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
        <header className="mb-10 border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Apostolic Life
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Member Portal
          </h1>
          <p className="mt-3 max-w-2xl text-neutral-400">
            A simple place for members to view contact information, family
            details, schedules, events, and future church resources.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          <a
			  href="/contact"
			  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-lime-400/60 hover:bg-white/[0.06]"
			>
            <h2 className="text-xl font-semibold">Contact Information</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              View your contact details and submit update requests.
            </p>
          </a>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold">Family Members</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              See household information connected through Elvanto.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold">Request Changes</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              Send updated phone, email, address, or family details for review.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}