import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-lime-400">
          Apostolic Life
        </p>

        <h1 className="mt-4 text-3xl font-bold">Member Login</h1>

        <p className="mt-3 text-sm leading-6 text-neutral-400">
          Sign in with your email address to access your household information.
        </p>

        <LoginForm />
      </div>
    </main>
  );
}