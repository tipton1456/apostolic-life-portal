"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { VAN_PLAN_BASE_PATH } from "@/lib/van-plan/constants";

export default function VanPlanMustResetGate({
  required,
}: {
  required: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!required) return;
    if (pathname.startsWith(`${VAN_PLAN_BASE_PATH}/change-password`)) return;

    router.replace(`${VAN_PLAN_BASE_PATH}/change-password`);
  }, [pathname, required, router]);

  return null;
}
