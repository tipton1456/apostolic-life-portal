import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChangePasswordForm from "./change-password-form";

export default async function ChangePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 py-8 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
          Portal Security
        </p>
        <h1 className="mt-3 text-3xl font-bold">Change Password</h1>
        <p className="mt-3 text-sm leading-6 text-neutral-400">
          Your temporary password needs to be replaced before continuing.
        </p>
        <ChangePasswordForm />
      </div>
    </main>
  );
}
