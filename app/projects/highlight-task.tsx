"use client";

import { useEffect } from "react";

export default function HighlightTask({ taskId }: { taskId?: string }) {
  useEffect(() => {
    if (!taskId) return;

    const element = document.getElementById(`task-${taskId}`);

    if (!element) return;

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.classList.add("ring-2", "ring-lime-400/70");

    const timeout = window.setTimeout(() => {
      element.classList.remove("ring-2", "ring-lime-400/70");
    }, 4000);

    return () => window.clearTimeout(timeout);
  }, [taskId]);

  return null;
}