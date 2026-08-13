"use client";

import { useActionState } from "react";
import VanPlanActionMessage from "@/app/van-plan/components/action-message";
import VanPlanFormButton from "@/app/van-plan/components/form-button";
import { loginVanPlanUserAction } from "@/lib/van-plan/actions";
import { idleVanPlanActionState } from "@/lib/van-plan/types";

export default function VanPlanLoginForm({ nextPath }: { nextPath: string }) {
  const [state, formAction] = useActionState(
    loginVanPlanUserAction,
    idleVanPlanActionState,
  );

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <input type="hidden" name="next" value={nextPath} />
      <input type="hidden" name="version" value={state.version} />

      <label className="vp-subhead block text-sm">
        email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="vp-input mt-2"
        />
      </label>

      <label className="vp-subhead block text-sm">
        phone number
        <input
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          className="vp-input mt-2"
        />
      </label>

      <VanPlanFormButton pendingLabel="Signing in...">Sign in</VanPlanFormButton>
      <VanPlanActionMessage state={state} />
    </form>
  );
}
