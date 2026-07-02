import { NextResponse } from "next/server";

import {
  HISTORY_COOKIE,
  parseHistoryCookie,
  serializeHistoryCookie,
  SESSION_COOKIE,
  SESSION_MAX_AGE
} from "../../../../lib/session";
import { authenticateUser } from "../../../../lib/users";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | { username?: string; password?: string }
    | null;
  const result = await authenticateUser({
    username: payload?.username ?? "",
    password: payload?.password ?? ""
  });

  if (!result.user) {
    return NextResponse.json({ error: result.error ?? "Unable to sign in." }, { status: 400 });
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const historyMatch = cookieHeader.match(new RegExp(`${HISTORY_COOKIE}=([^;]+)`));
  const history = parseHistoryCookie(historyMatch ? decodeURIComponent(historyMatch[1]) : undefined);
  const userKey = result.user.userKey;

  if (!history[userKey]) {
    history[userKey] = [];
  }

  const response = NextResponse.json({
    ok: true,
    user: {
      username: result.user.username,
      displayName: result.user.displayName
    }
  });

  response.cookies.set(SESSION_COOKIE, userKey, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: SESSION_MAX_AGE
  });
  response.cookies.set(HISTORY_COOKIE, serializeHistoryCookie(history), {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: SESSION_MAX_AGE
  });

  return response;
}
