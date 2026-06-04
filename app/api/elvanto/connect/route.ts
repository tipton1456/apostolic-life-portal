import { redirect } from "next/navigation";

export async function GET() {
  const clientId = process.env.ELVANTO_CLIENT_ID;
  const redirectUri = process.env.ELVANTO_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error("Missing Elvanto environment variables.");
  }

  const authUrl = new URL("https://api.elvanto.com/oauth");

  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");

  redirect(authUrl.toString());
}