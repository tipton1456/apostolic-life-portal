"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export default function VanPlanFormButton({
  children,
  pendingLabel,
  variant = "primary",
  className = "",
}: {
  children: ReactNode;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
}) {
  const { pending } = useFormStatus();
  const variantClass =
    variant === "secondary"
      ? "vp-button vp-button-secondary"
      : variant === "ghost"
        ? "vp-button vp-button-ghost"
        : variant === "danger"
          ? "vp-button vp-button-danger"
          : "vp-button";

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${variantClass} ${className}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
