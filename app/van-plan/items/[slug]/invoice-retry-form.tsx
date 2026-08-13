"use client";

import { useActionState } from "react";
import VanPlanActionMessage from "@/app/van-plan/components/action-message";
import VanPlanFormButton from "@/app/van-plan/components/form-button";
import { retryVanPlanInvoiceAction } from "@/lib/van-plan/actions";
import { idleVanPlanActionState } from "@/lib/van-plan/types";

export default function VanPlanInvoiceRetryForm({
  invoiceId,
}: {
  invoiceId: string;
}) {
  const [state, formAction] = useActionState(
    retryVanPlanInvoiceAction,
    idleVanPlanActionState,
  );

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="version" value={state.version} />
      <VanPlanFormButton pendingLabel="Sending..." variant="secondary">
        Resend invoice
      </VanPlanFormButton>
      <VanPlanActionMessage state={state} />
    </form>
  );
}
