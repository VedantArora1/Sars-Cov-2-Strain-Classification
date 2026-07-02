import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "../../../../lib/session";
import { updateDisplayName } from "../../../../lib/users";

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const sessionMatch = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  const userKey = sessionMatch ? decodeURIComponent(sessionMatch[1]) : "";

  if (!userKey) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as { displayName?: string } | null;
  const result = await updateDisplayName({
    userKey,
    displayName: payload?.displayName ?? ""
  });

  if (!result.user) {
    return NextResponse.json({ error: result.error ?? "Unable to update profile." }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    user: {
      displayName: result.user.displayName,
      username: result.user.username
    }
  });
}
