import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const DEMO_EMAIL = "demo@apostoliclife.local";
export const DEMO_USER_ID = "portal-demo-user";

export type CurrentPortalSessionUser = {
  id: string;
  email: string;
  isDemo: boolean;
};

export async function isDemoMode() {
  const cookieStore = await cookies();

  return cookieStore.get("portal_demo")?.value === "true";
}

export async function getCurrentSessionUser(): Promise<CurrentPortalSessionUser | null> {
  if (await isDemoMode()) {
    return {
      id: DEMO_USER_ID,
      email: DEMO_EMAIL,
      isDemo: true,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    isDemo: false,
  };
}

export function isDemoEmail(email?: string | null) {
  return email?.trim().toLowerCase() === DEMO_EMAIL;
}
