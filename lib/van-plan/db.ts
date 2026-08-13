import { createAdminClient } from "@/lib/supabase/admin";

export function vanPlanDb() {
  return createAdminClient();
}

export class VanPlanError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "VanPlanError";
    this.status = status;
  }
}

export function isVanPlanError(error: unknown): error is VanPlanError {
  return error instanceof VanPlanError;
}

export function nextActionState(
  status: "success" | "error",
  message: string,
  version: number,
) {
  return {
    message,
    status,
    version: version + 1,
  };
}
