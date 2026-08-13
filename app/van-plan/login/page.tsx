import Link from "next/link";
import { redirect } from "next/navigation";
import { countVanPlanUsers, getCurrentVanPlanUser } from "@/lib/van-plan/auth";
import { VAN_PLAN_BASE_PATH, VAN_PLAN_TITLE } from "@/lib/van-plan/constants";
import { sanitizeNextPathSafe } from "@/lib/van-plan/security";
import VanPlanLoginForm from "./login-form";

export default async function VanPlanLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const userCount = await countVanPlanUsers();

  if (userCount === 0) {
    redirect(`${VAN_PLAN_BASE_PATH}/setup`);
  }

  const currentUser = await getCurrentVanPlanUser();
  const params = (await searchParams) ?? {};
  const nextPath = sanitizeNextPathSafe(params.next ?? VAN_PLAN_BASE_PATH);

  if (currentUser) {
    redirect(nextPath);
  }

  return (
    <main className="mx-auto flex max-w-md flex-col px-6 py-12">
      <p className="vp-subhead text-sm">welcome</p>
      <h1 className="vp-heading mt-2 text-4xl">Sign in</h1>
      <p className="vp-description mt-4 leading-7">
        Use the name on file with your email and phone number to enter{" "}
        {VAN_PLAN_TITLE}.
      </p>
      <VanPlanLoginForm nextPath={nextPath} />
      <p className="vp-accent mt-8 text-sm">
        need an account? ask an auction admin to add you.
      </p>
      <Link href={VAN_PLAN_BASE_PATH} className="vp-subhead mt-4 text-sm">
        back to the auction
      </Link>
    </main>
  );
}
