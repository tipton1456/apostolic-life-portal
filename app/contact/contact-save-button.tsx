"use client";

import { useFormStatus } from "react-dom";

export default function ContactSaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-lime-400 px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-lime-300 disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-950/30 border-t-neutral-950"
        />
      ) : null}
      {pending ? "Saving..." : label}
    </button>
  );
}
