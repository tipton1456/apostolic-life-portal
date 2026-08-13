import type { VanPlanActionState } from "@/lib/van-plan/types";

export default function VanPlanActionMessage({
  state,
}: {
  state: VanPlanActionState;
}) {
  if (!state.message) return null;

  return (
    <p
      className={
        state.status === "error"
          ? "text-sm font-medium text-red-800"
          : "vp-accent text-sm"
      }
    >
      {state.message}
    </p>
  );
}
