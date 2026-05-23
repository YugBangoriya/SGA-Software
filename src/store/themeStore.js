// ─────────────────────────────────────────────────────────────────────────────
// src/store/themeStore.js
// Light / Dark mode + Language toggle.
// Reads initial value from localStorage (fast), then syncs with Firestore.
//
// FIX (Bug 2 — Dark mode resets on refresh):
//   Root cause: syncFromUserDoc used `userDoc.theme || "light"`. Since new user
//   documents are created with theme:"light" in Firestore, every page refresh
//   caused Firebase auth restore → fetchUserDoc → syncFromUserDoc to overwrite
//   the user's localStorage "dark" preference back to "light".
//
//   Two-part fix:
//   1. syncFromUserDoc: Prefer localStorage (device preference) over the
//      Firestore value on the same device. Firestore only wins when localStorage
//      has no value (e.g., fresh install or new device).
//   2. setTheme / setLanguage: Persist to Firestore immediately (fire-and-forget
//      via dynamic import to avoid a circular dep with authStore). This ensures
//      Firestore stays in sync so cross-device preference works correctly.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from "zustand";

const LS_THEME_KEY    = "sga_theme";    // "light" | "dark"
const LS_LANGUAGE_KEY = "sga_language"; // "en" | "gu"

function applyThemeToDOM(theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

/**
 * Fire-and-forget: persist a preference field to Firestore if the user is
 * currently authenticated. Uses a dynamic import to avoid a circular module
 * dependency between themeStore ↔ authStore.
 */
async function persistToFirestore(field, value) {
  try {
    const { default: useAuthStore } = await import("@/store/authStore");
    const { firebaseUser, updateUserPreference } = useAuthStore.getState();
    if (firebaseUser && typeof updateUserPreference === "function") {
      await updateUserPreference(field, value);
    }
  } catch {
    // Non-critical — localStorage is already updated; Firestore sync is best-effort
  }
}

const useThemeStore = create((set, get) => ({
  // ── State ─────────────────────────────────────────────────────────────────────
  theme:    localStorage.getItem(LS_THEME_KEY)    || "light",
  language: localStorage.getItem(LS_LANGUAGE_KEY) || "en",

  // ── Init: apply saved theme immediately on app start ─────────────────────────
  // Called in main.jsx before first React render to prevent flash of wrong theme.
  initTheme: () => {
    const saved = localStorage.getItem(LS_THEME_KEY) || "light";
    applyThemeToDOM(saved);
    set({ theme: saved });
  },

  // ── Toggle or set theme ───────────────────────────────────────────────────────
  setTheme: (theme) => {
    localStorage.setItem(LS_THEME_KEY, theme);
    applyThemeToDOM(theme);
    set({ theme });
    // Persist to Firestore so the preference survives cross-device sync.
    // Dynamic import avoids circular dep; failure is silently ignored.
    persistToFirestore("theme", theme);
  },

  toggleTheme: () => {
    const next = get().theme === "light" ? "dark" : "light";
    get().setTheme(next);
    return next;
  },

  // ── Language ──────────────────────────────────────────────────────────────────
  setLanguage: (lang) => {
    localStorage.setItem(LS_LANGUAGE_KEY, lang);
    set({ language: lang });
    // Persist to Firestore (same pattern as setTheme).
    persistToFirestore("language", lang);
  },

  toggleLanguage: () => {
    const next = get().language === "en" ? "gu" : "en";
    get().setLanguage(next);
    return next;
  },

  // ── Sync from Firestore user doc (called after login / auth restore) ──────────
  //
  // FIX: Prefer localStorage over Firestore on the same device.
  //
  // Previous behaviour: `userDoc.theme || "light"` — since user docs are
  // created with theme:"light", Firestore always "won" and reverted any dark
  // mode the user had set locally.
  //
  // New behaviour:
  //   • If localStorage has a value → use it (the user explicitly set this on
  //     this device, and setTheme now keeps Firestore in sync going forward).
  //   • If localStorage is empty (new device / first install) → use Firestore,
  //     which allows cross-device preference to propagate correctly.
  syncFromUserDoc: (userDoc) => {
    if (!userDoc) return;

    const localTheme = localStorage.getItem(LS_THEME_KEY);
    const localLang  = localStorage.getItem(LS_LANGUAGE_KEY);

    // Prefer the device's localStorage value; fall back to Firestore, then hardcoded default.
    const theme    = localTheme || userDoc.theme    || "light";
    const language = localLang  || userDoc.language || "en";

    // Write back to localStorage to ensure it's always populated for future refreshes.
    localStorage.setItem(LS_THEME_KEY,    theme);
    localStorage.setItem(LS_LANGUAGE_KEY, language);

    applyThemeToDOM(theme);
    set({ theme, language });
  },
}));

export default useThemeStore;