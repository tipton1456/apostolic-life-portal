import Link from "next/link";
import { VAN_PLAN_BASE_PATH, VAN_PLAN_TITLE } from "@/lib/van-plan/constants";
import VanPlanForgotPasswordForm from "./forgot-password-form";

export default function VanPlanForgotPasswordPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <p className="vp-subhead text-sm">account</p>
      <h1 className="vp-heading mt-2 text-4xl">Forgot password</h1>
      <p className="vp-description mt-4 leading-7">
        Enter the email on your {VAN_PLAN_TITLE} account. If we find it, we
        will text a temporary password and a link to set a new one.
      </p>
      <VanPlanForgotPasswordForm />
      <Link href={`${VAN_PLAN_BASE_PATH}/login`} className="vp-subhead mt-8 inline-block text-sm">
        back to sign in
      </Link>
    </main>
  );
}
