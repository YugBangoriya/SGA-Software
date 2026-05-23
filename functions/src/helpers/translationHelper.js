/**
 * translationHelper.js
 * Google Cloud Translation API wrapper.
 * Also exports a Firebase HTTP-callable function used by the frontend
 * to get translation suggestions while the owner types a follow-up message.
 */

const axios = require("axios");
const functions = require("firebase-functions");

/**
 * Translates text using Google Cloud Translation API v3.
 *
 * @param {string} text - source text to translate
 * @param {string} targetLang - BCP-47 language code: "en" | "hi" | "gu"
 * @param {string} [sourceLang] - optional source language hint
 * @returns {Promise<string>} translated text
 */
async function translateText(text, targetLang, sourceLang = null) {
  if (!text || !text.trim()) return "";

  const apiKey = functions.config().google?.translation_api_key;
  if (!apiKey) {
    console.warn("Google Translation API key not configured");
    return text;
  }

  const url = `https://translation.googleapis.com/language/translate/v2`;

  const params = {
    q: text,
    target: targetLang,
    format: "text",
    key: apiKey,
  };

  if (sourceLang) {
    params.source = sourceLang;
  }

  const res = await axios.post(url, null, { params });
  return res.data?.data?.translations?.[0]?.translatedText || text;
}

/**
 * Firebase HTTP-callable function.
 * Called from the React frontend to translate follow-up message drafts.
 *
 * Input:  { text: string, targetLanguages: string[] }
 *         e.g. { text: "Hello, following up on your enquiry", targetLanguages: ["hi", "gu"] }
 *
 * Output: { translations: { hi: "...", gu: "..." } }
 *
 * Auth: must be signed in with owner or superadmin role.
 */
const translateMessage = functions.https.onCall(async (data, context) => {
  // Require authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be signed in to use translation."
    );
  }

  // Only owner and superadmin can use this feature
  const role = context.auth.token.role;
  if (role !== "owner" && role !== "superadmin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only Owner and SuperAdmin can use translation."
    );
  }

  const { text, targetLanguages } = data;

  if (!text || typeof text !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "text must be a non-empty string.");
  }

  if (!Array.isArray(targetLanguages) || targetLanguages.length === 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "targetLanguages must be a non-empty array."
    );
  }

  // Validate language codes
  const allowed = ["en", "hi", "gu"];
  for (const lang of targetLanguages) {
    if (!allowed.includes(lang)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Unsupported language: ${lang}. Must be one of: en, hi, gu`
      );
    }
  }

  try {
    const results = await Promise.all(
      targetLanguages.map(async (lang) => {
        const translated = await translateText(text, lang);
        return [lang, translated];
      })
    );

    return { translations: Object.fromEntries(results) };
  } catch (err) {
    console.error("Translation error:", err.message);
    throw new functions.https.HttpsError("internal", "Translation failed. Please try again.");
  }
});

module.exports = { translateMessage, translateText };
