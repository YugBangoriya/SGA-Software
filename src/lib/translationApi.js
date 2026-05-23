/**
 * translationApi.js
 * Frontend wrapper for the translateMessage Firebase Cloud Function.
 * Used in FollowUpScheduler and TemplateManager for live translation suggestions.
 */

import { getFunctions, httpsCallable } from "firebase/functions";

let translateFn = null;

function getTranslateFn() {
  if (!translateFn) {
    const functions = getFunctions();
    translateFn = httpsCallable(functions, "translateMessage");
  }
  return translateFn;
}

/**
 * Translates text into one or more target languages.
 *
 * @param {string} text - source text
 * @param {string[]} targetLanguages - e.g. ["hi", "gu"] or ["en", "hi", "gu"]
 * @returns {Promise<{[lang: string]: string}>} map of language code → translated text
 *
 * @example
 * const result = await translateToLanguages("Hello, following up on your enquiry", ["hi", "gu"]);
 * // { hi: "नमस्ते, आपकी जांच के बाद...", gu: "નમસ્તે, આપની ..." }
 */
export async function translateToLanguages(text, targetLanguages) {
  if (!text || !text.trim()) return {};
  if (!targetLanguages || targetLanguages.length === 0) return {};

  const fn = getTranslateFn();
  const result = await fn({ text: text.trim(), targetLanguages });
  return result.data?.translations || {};
}

/**
 * Translates a message draft into all three supported languages.
 * Used in the template manager to fill in all language variants.
 *
 * @param {string} text
 * @param {'en'|'hi'|'gu'} sourceLanguage - the language being typed in
 * @returns {Promise<{en: string, hi: string, gu: string}>}
 */
export async function translateToAllLanguages(text, sourceLanguage = "en") {
  if (!text || !text.trim()) return { en: "", hi: "", gu: "" };

  const allLangs = ["en", "hi", "gu"];
  const targets = allLangs.filter((l) => l !== sourceLanguage);

  const translations = await translateToLanguages(text, targets);

  return {
    ...translations,
    [sourceLanguage]: text, // keep the source language as-is
  };
}

/**
 * Simple debounce helper for use with translation on keypress.
 * @param {Function} fn
 * @param {number} delay - milliseconds
 * @returns {Function}
 */
export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
