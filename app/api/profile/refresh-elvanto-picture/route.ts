import { NextResponse } from "next/server";
import { refreshElvantoProfilePictureForCurrentUser } from "@/lib/elvanto";

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }

  return authorization.slice("Bearer ".length).trim() || undefined;
}

export async function POST(request: Request) {
  try {
    const result = await refreshElvantoProfilePictureForCurrentUser(
      getBearerToken(request),
    );

    if (!result) {
      return NextResponse.json(
        { message: "Unable to refresh profile picture." },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Profile picture refresh route failed:", error);

    return NextResponse.json(
      { message: "Unable to refresh profile picture." },
      { status: 500 },
    );
  }
}