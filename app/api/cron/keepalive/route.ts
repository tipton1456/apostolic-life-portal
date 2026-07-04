import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PORTAL_URL = "https://apostolic-life-portal.vercel.app";

type PingResult = {
  label: string;
  ok: boolean;
  status: number;
  detail: string;
};

async function ping(
  label: string,
  url: string,
  init?: RequestInit,
): Promise<PingResult> {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.text();

    return {
      label,
      ok: response.ok,
      status: response.status,
      detail: body.slice(0, 120),
    };
  } catch (error) {
    return {
      label,
      ok: false,
      status: 0,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization");

  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(
      { error: "Supabase environment variables are not configured." },
      { status: 500 },
    );
  }

  const checks: PingResult[] = await Promise.all([
    ping("supabase-auth", `${supabaseUrl}/auth/v1/health`, {
      headers: { apikey: anonKey },
    }),
    ping(
      "supabase-db",
      `${supabaseUrl}/rest/v1/portal_users?select=id&limit=1`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      },
    ),
    serviceRoleKey
      ? ping(
          "supabase-admin",
          `${supabaseUrl}/rest/v1/projects?select=id&limit=1`,
          {
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
            },
          },
        )
      : Promise.resolve({
          label: "supabase-admin",
          ok: true,
          status: 0,
          detail: "skipped",
        }),
    ping("portal-home", `${PORTAL_URL}/`),
    ping("portal-login", `${PORTAL_URL}/login`),
  ]);

  const healthy = checks.every((check) => check.ok);

  return NextResponse.json(
    {
      healthy,
      checkedAt: new Date().toISOString(),
      checks,
    },
    { status: healthy ? 200 : 503 },
  );
}