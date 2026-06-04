import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/contact?elvanto=missing-code", requestUrl.origin));
  }

  const clientId = process.env.ELVANTO_CLIENT_ID;
  const clientSecret = process.env.ELVANTO_CLIENT_SECRET;
  const redirectUri = process.env.ELVANTO_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(new URL("/contact?elvanto=missing-env", requestUrl.origin));
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  const tokenResponse = await fetch("https://api.elvanto.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok) {
    console.error("Elvanto token error:", tokenData);
    return NextResponse.redirect(new URL("/contact?elvanto=token-error", requestUrl.origin));
  }

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  const { error } = await supabase.from("elvanto_connections").upsert(
    {
      user_id: user.id,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id",
    },
  );

  if (error) {
    console.error("Supabase save error:", error);
    return NextResponse.redirect(new URL("/contact?elvanto=save-error", requestUrl.origin));
  }

  return NextResponse.redirect(new URL("/contact?elvanto=connected", requestUrl.origin));
}