"use client";

import { useActionState } from "react";
import VanPlanActionMessage from "@/app/van-plan/components/action-message";
import VanPlanAddressFields from "@/app/van-plan/components/address-fields";
import VanPlanFormButton from "@/app/van-plan/components/form-button";
import { updateVanPlanAccountAction } from "@/lib/van-plan/actions";
import type { VanPlanUser } from "@/lib/van-plan/types";
import { idleVanPlanActionState } from "@/lib/van-plan/types";

export default function VanPlanAccountForm({ user }: { user: VanPlanUser }) {
  const [state, formAction] = useActionState(
    updateVanPlanAccountAction,
    idleVanPlanActionState,
  );

  return (
    <form action={formAction} className="mt-8 grid gap-4">
      <input type="hidden" name="version" value={state.version} />

      <label className="vp-subhead block text-sm">
        name
        <input
          name="name"
          required
          defaultValue={user.name}
          autoComplete="name"
          className="vp-input mt-2"
        />
      </label>

      <label className="vp-subhead block text-sm">
        email
        <input
          value={user.email}
          readOnly
          className="vp-input mt-2 bg-white/60"
        />
      </label>

      <label className="vp-subhead block text-sm">
        phone number
        <input
          name="phone"
          type="tel"
          required
          defaultValue={user.phone}
          autoComplete="tel"
          className="vp-input mt-2"
        />
      </label>

      <VanPlanAddressFields
        defaults={{
          addressLine1: user.addressLine1,
          addressLine2: user.addressLine2,
          city: user.city,
          state: user.state,
          zip: user.zip,
        }}
      />

      <VanPlanFormButton pendingLabel="Saving...">Save account</VanPlanFormButton>
      <VanPlanActionMessage state={state} />
    </form>
  );
}
