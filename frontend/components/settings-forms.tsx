"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type SettingsFormsProps = {
  displayName: string;
  username: string;
  canEdit: boolean;
};

export function SettingsForms({ displayName, username, canEdit }: SettingsFormsProps) {
  const router = useRouter();
  const [profileName, setProfileName] = useState(displayName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [isProfilePending, startProfileTransition] = useTransition();
  const [isPasswordPending, startPasswordTransition] = useTransition();

  const saveProfile = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileMessage(null);

    startProfileTransition(async () => {
      const response = await fetch("/api/account/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ displayName: profileName })
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setProfileMessage(payload?.error ?? "Unable to save profile.");
        return;
      }

      setProfileMessage("Profile updated.");
      router.refresh();
    });
  };

  const updatePassword = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordMessage(null);

    startPasswordTransition(async () => {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setPasswordMessage(payload?.error ?? "Unable to update password.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password updated.");
    });
  };

  return (
    <>
      <article className="section">
        <p className="panel-label">Account Settings</p>
        <h3>Profile details</h3>
        <form className="settings-form" onSubmit={saveProfile}>
          <label className="filter-field">
            <span className="panel-label">Display name</span>
            <input
              disabled={!canEdit}
              onChange={(event) => setProfileName(event.target.value)}
              type="text"
              value={profileName}
            />
          </label>
          <label className="filter-field">
            <span className="panel-label">Username</span>
            <input disabled type="text" value={`@${username || "preview_analyst"}`} />
          </label>
          {profileMessage ? <p className="settings-message">{profileMessage}</p> : null}
          <div className="settings-actions">
            <button className="button primary" disabled={!canEdit || isProfilePending} type="submit">
              {isProfilePending ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>
      </article>

      <article className="section">
        <p className="panel-label">Security</p>
        <h3>Change password</h3>
        <form className="settings-form" onSubmit={updatePassword}>
          <label className="filter-field">
            <span className="panel-label">Current password</span>
            <input
              disabled={!canEdit}
              onChange={(event) => setCurrentPassword(event.target.value)}
              type="password"
              value={currentPassword}
            />
          </label>
          <label className="filter-field">
            <span className="panel-label">New password</span>
            <input
              disabled={!canEdit}
              onChange={(event) => setNewPassword(event.target.value)}
              type="password"
              value={newPassword}
            />
          </label>
          <label className="filter-field">
            <span className="panel-label">Confirm new password</span>
            <input
              disabled={!canEdit}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              value={confirmPassword}
            />
          </label>
          <p className="settings-helper">Requires 8+ characters, uppercase, lowercase, number, and special character.</p>
          {passwordMessage ? <p className="settings-message">{passwordMessage}</p> : null}
          <div className="settings-actions">
            <button className="button primary" disabled={!canEdit || isPasswordPending} type="submit">
              {isPasswordPending ? "Updating..." : "Change Password"}
            </button>
          </div>
        </form>
      </article>
    </>
  );
}
