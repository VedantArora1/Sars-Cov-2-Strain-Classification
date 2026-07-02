import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type RegisteredUser = {
  username: string;
  userKey: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
};

const DATA_DIR = path.join(process.cwd(), ".data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,24}$/;
const PASSWORD_RULES = [
  { test: (value: string) => value.length >= 8, message: "Password must be at least 8 characters long." },
  { test: (value: string) => /[A-Z]/.test(value), message: "Password must include at least 1 uppercase letter." },
  { test: (value: string) => /[a-z]/.test(value), message: "Password must include at least 1 lowercase letter." },
  { test: (value: string) => /[0-9]/.test(value), message: "Password must include at least 1 number." },
  { test: (value: string) => /[^A-Za-z0-9]/.test(value), message: "Password must include at least 1 special character." }
];

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

async function ensureUsersFile() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await readFile(USERS_FILE, "utf8");
  } catch {
    await writeFile(USERS_FILE, "[]", "utf8");
  }
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function validatePassword(password: string): string | null {
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(password)) {
      return rule.message;
    }
  }

  return null;
}

export function validateUsername(username: string): string | null {
  if (!USERNAME_PATTERN.test(username)) {
    return "Username must be 3-24 characters and can only use letters, numbers, dots, dashes, or underscores.";
  }

  return null;
}

export async function readUsers(): Promise<RegisteredUser[]> {
  await ensureUsersFile();

  try {
    const raw = await readFile(USERS_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as RegisteredUser[]) : [];
  } catch {
    return [];
  }
}

async function writeUsers(users: RegisteredUser[]) {
  await ensureUsersFile();
  await writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

export async function findUserByUsername(username: string): Promise<RegisteredUser | null> {
  const users = await readUsers();
  const userKey = normalizeUsername(username);
  return users.find((user) => user.userKey === userKey) ?? null;
}

export async function registerUser(input: {
  username: string;
  displayName: string;
  password: string;
  confirmPassword: string;
}): Promise<{ user?: RegisteredUser; error?: string }> {
  const username = input.username.trim();
  const displayName = input.displayName.trim();
  const password = input.password;
  const confirmPassword = input.confirmPassword;

  const usernameError = validateUsername(username);
  if (usernameError) {
    return { error: usernameError };
  }

  if (!displayName) {
    return { error: "Display name is required." };
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return { error: passwordError };
  }

  if (password !== confirmPassword) {
    return { error: "Password confirmation does not match." };
  }

  const users = await readUsers();
  const userKey = normalizeUsername(username);
  if (users.some((user) => user.userKey === userKey)) {
    return { error: "That username is already registered." };
  }

  const user: RegisteredUser = {
    username,
    userKey,
    displayName,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString()
  };

  users.push(user);
  await writeUsers(users);
  return { user };
}

export async function authenticateUser(input: {
  username: string;
  password: string;
}): Promise<{ user?: RegisteredUser; error?: string }> {
  const username = input.username.trim();
  const password = input.password;

  if (!username || !password) {
    return { error: "Enter your username and password." };
  }

  const user = await findUserByUsername(username);
  if (!user) {
    return { error: "No account exists for that username." };
  }

  if (user.passwordHash !== hashPassword(password)) {
    return { error: "Incorrect password." };
  }

  return { user };
}

export async function updateDisplayName(input: {
  userKey: string;
  displayName: string;
}): Promise<{ user?: RegisteredUser; error?: string }> {
  const displayName = input.displayName.trim();

  if (!displayName) {
    return { error: "Display name is required." };
  }

  const users = await readUsers();
  const index = users.findIndex((user) => user.userKey === normalizeUsername(input.userKey));

  if (index === -1) {
    return { error: "User account was not found." };
  }

  users[index] = {
    ...users[index],
    displayName
  };

  await writeUsers(users);
  return { user: users[index] };
}

export async function changePassword(input: {
  userKey: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ user?: RegisteredUser; error?: string }> {
  const users = await readUsers();
  const index = users.findIndex((user) => user.userKey === normalizeUsername(input.userKey));

  if (index === -1) {
    return { error: "User account was not found." };
  }

  if (users[index].passwordHash !== hashPassword(input.currentPassword)) {
    return { error: "Current password is incorrect." };
  }

  const passwordError = validatePassword(input.newPassword);
  if (passwordError) {
    return { error: passwordError };
  }

  if (input.newPassword !== input.confirmPassword) {
    return { error: "Password confirmation does not match." };
  }

  users[index] = {
    ...users[index],
    passwordHash: hashPassword(input.newPassword)
  };

  await writeUsers(users);
  return { user: users[index] };
}
