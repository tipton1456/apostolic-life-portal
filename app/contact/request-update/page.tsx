import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RequestUpdatePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  async function submitRequest(formData: FormData) {
    "use server";

    const request = String(formData.get("request") || "").trim();

    if (!request) {
      return;
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    await supabase.from("contact_update_requests").insert({
      user_id: user.id,
      request,
    });

    redirect("/contact?request=submitted");
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <a href="/contact" className="text-sm text-lime-400 hover:text-lime-300">
          ← Back to Contact Information
        </a>

        <header className="mt-8 border-b border-white/10 pb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
            Request Update
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Update Contact Information
          </h1>
          <p className="mt-3 text-neutral-400">
            Tell us what needs to be corrected. The church office will review
            the request before anything is changed in Elvanto.
          </p>
        </header>

        <form action={submitRequest} className="mt-8 space-y-4">
          <textarea
            name="request"
            required
            rows={8}
            className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none ring-lime-400 transition focus:ring-2"
            placeholder="Example: Please update Kyla's phone number to..."
          />

          <button
            type="submit"
            className="rounded-xl bg-lime-400 px-5 py-3 font-semibold text-neutral-950 transition hover:bg-lime-300"
          >
            Submit Request
          </button>
        </form>
      </div>
    </main>
  );
}