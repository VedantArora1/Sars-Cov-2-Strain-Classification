import { cookies } from "next/headers";

import { formatUserName, HISTORY_COOKIE, normalizeUserKey, parseHistoryCookie, SESSION_COOKIE } from "./session";
import { findUserByUsername } from "./users";

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const rawUser = cookieStore.get(SESSION_COOKIE)?.value ?? "";
  const history = parseHistoryCookie(cookieStore.get(HISTORY_COOKIE)?.value);
  const userKey = normalizeUserKey(rawUser);
  const registeredUser = userKey ? await findUserByUsername(userKey) : null;

  return {
    isAuthenticated: Boolean(registeredUser),
    rawUser,
    username: registeredUser?.username ?? userKey ?? "",
    userName: registeredUser?.displayName ?? (rawUser ? formatUserName(rawUser) : ""),
    createdAt: registeredUser?.createdAt ?? "",
    runIds: userKey ? history[userKey] ?? [] : []
  };
}
