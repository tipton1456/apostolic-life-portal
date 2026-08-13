import { redirect } from "next/navigation";
import { countVanPlanUsers } from "@/lib/van-plan/auth";
import { VAN_PLAN_BASE_PATH, VAN_PLAN_TITLE } from "@/lib/van-plan/constants";
import VanPlanSetupForm from "./setup-form";

export default async function VanPlanSetupPage() {
  const userCount = await countVanPlanUsers();

  if (userCount > 0) {
    redirect(`${VAN_PLAN_BASE_PATH}/login`);
  }

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <p className="vp-subhead text-sm">first-time setup</p>
      <h1 className="vp-heading mt-2 text-4xl">Create the admin</h1>
      <p className="vp-description mt-4 leading-7">
        This auction has its own sign-in. Create the first {VAN_PLAN_TITLE} admin
        with a name, email, phone number, and a strong password. That person
        can then add auctioneers and bidders.
      </p>
      <VanPlanSetupForm />
    </main>
  );
}
