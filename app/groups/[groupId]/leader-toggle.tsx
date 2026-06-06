"use client";

import { useTransition } from "react";

type LeaderToggleProps = {
  groupId: string;
  isLeader: boolean;
  memberId: string;
  memberName: string;
  updateLeaderAction: (formData: FormData) => void;
};

export default function LeaderToggle({
  groupId,
  isLeader,
  memberId,
  memberName,
  updateLeaderAction,
}: LeaderToggleProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <label className="inline-flex items-center gap-2 text-sm text-neutral-300">
      <input
        type="checkbox"
        defaultChecked={isLeader}
        disabled={isPending}
        className="h-4 w-4 rounded border-white/20 bg-neutral-900 text-lime-400 accent-lime-400 disabled:cursor-wait disabled:opacity-60"
        aria-label={`Make ${memberName} a leader`}
        onChange={(event) => {
          const formData = new FormData();
          formData.set("groupId", groupId);
          formData.set("personId", memberId);
          formData.set("makeLeader", String(event.target.checked));

          startTransition(() => updateLeaderAction(formData));
        }}
      />
      <span>Make leader</span>
    </label>
  );
}
