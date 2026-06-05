import Link from "next/link";

export default function SiteNavigation() {
  return (
    <details className="group relative z-50 mt-4 mr-4 self-end">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-white/10 bg-neutral-950/95 px-4 py-3 text-sm font-semibold text-neutral-100 shadow-lg shadow-black/30 transition hover:border-lime-400/60 [&::-webkit-details-marker]:hidden">
        Menu
        <span className="text-lime-300 transition group-open:rotate-180">v</span>
      </summary>

      <nav className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-white/10 bg-neutral-950/95 p-2 shadow-xl shadow-black/40">
        <Link
          href="/dashboard"
          className="block rounded-lg px-3 py-3 text-sm font-medium text-neutral-100 transition hover:bg-white/10 hover:text-lime-300"
        >
          Dashboard
        </Link>
        <Link
          href="/contact"
          className="block rounded-lg px-3 py-3 text-sm font-medium text-neutral-100 transition hover:bg-white/10 hover:text-lime-300"
        >
          Contact Information
        </Link>
        <Link
          href="/assignments"
          className="block rounded-lg px-3 py-3 text-sm font-medium text-neutral-100 transition hover:bg-white/10 hover:text-lime-300"
        >
          Planning Center Assignments
        </Link>
      </nav>
    </details>
  );
}
