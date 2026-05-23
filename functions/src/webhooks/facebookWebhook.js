/**
 * facebookWebhook.js
 * Firebase Cloud Function HTTPS webhook for Facebook Messenger via Meta Graph API.
 *
 * Handles:
 *   GET  — Meta webhook verification challenge
 *   POST — Incoming Facebook Messenger message events
 *
 * Configure in Meta Business Manager:
 *   Webhook URL: https://us-central1-YOUR_PROJECT.cloudfunctions.net/facebookWebhook
 *   Subscribed fields: messages, messaging_postbacks, messaging_seen
 *
 * Required permissions: pages_messaging
 */

const functions = require("firebase-functions");
const crypto = require("crypto");
const axios = require("axios");
const { upsertConversation, storeMessage, notifyOwner } =
  require("../helpers/messageStore");

// ─── Signature verification ───────────────────────────────────────────────────

function verifySignature(rawBody, signature, appSecret) {
  if (!signature || !appSecret) return false;
  const expected = `sha256=${crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex")}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ─── Resolve Facebook user name ───────────────────────────────────────────────

async function resolveFacebookName(userId, pageAccessToken) {
  try {
    const res = await axios.get(`https://graph.facebook.com/v18.0/${userId}`, {
      params: {
        fields: "first_name,last_name,profile_pic",
        access_token: pageAccessToken,
      },
    });
    const d = res.data;
    if (d.first_name || d.last_name) {
      return `${d.first_name || ""} ${d.last_name || ""}`.trim();
    }
    return userId;
  } catch {
    return userId;
  }
}

// ─── Content extraction ───────────────────────────────────────────────────────

function extractFbContent(message) {
  if (message.text) {
    return { content: message.text, messageType: "text", mediaUrl: null };
  }
  if (message.attachments) {
    const att = message.attachments[0];
    switch (att?.type) {
      case "image":
        return { content: "[Image]", messageType: "image", mediaUrl: att.payload?.url || null };
      case "video":
        return { content: "[Video]", messageType: "video", mediaUrl: att.payload?.url || null };
      case "audio":
        return { content: "[Voice message]", messageType: "audio", mediaUrl: att.payload?.url || null };
      case "file":
        return { content: `[File: ${att.payload?.name || "document"}]`, messageType: "document", mediaUrl: att.payload?.url || null };
      case "location":
        return { content: "[Location shared]", messageType: "location", mediaUrl: null };
      case "fallback":
        return { content: att.title || "[Link shared]", messageType: "link", mediaUrl: att.url || null };
      default:
        return { content: `[${att?.type || "Attachment"}]`, messageType: att?.type || "attachment", mediaUrl: null };
    }
  }
  return { content: "[Unknown message type]", messageType: "unknown", mediaUrl: null };
}

// ─── Cloud Function ───────────────────────────────────────────────────────────

exports.facebookWebhook = functions.https.onRequest(async (req, res) => {
  const cfg = functions.config();
  const verifyToken = cfg.meta?.verify_token;
  const appSecret = cfg.meta?.app_secret;
  const pageAccessToken = cfg.meta?.page_access_token;

  // ── GET: Verification ───────────────────────────────────────────────────────
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === verifyToken) {
      console.log("Facebook Messenger webhook verified");
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Verification failed");
  }

  // ── POST: Incoming event ────────────────────────────────────────────────────
  if (req.method === "POST") {
    const signature = req.headers["x-hub-signature-256"];
    const rawBody = JSON.stringify(req.body);

    if (appSecret && !verifySignature(rawBody, signature, appSecret)) {
      console.error("Facebook webhook: invalid signature");
      return res.status(401).send("Invalid signature");
    }

    const body = req.body;

    if (body.object !== "page") {
      return res.status(200).send("OK");
    }

    for (const entry of body.entry || []) {
      for (const messagingEvent of entry.messaging || []) {
        // Skip echo events
        if (messagingEvent.message?.is_echo) continue;
        // Skip 'read' and 'delivery' notification events
        if (messagingEvent.read || messagingEvent.delivery) continue;

        try {
          const senderId = messagingEvent.sender?.id;
          const timestamp = messagingEvent.timestamp;

          if (!senderId) continue;

          const message = messagingEvent.message;
          const postback = messagingEvent.postback;

          let content, messageType, mediaUrl;

          if (message) {
            // Handle quick reply
            if (message.quick_reply) {
              content = message.quick_reply.payload || message.text || "[Quick reply]";
              messageType = "quick_reply";
              mediaUrl = null;
            } else {
              ({ content, messageType, mediaUrl } = extractFbContent(message));
            }
          } else if (postback) {
            content = postback.title || postback.payload || "[Button clicked]";
            messageType = "postback";
            mediaUrl = null;
          } else {
            continue;
          }

          const contactName = await resolveFacebookName(senderId, pageAccessToken);

          const conversationId = await upsertConversation({
            platform: "facebook",
            contactId: senderId,
            contactName,
            lastMessage: content,
            direction: "inbound",
          });

          await storeMessage(conversationId, {
            platformMessageId: message?.mid || `fb_${senderId}_${timestamp}`,
            content,
            direction: "inbound",
            messageType,
            mediaUrl,
            timestamp: timestamp ? new Date(timestamp) : null,
          });

          await notifyOwner(contactName, "facebook", content, conversationId);

          console.log(`Facebook: stored inbound message from ${contactName}`);
        } catch (err) {
          console.error("Error processing Facebook message:", err.message, err.stack);
        }
      }
    }

    return res.status(200).send("OK");
  }

  return res.status(405).send("Method not allowed");
});
