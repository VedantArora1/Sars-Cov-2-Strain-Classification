import { NextResponse } from "next/server";

import {
  HISTORY_COOKIE,
  normalizeUserKey,
  parseHistoryCookie,
  serializeHistoryCookie,
  SESSION_COOKIE,
  SESSION_MAX_AGE
} from "../../../../lib/session";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as { jobId?: string } | null;
  const jobId = payload?.jobId?.trim() ?? "";
  const cookieHeader = request.headers.get("cookie") ?? "";
  const sessionMatch = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  const historyMatch = cookieHeader.match(new RegExp(`${HISTORY_COOKIE}=([^;]+)`));
  const rawUser = sessionMatch ? decodeURIComponent(sessionMatch[1]) : "";

  if (!rawUser) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!jobId) {
    return NextResponse.json({ error: "A job ID is required." }, { status: 400 });
  }

  const history = parseHistoryCookie(historyMatch ? decodeURIComponent(historyMatch[1]) : undefined);
  const userKey = normalizeUserKey(rawUser);
  const existing = history[userKey] ?? [];
  history[userKey] = [jobId, ...existing.filter((item) => item !== jobId)].slice(0, 25);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(HISTORY_COOKIE, serializeHistoryCookie(history), {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: SESSION_MAX_AGE
  });

  return response;
}
