export default function ContactPage() {
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
          <p className="mt-3 max-w-2xl text-neutral-400">
            This page will display member and family contact information from
            Elvanto.
          </p>
        </header>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-xl font-semibold">Coming Next</h2>
          <p className="mt-3 text-neutral-400">
            The next step is connecting this page to sample household data, then
            replacing the sample data with Elvanto API results.
          </p>
        </section>
      </div>
    </main>
  );
}