/**
 * metaSender.js
 * Sends outbound messages via:
 *   - WhatsApp Cloud API
 *   - Instagram Graph API (DM reply)
 *   - Facebook Messenger API (reply)
 *
 * All three platforms use Meta's Graph API under the hood,
 * but with different endpoints and payload shapes.
 *
 * Issue 4 migration: replaced functions.config() with process.env.
 * The calling function MUST declare the relevant secrets in its options:
 *   WhatsApp sends  → WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID
 *   Instagram sends → META_INSTAGRAM_TOKEN
 *   Facebook sends  → META_PAGE_ACCESS_TOKEN
 */

const axios = require("axios");

// ─── Config helpers ───────────────────────────────────────────────────────────

function getWhatsAppConfig() {
  return {
    token: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  };
}

function getMetaConfig() {
  return {
    pageAccessToken: process.env.META_PAGE_ACCESS_TOKEN,
    instagramToken: process.env.META_INSTAGRAM_TOKEN,
  };
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────

/**
 * Sends a free-form text message via WhatsApp Cloud API.
 * Only valid within the 24-hour customer service window (customer messaged first).
 *
 * @param {string} to - recipient phone number in E.164 format (e.g. +919876543210)
 * @param {string} text - message text
 * @returns {Promise<string>} platformMessageId
 */
async function sendWhatsAppText(to, text) {
  const { token, phoneNumberId } = getWhatsAppConfig();
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { preview_url: false, body: text },
  };

  const res = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  return res.data?.messages?.[0]?.id || null;
}

/**
 * Sends a WhatsApp template message (for follow-ups, reminders, quotations).
 * Template must be pre-approved in Meta Business Manager.
 *
 * @param {string} to - E.164 phone number
 * @param {string} templateName - approved template name (e.g. "follow_up_en")
 * @param {string} languageCode - "en_US" | "hi" | "gu"
 * @param {Array<Object>} components - template component variables
 * @returns {Promise<string>} platformMessageId
 */
async function sendWhatsAppTemplate(to, templateName, languageCode, components = []) {
  const { token, phoneNumberId } = getWhatsAppConfig();
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  };

  const res = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  return res.data?.messages?.[0]?.id || null;
}

/**
 * Sends a car media links message via WhatsApp template.
 * Uses the "car_media_links" template which must be registered in Meta.
 * Template body: "Here are the details for {{1}}:\n📸 Photos: {{2}}\n🎥 Videos: {{3}}"
 *
 * @param {string} to - E.164 phone number
 * @param {string} carName - e.g. "Maruti Swift"
 * @param {string} driveLink - Google Drive images link
 * @param {string[]} reelLinks - array of Instagram reel links
 * @returns {Promise<string>} platformMessageId
 */
async function sendWhatsAppCarLinks(to, carName, driveLink, reelLinks) {
  const reelsText = reelLinks.length > 0
    ? reelLinks.map((link, i) => `Reel ${i + 1}: ${link}`).join("\n")
    : "No reel videos available";

  const components = [
    {
      type: "body",
      parameters: [
        { type: "text", text: carName },
        { type: "text", text: driveLink || "Link not available" },
        { type: "text", text: reelsText },
      ],
    },
  ];

  return sendWhatsAppTemplate(to, "car_media_links", "en_US", components);
}

/**
 * Sends a WhatsApp follow-up template message.
 *
 * @param {string} to - E.164 phone number
 * @param {string} customerName
 * @param {string} message - the custom follow-up body text
 * @param {'en'|'hi'|'gu'} language
 * @returns {Promise<string>} platformMessageId
 */
async function sendWhatsAppFollowUp(to, customerName, message, language) {
  const langCodeMap = { en: "en_US", hi: "hi", gu: "gu" };
  const templateNameMap = { en: "follow_up_en", hi: "follow_up_hi", gu: "follow_up_gu" };

  const components = [
    {
      type: "body",
      parameters: [
        { type: "text", text: customerName },
        { type: "text", text: message },
      ],
    },
  ];

  return sendWhatsAppTemplate(
    to,
    templateNameMap[language] || "follow_up_en",
    langCodeMap[language] || "en_US",
    components
  );
}

// ─── Instagram ────────────────────────────────────────────────────────────────

/**
 * Sends a text reply to an Instagram DM.
 *
 * @param {string} recipientId - Instagram-scoped user ID
 * @param {string} text - message text
 * @returns {Promise<string>} platformMessageId
 */
async function sendInstagramMessage(recipientId, text) {
  const { instagramToken } = getMetaConfig();
  const url = "https://graph.facebook.com/v18.0/me/messages";

  const payload = {
    recipient: { id: recipientId },
    message: { text },
    messaging_type: "RESPONSE",
  };

  const res = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${instagramToken}`,
      "Content-Type": "application/json",
    },
  });

  return res.data?.message_id || null;
}

// ─── Facebook Messenger ───────────────────────────────────────────────────────

/**
 * Sends a text reply via Facebook Messenger.
 *
 * @param {string} recipientId - Facebook-scoped page-scoped user ID
 * @param {string} text - message text
 * @returns {Promise<string>} platformMessageId
 */
async function sendFacebookMessage(recipientId, text) {
  const { pageAccessToken } = getMetaConfig();
  const url = "https://graph.facebook.com/v18.0/me/messages";

  const payload = {
    recipient: { id: recipientId },
    message: { text },
    messaging_type: "RESPONSE",
  };

  const res = await axios.post(url, payload, {
    params: { access_token: pageAccessToken },
    headers: { "Content-Type": "application/json" },
  });

  return res.data?.message_id || null;
}

// ─── Unified sender ───────────────────────────────────────────────────────────

/**
 * Send a message to any platform using a single call.
 * The platform is determined from the conversationId prefix or explicit param.
 *
 * @param {'whatsapp'|'instagram'|'facebook'} platform
 * @param {string} contactId - phone (WA) or platform user ID (IG/FB)
 * @param {string} text
 * @returns {Promise<string>} platformMessageId
 */
async function sendMessage(platform, contactId, text) {
  switch (platform) {
    case "whatsapp":
      return sendWhatsAppText(contactId, text);
    case "instagram":
      return sendInstagramMessage(contactId, text);
    case "facebook":
      return sendFacebookMessage(contactId, text);
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}

module.exports = {
  sendMessage,
  sendWhatsAppText,
  sendWhatsAppTemplate,
  sendWhatsAppCarLinks,
  sendWhatsAppFollowUp,
  sendInstagramMessage,
  sendFacebookMessage,
};