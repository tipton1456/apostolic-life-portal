import Link from "next/link";
import { logoutVanPlanUserAction } from "@/lib/van-plan/actions";
import { canManageItems, canManageUsers } from "@/lib/van-plan/auth";
import { VAN_PLAN_BASE_PATH } from "@/lib/van-plan/constants";
import { getVanPlanAuctionSchedule } from "@/lib/van-plan/schedule";
import type { VanPlanUser } from "@/lib/van-plan/types";
import VanPlanCountdown from "./countdown";
import VanPlanFormButton from "./form-button";

export default function VanPlanNav({ user }: { user: VanPlanUser | null }) {
  const schedule = getVanPlanAuctionSchedule();

  return (
    <nav className="border-b border-[rgba(70,67,60,0.14)] bg-[#F9EDE4]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex flex-wrap items-center gap-5">
          <Link href={VAN_PLAN_BASE_PATH} className="vp-heading-bold text-sm">
            Auction
          </Link>
          {canManageItems(user) ? (
            <>
              <Link href={`${VAN_PLAN_BASE_PATH}/admin`} className="vp-subhead text-sm">
                manage items
              </Link>
              <Link
                href={`${VAN_PLAN_BASE_PATH}/admin/items/new`}
                className="vp-subhead text-sm"
              >
                add item
              </Link>
            </>
          ) : null}
          {canManageUsers(user) ? (
            <Link
              href={`${VAN_PLAN_BASE_PATH}/admin/users`}
              className="vp-subhead text-sm"
            >
              add users
            </Link>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <VanPlanCountdown
            opensAt={schedule.opensAt}
            closesAt={schedule.closesAt}
            serverNow={schedule.now}
          />
          {user ? (
            <>
              <p className="vp-accent text-sm">{user.name}</p>
              <Link
                href={`${VAN_PLAN_BASE_PATH}/account`}
                className="vp-subhead text-sm"
              >
                account
              </Link>
              <Link
                href={`${VAN_PLAN_BASE_PATH}/change-password`}
                className="vp-subhead text-sm"
              >
                password
              </Link>
              <form action={logoutVanPlanUserAction}>
                <VanPlanFormButton pendingLabel="Signing out..." variant="ghost">
                  Sign out
                </VanPlanFormButton>
              </form>
            </>
          ) : (
            <>
              <Link href={`${VAN_PLAN_BASE_PATH}/register`} className="vp-subhead text-sm">
                create account
              </Link>
              <Link href={`${VAN_PLAN_BASE_PATH}/login`} className="vp-subhead text-sm">
                sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
