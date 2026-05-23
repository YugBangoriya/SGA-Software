// ─────────────────────────────────────────────────────────────────────────────
// src/store/themeStore.js
// Light / Dark mode + Language toggle.
// Reads initial value from localStorage (fast), then syncs with Firestore.
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

const useThemeStore = create((set, get) => ({
  // ── State ─────────────────────────────────────────────────────────────────────
  theme:    localStorage.getItem(LS_THEME_KEY)    || "light",
  language: localStorage.getItem(LS_LANGUAGE_KEY) || "en",

  // ── Init: apply saved theme immediately on app start ─────────────────────────
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
    // Persist to Firestore via authStore (injected at call site to avoid circular dep)
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
    // Persist to Firestore via authStore (injected at call site)
  },

  toggleLanguage: () => {
    const next = get().language === "en" ? "gu" : "en";
    get().setLanguage(next);
    return next;
  },

  // ── Sync from Firestore user doc (called after login) ─────────────────────────
  syncFromUserDoc: (userDoc) => {
    if (!userDoc) return;
    const theme    = userDoc.theme    || "light";
    const language = userDoc.language || "en";
    localStorage.setItem(LS_THEME_KEY,    theme);
    localStorage.setItem(LS_LANGUAGE_KEY, language);
    applyThemeToDOM(theme);
    set({ theme, language });
  },
}));

export default useThemeStore;
