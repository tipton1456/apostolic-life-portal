"use client";

import { useActionState } from "react";
import VanPlanActionMessage from "@/app/van-plan/components/action-message";
import VanPlanFormButton from "@/app/van-plan/components/form-button";
import { requestVanPlanPasswordResetAction } from "@/lib/van-plan/actions";
import { idleVanPlanActionState } from "@/lib/van-plan/types";

export default function VanPlanForgotPasswordForm() {
  const [state, formAction] = useActionState(
    requestVanPlanPasswordResetAction,
    idleVanPlanActionState,
  );

  return (
    <form action={formAction} className="mt-8 space-y-5">
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

      <VanPlanFormButton pendingLabel="Sending...">
        Text a temporary password
      </VanPlanFormButton>
      <VanPlanActionMessage state={state} />
    </form>
  );
}
