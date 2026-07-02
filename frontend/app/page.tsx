"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

const PASSWORD_HINTS = [
  "At least 8 characters",
  "At least 1 uppercase letter",
  "At least 1 lowercase letter",
  "At least 1 number",
  "At least 1 special character"
];

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const setAuthMode = (nextMode: "login" | "register") => {
    setMode(nextMode);
    setError(null);
    router.replace(nextMode === "register" ? "/?mode=register" : "/");
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch(mode === "register" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(
          mode === "register"
            ? { username, displayName, password, confirmPassword }
            : { username, password }
        )
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Unable to sign in.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    });
  };

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="login-copy">
          <p className="eyebrow">{mode === "register" ? "Create Account" : "BioPath Access"}</p>
          <h1>{mode === "register" ? "Register your BioPath login" : "SARS-CoV-2 genomic intelligence"}</h1>
          <p>
            {mode === "register"
              ? "Create a username and a strong password. Usernames must be unique, and weak passwords will be rejected automatically."
              : "Sign in to review your uploads, reopen your own analysis runs, and continue work from a single dashboard."}
          </p>
          {mode === "register" ? (
            <ul className="requirement-list">
              {PASSWORD_HINTS.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <form className="login-form" onSubmit={onSubmit}>
          <div className="auth-toggle" role="tablist" aria-label="Authentication mode">
            <button
              className={mode === "login" ? "auth-tab is-active" : "auth-tab"}
              onClick={() => setAuthMode("login")}
              type="button"
            >
              Sign In
            </button>
            <button
              className={mode === "register" ? "auth-tab is-active" : "auth-tab"}
              onClick={() => setAuthMode("register")}
              type="button"
            >
              Register
            </button>
          </div>

          {mode === "register" ? (
            <label className="filter-field">
              <span className="panel-label">Display Name</span>
              <input
                autoComplete="name"
                name="displayName"
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Vedan Patel"
                type="text"
                value={displayName}
              />
            </label>
          ) : null}

          <label className="filter-field">
            <span className="panel-label">Username</span>
            <input
              autoComplete="username"
              name="username"
              onChange={(event) => setUsername(event.target.value)}
              placeholder="analyst_01"
              type="text"
              value={username}
            />
          </label>
          <label className="filter-field">
            <span className="panel-label">Password</span>
            <input
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === "register" ? "Create password" : "Enter password"}
              type="password"
              value={password}
            />
          </label>

          {mode === "register" ? (
            <label className="filter-field">
              <span className="panel-label">Confirm Password</span>
              <input
                autoComplete="new-password"
                name="confirmPassword"
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat password"
                type="password"
                value={confirmPassword}
              />
            </label>
          ) : null}

          {error ? <p className="status">{error}</p> : null}

          <button className="button primary login-button" disabled={isPending} type="submit">
            {isPending
              ? mode === "register"
                ? "Creating Account..."
                : "Signing In..."
              : mode === "register"
                ? "Register and Continue"
                : "Open Dashboard"}
          </button>

          <p className="auth-switch">
            {mode === "register" ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              className="auth-inline-link"
              onClick={() => setAuthMode(mode === "register" ? "login" : "register")}
              type="button"
            >
              {mode === "register" ? "Sign in here" : "Register here"}
            </button>
          </p>
        </form>
      </section>
    </main>
  );
}
