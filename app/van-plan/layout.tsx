import type { Metadata } from "next";
import { getCurrentVanPlanUser } from "@/lib/van-plan/auth";
import { VAN_PLAN_SUBTITLE, VAN_PLAN_TITLE } from "@/lib/van-plan/constants";
import { hasAdminClientConfig } from "@/lib/supabase/admin";
import VanPlanHeader from "./components/header";
import VanPlanMustResetGate from "./components/must-reset-gate";
import VanPlanNav from "./components/nav";
import "./van-plan.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: `${VAN_PLAN_TITLE} ${VAN_PLAN_SUBTITLE}`,
    template: `%s | ${VAN_PLAN_TITLE}`,
  },
  description: `${VAN_PLAN_TITLE} ${VAN_PLAN_SUBTITLE}`,
};

export default async function VanPlanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!hasAdminClientConfig()) {
    return (
      <div className="van-plan">
        <VanPlanHeader />
        <main className="mx-auto max-w-xl px-6 py-12">
          <p className="vp-subhead text-sm">setup required</p>
          <h1 className="vp-heading mt-2 text-4xl">Auction database</h1>
          <p className="vp-description mt-4 leading-7">
            Add the server-only Supabase service role key and apply the Van Plan
            auction migration before this module can store users, items, and
            bids.
          </p>
        </main>
      </div>
    );
  }

  const user = await getCurrentVanPlanUser().catch(() => null);

  return (
    <div className="van-plan">
      <VanPlanHeader />
      <VanPlanNav user={user} />
      <VanPlanMustResetGate required={Boolean(user?.mustResetPassword)} />
      {children}
    </div>
  );
}
