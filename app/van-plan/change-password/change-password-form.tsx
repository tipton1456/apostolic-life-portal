"use client";

import { useActionState } from "react";
import VanPlanActionMessage from "@/app/van-plan/components/action-message";
import VanPlanFormButton from "@/app/van-plan/components/form-button";
import { changeVanPlanPasswordAction } from "@/lib/van-plan/actions";
import { idleVanPlanActionState } from "@/lib/van-plan/types";

export default function VanPlanChangePasswordForm({
  mustReset,
}: {
  mustReset: boolean;
}) {
  const [state, formAction] = useActionState(
    changeVanPlanPasswordAction,
    idleVanPlanActionState,
  );

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <input type="hidden" name="version" value={state.version} />

      <label className="vp-subhead block text-sm">
        {mustReset ? "temporary password" : "current password"}
        <input
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="vp-input mt-2"
        />
      </label>

      <label className="vp-subhead block text-sm">
        new password
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="vp-input mt-2"
        />
      </label>

      <label className="vp-subhead block text-sm">
        confirm new password
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="vp-input mt-2"
        />
      </label>
      <p className="vp-accent text-sm">
        at least 8 characters, with one capital letter, one number, and one
        special character
      </p>

      <VanPlanFormButton pendingLabel="Saving...">
        Update password
      </VanPlanFormButton>
      <VanPlanActionMessage state={state} />
    </form>
  );
}
