export const SESSION_COOKIE = "biopath_user";
export const HISTORY_COOKIE = "biopath_history";
export const SESSION_MAX_AGE = 60 * 60 * 8;

export type UserRunHistory = Record<string, string[]>;

export function normalizeUserKey(value: string): string {
  return value.trim().toLowerCase();
}

export function formatUserName(value: string): string {
  const base = value.includes("@") ? value.split("@")[0] : value;
  return base
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function parseHistoryCookie(value?: string): UserRunHistory {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([key, items]) => [
        key,
        Array.isArray(items) ? items.filter((item): item is string => typeof item === "string") : []
      ])
    );
  } catch {
    return {};
  }
}

export function serializeHistoryCookie(history: UserRunHistory): string {
  return JSON.stringify(history);
}
