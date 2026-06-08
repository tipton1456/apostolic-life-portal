import Link from "next/link";
import PortalLogo from "../portal-logo";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <div className="flex justify-center">
          <PortalLogo className="h-auto w-64 max-w-full" />
        </div>

        <h1 className="mt-4 text-3xl font-bold">Portal Login</h1>

        <LoginForm />

        <Link
          href="/create-account"
          className="mt-6 inline-flex w-full justify-center rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:border-lime-400/60"
        >
          Create Account
        </Link>
      </div>
    </main>
  );
}
