"use client";

import { useActionState } from "react";
import VanPlanActionMessage from "@/app/van-plan/components/action-message";
import VanPlanAddressFields from "@/app/van-plan/components/address-fields";
import VanPlanFormButton from "@/app/van-plan/components/form-button";
import { registerVanPlanUserAction } from "@/lib/van-plan/actions";
import { idleVanPlanActionState } from "@/lib/van-plan/types";

export default function VanPlanRegisterForm() {
  const [state, formAction] = useActionState(
    registerVanPlanUserAction,
    idleVanPlanActionState,
  );

  return (
    <form action={formAction} className="mt-8 grid gap-4">
      <input type="hidden" name="version" value={state.version} />

      <label className="vp-subhead block text-sm">
        name
        <input name="name" required autoComplete="name" className="vp-input mt-2" />
      </label>

      <label className="vp-subhead block text-sm">
        email
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
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

      <VanPlanAddressFields />

      <label className="vp-subhead block text-sm">
        password
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
        confirm password
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

      <VanPlanFormButton pendingLabel="Creating account...">
        Create account
      </VanPlanFormButton>
      <VanPlanActionMessage state={state} />
    </form>
  );
}
