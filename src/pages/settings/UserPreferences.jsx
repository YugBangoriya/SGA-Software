// src/pages/Settings/components/User/UserPreferences.jsx
// All users: Theme toggle (Light/Dark), Language toggle (EN/GU), Change Password.
// Theme and Language were built in Phase 1 — this surfaces them in Settings.

import React, { useState } from "react";
import {
  getAuth,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { SectionCard, FieldRow, Input, Button, SaveRow, T } from "./SettingsUI";
import useThemeStore from "../../store/themeStore";

// ─── Theme Toggle ─────────────────────────────────────────────────────────────
export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();

  return (
    <SectionCard title="Theme" subtitle="Switch between Light and Dark mode" icon="🌙">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {["light", "dark"].map((mode) => (
          <button
            key={mode}
            onClick={() => setTheme(mode)}
            style={{
              flex: 1,
              minWidth: 120,
              padding: "18px 16px",
              borderRadius: 12,
              border: `2px solid ${theme === mode ? T.primary : T.border}`,
              background:
                mode === "light"
                  ? theme === mode ? "#FFF5F5" : "#FFFFFF"
                  : theme === mode ? "#2A2020" : "#1A1A1A",
              cursor: "pointer",
              textAlign: "center",
              transition: "all 0.2s",
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>
              {mode === "light" ? "☀️" : "🌙"}
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: mode === "dark" ? "#E8E8E8" : T.textPrimary,
                fontFamily: "inherit",
              }}
            >
              {mode === "light" ? "Light Mode" : "Dark Mode"}
            </div>
            {theme === mode && (
              <div style={{ fontSize: 11, color: T.primary, marginTop: 4, fontWeight: 600 }}>
                ✓ Active
              </div>
            )}
          </button>
        ))}
      </div>
    </SectionCard>
  );
}

// ─── Language Toggle ──────────────────────────────────────────────────────────
export function LanguageToggle() {
  const { language, setLanguage } = useThemeStore();

  const LANGS = [
    { code: "en", label: "English", nativeLabel: "English", flag: "🇬🇧" },
    { code: "gu", label: "Gujarati", nativeLabel: "ગુજરાતી", flag: "🏵️" },
  ];

  return (
    <SectionCard title="Language" subtitle="App interface language" icon="🌐">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {LANGS.map((lang) => (
          <button
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            style={{
              flex: 1,
              minWidth: 120,
              padding: "18px 16px",
              borderRadius: 12,
              border: `2px solid ${language === lang.code ? T.primary : T.border}`,
              background: language === lang.code ? "#FFF5F5" : T.cardElevated,
              cursor: "pointer",
              textAlign: "center",
              transition: "all 0.2s",
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>{lang.flag}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, fontFamily: "inherit" }}>
              {lang.label}
            </div>
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>
              {lang.nativeLabel}
            </div>
            {language === lang.code && (
              <div style={{ fontSize: 11, color: T.primary, marginTop: 4, fontWeight: 600 }}>
                ✓ Active
              </div>
            )}
          </button>
        ))}
      </div>
    </SectionCard>
  );
}

// ─── Change Password ──────────────────────────────────────────────────────────
export function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const auth = getAuth();

  const validate = () => {
    if (!current) return "Current password is required.";
    if (!newPw) return "New password is required.";
    if (newPw.length < 6) return "New password must be at least 6 characters.";
    if (newPw !== confirm) return "New passwords do not match.";
    if (current === newPw) return "New password must be different from current password.";
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }

    setSaving(true);
    setError("");
    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPw);

      // Update lastPasswordChange in Firestore for audit
      await updateDoc(doc(db, "users", user.uid), {
        lastPasswordChange: new Date().toISOString(),
      });

      setCurrent("");
      setNewPw("");
      setConfirm("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (e) {
      if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
        setError("Current password is incorrect.");
      } else if (e.code === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
      } else {
        setError("Failed to update password: " + e.message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Change Password" subtitle="Update your account password" icon="🔑">
      {error && (
        <div style={{ background: T.dangerBg, borderRadius: 8, padding: "10px 14px", marginBottom: 14, color: T.danger, fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}
      {success && (
        <div style={{ background: T.statusGreenBg, borderRadius: 8, padding: "10px 14px", marginBottom: 14, color: T.statusGreen, fontSize: 13 }}>
          ✓ Password updated successfully.
        </div>
      )}

      <FieldRow label="Current Password" required>
        <Input
          value={current}
          onChange={setCurrent}
          type="password"
          placeholder="Enter your current password"
        />
      </FieldRow>

      <FieldRow label="New Password" required hint="Minimum 6 characters">
        <Input
          value={newPw}
          onChange={setNewPw}
          type="password"
          placeholder="Enter new password"
        />
      </FieldRow>

      {/* Password strength indicator */}
      {newPw && (
        <div style={{ marginBottom: 12, marginTop: -8 }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
            {[1, 2, 3, 4].map((level) => {
              const strength = getPasswordStrength(newPw);
              return (
                <div
                  key={level}
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 2,
                    background: strength >= level ? getStrengthColor(strength) : T.border,
                    transition: "background 0.3s",
                  }}
                />
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: getStrengthColor(getPasswordStrength(newPw)) }}>
            {["", "Weak", "Fair", "Good", "Strong"][getPasswordStrength(newPw)]}
          </div>
        </div>
      )}

      <FieldRow label="Confirm New Password" required>
        <Input
          value={confirm}
          onChange={setConfirm}
          type="password"
          placeholder="Re-enter new password"
          error={confirm && confirm !== newPw ? "Passwords do not match" : ""}
        />
      </FieldRow>

      <SaveRow onSave={handleSave} loading={saving} saved={false}>
        <span style={{ fontSize: 12, color: T.textSecondary }}>
          You will remain signed in after changing your password.
        </span>
      </SaveRow>
    </SectionCard>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getPasswordStrength(pw) {
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}

function getStrengthColor(s) {
  return ["", T.statusRed, T.statusAmber, "#7CB900", T.statusGreen][s] || T.border;
}