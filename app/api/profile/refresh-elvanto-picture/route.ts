import { NextResponse } from "next/server";
import { refreshElvantoProfilePictureForCurrentUser } from "@/lib/elvanto";

export async function POST() {
  const result = await refreshElvantoProfilePictureForCurrentUser();

  if (!result) {
    return NextResponse.json(
      { message: "Unable to refresh profile picture." },
      { status: 404 },
    );
  }

  return NextResponse.json(result);
}