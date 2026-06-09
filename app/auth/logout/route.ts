import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();

  await supabase.auth.signOut();

  const response = NextResponse.json({ ok: true });
  response.cookies.set("portal_demo", "", {
    maxAge: 0,
    path: "/",
  });

  return response;
}
