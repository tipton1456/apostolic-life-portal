"use client";

import { useRouter } from "next/navigation";

export default function AssignmentCountSelect({
  count,
  display = "list",
  view = "mine",
}: {
  count: number;
  display?: "list" | "calendar";
  view?: "mine" | "family";
}) {
  const router = useRouter();

  return (
    <label className="text-sm font-medium text-neutral-300">
      Show
      <select
        value={count}
        onChange={(event) =>
          router.push(
            `/assignments?view=${view}&display=${display}&count=${event.target.value}`,
          )
        }
        className="ml-3 rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-neutral-100 outline-none ring-lime-400 transition focus:ring-2"
      >
        <option value={3}>3 assignments</option>
        <option value={5}>5 assignments</option>
        <option value={10}>10 assignments</option>
      </select>
    </label>
  );
}
