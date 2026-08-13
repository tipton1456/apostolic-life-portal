import { redirect } from "next/navigation";
import { getCurrentVanPlanUser } from "@/lib/van-plan/auth";
import { VAN_PLAN_BASE_PATH } from "@/lib/van-plan/constants";
import VanPlanAccountForm from "./account-form";

export default async function VanPlanAccountPage() {
  const user = await getCurrentVanPlanUser();

  if (!user) {
    redirect(
      `${VAN_PLAN_BASE_PATH}/login?next=${encodeURIComponent(`${VAN_PLAN_BASE_PATH}/account`)}`,
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="vp-subhead text-sm">account</p>
      <h1 className="vp-heading mt-2 text-4xl">Your information</h1>
      <p className="vp-description mt-4 leading-7">
        Keep your phone and mailing address current so invoices and pickup
        details go to the right place.
      </p>
      <VanPlanAccountForm user={user} />
    </main>
  );
}
