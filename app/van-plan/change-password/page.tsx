import { redirect } from "next/navigation";
import { getCurrentVanPlanUser } from "@/lib/van-plan/auth";
import { VAN_PLAN_BASE_PATH } from "@/lib/van-plan/constants";
import VanPlanChangePasswordForm from "./change-password-form";

export default async function VanPlanChangePasswordPage() {
  const user = await getCurrentVanPlanUser();

  if (!user) {
    redirect(
      `${VAN_PLAN_BASE_PATH}/login?next=${encodeURIComponent(`${VAN_PLAN_BASE_PATH}/change-password`)}`,
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <p className="vp-subhead text-sm">account</p>
      <h1 className="vp-heading mt-2 text-4xl">Change password</h1>
      <p className="vp-description mt-4 leading-7">
        {user.mustResetPassword
          ? "Your account has a temporary password. Enter it below, then choose a new one before bidding."
          : "Choose a new password for your auction account. This is separate from the church portal password."}
      </p>
      <VanPlanChangePasswordForm mustReset={user.mustResetPassword} />
    </main>
  );
}
