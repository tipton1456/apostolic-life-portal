import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { password, username } = await request.json().catch(() => ({
    password: "",
    username: "",
  }));

  if (
    String(username).trim().toLowerCase() !== "demo" ||
    String(password) !== "demo"
  ) {
    return NextResponse.json(
      { message: "Invalid demo credentials." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("portal_demo", "true", {
    httpOnly: true,
    maxAge: 60 * 60 * 8,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
