import PortalLogo from "../portal-logo";
import LoginForm from "./login-form";
import { sanitizeNextPath } from "@/lib/portal-url";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const nextPath = sanitizeNextPath(params.next ?? "/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <div className="flex justify-center">
          <PortalLogo className="h-auto w-64 max-w-full" />
        </div>

        <div className="mt-6">
          <LoginForm nextPath={nextPath} />
        </div>
      </div>
    </main>
  );
}