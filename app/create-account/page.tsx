import Link from "next/link";
import PortalLogo from "../portal-logo";
import CreateAccountForm from "./create-account-form";

export default function CreateAccountPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 py-8 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <PortalLogo className="h-auto w-64 max-w-full" />

        <h1 className="mt-4 text-3xl font-bold">Create Account</h1>

        <p className="mt-3 text-sm leading-6 text-neutral-400">
          Use the same email address that is listed in Elvanto. After submitting
          this form, check your email and click the confirmation link. Once your
          email is confirmed, you will be sent back to the login page.
        </p>

        <CreateAccountForm />

        <Link
          href="/login"
          className="mt-6 inline-flex text-sm text-lime-400 hover:text-lime-300"
        >
          Back to login
        </Link>
      </div>
    </main>
  );
}
