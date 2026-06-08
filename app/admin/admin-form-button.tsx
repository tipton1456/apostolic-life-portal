"use client";

import type React from "react";
import { useFormStatus } from "react-dom";

export default function AdminFormButton({
  children,
  pendingLabel,
  variant = "primary",
  className = "",
  disabled = false,
  title,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  variant?: "primary" | "danger";
  className?: string;
  disabled?: boolean;
  title?: string;
}) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;
  const variantClass =
    variant === "danger"
      ? "border border-white/10 text-red-300 transition hover:border-red-300/60 hover:bg-red-400/10"
      : "bg-lime-400 text-neutral-950 transition hover:bg-lime-300";

  return (
    <button
      type="submit"
      disabled={isDisabled}
      title={title}
      className={`${variantClass} inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-wait disabled:opacity-60 ${className}`}
    >
      {pending ? (
        <span
          aria-hidden="true"
          className={
            variant === "danger"
              ? "h-4 w-4 animate-spin rounded-full border-2 border-red-300/30 border-t-red-300"
              : "h-4 w-4 animate-spin rounded-full border-2 border-neutral-950/30 border-t-neutral-950"
          }
        />
      ) : null}
      {pending ? pendingLabel : children}
    </button>
  );
}
