"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-lime-400 px-5 py-3 font-semibold text-neutral-950 transition hover:bg-lime-300 disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? "Submitting Request..." : "Submit Request"}
    </button>
  );
}
