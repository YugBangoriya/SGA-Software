/**
 * whatsappWebhook.js
 * Firebase Cloud Function HTTPS webhook for WhatsApp Cloud API.
 *
 * Handles:
 *   GET  — Meta webhook verification challenge
 *   POST — Incoming messages, message status updates
 *
 * Configure in Meta Business Manager:
 *   Webhook URL: https://us-central1-YOUR_PROJECT.cloudfunctions.net/whatsappWebhook
 *   Subscribed fields: messages
 */

const functions = require("firebase-functions");
const crypto = require("crypto");
const { upsertConversation, storeMessage, updateMessageStatus, notifyOwner } =
  require("../helpers/messageStore");

// ─── Signature verification ───────────────────────────────────────────────────

/**
 * Verifies Meta's x-hub-signature-256 header to confirm the request is genuine.
 */
function verifySignature(rawBody, signature, appSecret) {
  if (!signature || !appSecret) return false;
  const expected = `sha256=${crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex")}`;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// ─── Text extraction ──────────────────────────────────────────────────────────

/**
 * Extracts human-readable text and media info from a WhatsApp message object.
 */
function extractMessageContent(msg) {
  switch (msg.type) {
    case "text":
      return { content: msg.text?.body || "", messageType: "text", mediaUrl: null, mediaType: null };
    case "image":
      return { content: "[Image]", messageType: "image", mediaUrl: msg.image?.id || null, mediaType: "image" };
    case "document":
      return {
        content: `[Document: ${msg.document?.filename || "file"}]`,
        messageType: "document",
        mediaUrl: msg.document?.id || null,
        mediaType: "document",
      };
    case "audio":
      return { content: "[Voice message]", messageType: "audio", mediaUrl: msg.audio?.id || null, mediaType: "audio" };
    case "video":
      return { content: "[Video]", messageType: "video", mediaUrl: msg.video?.id || null, mediaType: "video" };
    case "location":
      return {
        content: `[Location: ${msg.location?.name || `${msg.location?.latitude}, ${msg.location?.longitude}`}]`,
        messageType: "location",
        mediaUrl: null,
        mediaType: null,
      };
    case "sticker":
      return { content: "[Sticker]", messageType: "sticker", mediaUrl: msg.sticker?.id || null, mediaType: "sticker" };
    case "interactive":
      // Button replies, list replies
      return {
        content: msg.interactive?.button_reply?.title ||
          msg.interactive?.list_reply?.title ||
          "[Interactive response]",
        messageType: "interactive",
        mediaUrl: null,
        mediaType: null,
      };
    default:
      return { content: `[${msg.type || "Unknown message"}]`, messageType: msg.type || "unknown", mediaUrl: null, mediaType: null };
  }
}

// ─── Cloud Function ───────────────────────────────────────────────────────────

exports.whatsappWebhook = functions.https.onRequest(async (req, res) => {
  const cfg = functions.config();
  const verifyToken = cfg.whatsapp?.verify_token;
  const appSecret = cfg.whatsapp?.app_secret;

  // ── GET: Meta webhook verification ─────────────────────────────────────────
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === verifyToken) {
      console.log("WhatsApp webhook verified");
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Verification failed");
  }

  // ── POST: Incoming event ────────────────────────────────────────────────────
  if (req.method === "POST") {
    // Verify signature
    const signature = req.headers["x-hub-signature-256"];
    const rawBody = JSON.stringify(req.body);

    if (appSecret && !verifySignature(rawBody, signature, appSecret)) {
      console.error("WhatsApp webhook: invalid signature");
      return res.status(401).send("Invalid signature");
    }

    const body = req.body;

    // Confirm it's a WhatsApp event
    if (body.object !== "whatsapp_business_account") {
      return res.status(200).send("OK"); // Acknowledge unknown events
    }

    // Process each entry (usually just one in production)
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "messages") continue;

        const value = change.value;
        const metadata = value.metadata;
        const contacts = value.contacts || [];
        const messages = value.messages || [];
        const statuses = value.statuses || [];

        // ── Process inbound messages ────────────────────────────────────────
        for (const msg of messages) {
          try {
            const contactInfo = contacts.find((c) => c.wa_id === msg.from) || {};
            const contactName = contactInfo.profile?.name || msg.from;
            const contactPhone = `+${msg.from}`;

            const { content, messageType, mediaUrl, mediaType } =
              extractMessageContent(msg);

            // Store / update conversation
            const conversationId = await upsertConversation({
              platform: "whatsapp",
              contactId: contactPhone,
              contactName,
              contactPhone,
              lastMessage: content,
              direction: "inbound",
            });

            // Store message
            await storeMessage(conversationId, {
              platformMessageId: msg.id,
              content,
              direction: "inbound",
              messageType,
              mediaUrl,
              mediaType,
              timestamp: msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000) : null,
            });

            // Notify owner
            await notifyOwner(contactName, "whatsapp", content, conversationId);

            console.log(`WhatsApp: stored inbound message from ${contactName}`);
          } catch (err) {
            console.error("Error processing WhatsApp message:", err.message, err.stack);
          }
        }

        // ── Process status updates (delivered, read, failed) ────────────────
        for (const status of statuses) {
          try {
            if (!["delivered", "read", "failed"].includes(status.status)) continue;

            const contactPhone = `+${status.recipient_id}`;
            const conversationId = `whatsapp_${contactPhone}`;

            await updateMessageStatus(conversationId, status.id, status.status);
          } catch (err) {
            console.error("Error updating message status:", err.message);
          }
        }
      }
    }

    // Always respond 200 quickly — Meta will retry if you don't
    return res.status(200).send("OK");
  }

  return res.status(405).send("Method not allowed");
});
