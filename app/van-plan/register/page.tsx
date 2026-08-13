import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentVanPlanUser } from "@/lib/van-plan/auth";
import { VAN_PLAN_BASE_PATH, VAN_PLAN_TITLE } from "@/lib/van-plan/constants";
import VanPlanRegisterForm from "./register-form";

export default async function VanPlanRegisterPage() {
  const user = await getCurrentVanPlanUser();

  if (user) {
    redirect(VAN_PLAN_BASE_PATH);
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="vp-subhead text-sm">join the auction</p>
      <h1 className="vp-heading mt-2 text-4xl">Create an account</h1>
      <p className="vp-description mt-4 leading-7">
        Create your own {VAN_PLAN_TITLE} bidder account. Use your email as your
        username, choose a strong password, and enter a mailing address so we
        can invoice the winning bid.
      </p>
      <VanPlanRegisterForm />
      <p className="vp-accent mt-8 text-sm">
        already have an account?{" "}
        <Link href={`${VAN_PLAN_BASE_PATH}/login`} className="underline">
          sign in
        </Link>
      </p>
    </main>
  );
}
