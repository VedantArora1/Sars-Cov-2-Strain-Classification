import { NextResponse } from "next/server";

import {
  HISTORY_COOKIE,
  parseHistoryCookie,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  serializeHistoryCookie
} from "../../../../lib/session";
import { registerUser } from "../../../../lib/users";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | { username?: string; displayName?: string; password?: string; confirmPassword?: string }
    | null;

  const result = await registerUser({
    username: payload?.username ?? "",
    displayName: payload?.displayName ?? "",
    password: payload?.password ?? "",
    confirmPassword: payload?.confirmPassword ?? ""
  });

  if (!result.user) {
    return NextResponse.json({ error: result.error ?? "Unable to register user." }, { status: 400 });
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const historyMatch = cookieHeader.match(new RegExp(`${HISTORY_COOKIE}=([^;]+)`));
  const history = parseHistoryCookie(historyMatch ? decodeURIComponent(historyMatch[1]) : undefined);
  if (!history[result.user.userKey]) {
    history[result.user.userKey] = [];
  }

  const response = NextResponse.json({
    ok: true,
    user: {
      username: result.user.username,
      displayName: result.user.displayName
    }
  });

  response.cookies.set(SESSION_COOKIE, result.user.userKey, {
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
