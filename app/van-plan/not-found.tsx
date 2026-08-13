import Link from "next/link";
import { VAN_PLAN_BASE_PATH } from "@/lib/van-plan/constants";

export default function VanPlanNotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <p className="vp-subhead text-sm">not found</p>
      <h1 className="vp-heading mt-2 text-4xl">This item is not available</h1>
      <p className="vp-description mt-4 leading-7">
        The auction item may be private, sold under a different link, or not
        created yet.
      </p>
      <Link href={VAN_PLAN_BASE_PATH} className="vp-button mt-8">
        Back to the auction
      </Link>
    </main>
  );
}
