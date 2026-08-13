"use client";

import { useActionState } from "react";
import VanPlanActionMessage from "@/app/van-plan/components/action-message";
import VanPlanFormButton from "@/app/van-plan/components/form-button";
import { createVanPlanUserAction } from "@/lib/van-plan/actions";
import { VAN_PLAN_PERMISSIONS } from "@/lib/van-plan/constants";
import { idleVanPlanActionState } from "@/lib/van-plan/types";

export default function VanPlanUserForm() {
  const [state, formAction] = useActionState(
    createVanPlanUserAction,
    idleVanPlanActionState,
  );

  return (
    <form action={formAction} className="mt-8 grid gap-4 md:grid-cols-2">
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

      <label className="vp-subhead block text-sm">
        permission
        <select name="permission" defaultValue="user" className="vp-select mt-2">
          {VAN_PLAN_PERMISSIONS.map((permission) => (
            <option key={permission} value={permission}>
              {permission}
            </option>
          ))}
        </select>
      </label>

      <div className="md:col-span-2">
        <VanPlanFormButton pendingLabel="Adding...">Add user</VanPlanFormButton>
      </div>
      <div className="md:col-span-2">
        <VanPlanActionMessage state={state} />
      </div>
    </form>
  );
}
