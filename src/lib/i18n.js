// ─────────────────────────────────────────────────────────────────────────────
// src/lib/i18n.js
// i18next configuration for English / Gujarati support.
// Language is persisted per-user in Firestore and synced to localStorage.
// ─────────────────────────────────────────────────────────────────────────────

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en.json";
import gu from "@/locales/gu.json";

const savedLang = localStorage.getItem("sga_language") || "en";

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      gu: { translation: gu },
    },
    lng:         savedLang,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

export default i18n;
