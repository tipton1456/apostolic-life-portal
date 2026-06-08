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
      </div>
    </main>
  );
}
