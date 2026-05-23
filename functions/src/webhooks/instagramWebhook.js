/**
 * instagramWebhook.js
 * Firebase Cloud Function HTTPS webhook for Instagram DMs via Meta Graph API.
 *
 * Handles:
 *   GET  — Meta webhook verification challenge
 *   POST — Incoming Instagram DM events
 *
 * Configure in Meta Business Manager:
 *   Webhook URL: https://us-central1-YOUR_PROJECT.cloudfunctions.net/instagramWebhook
 *   Subscribed fields: messages, messaging_postbacks
 *
 * Required permissions: instagram_basic, instagram_manage_messages
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

// ─── Resolve Instagram username ───────────────────────────────────────────────

/**
 * Fetches the Instagram username for a scoped user ID.
 * Uses the token to resolve the name for the conversation list.
 */
async function resolveInstagramName(userId, token) {
  try {
    const res = await axios.get(`https://graph.facebook.com/v18.0/${userId}`, {
      params: { fields: "name,username,profile_pic", access_token: token },
    });
    return res.data?.name || res.data?.username || userId;
  } catch {
    return userId; // Fall back to ID if lookup fails
  }
}

// ─── Content extraction ───────────────────────────────────────────────────────

function extractIgContent(message) {
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
        return { content: "[File]", messageType: "document", mediaUrl: att.payload?.url || null };
      case "story_mention":
        return { content: "[Story mention]", messageType: "story_mention", mediaUrl: null };
      case "ig_reel":
        return { content: "[Reel share]", messageType: "reel", mediaUrl: att.payload?.url || null };
      default:
        return { content: `[${att?.type || "Attachment"}]`, messageType: att?.type || "attachment", mediaUrl: null };
    }
  }
  if (message.sticker_id) {
    return { content: "[Sticker]", messageType: "sticker", mediaUrl: null };
  }
  return { content: "[Unknown message type]", messageType: "unknown", mediaUrl: null };
}

// ─── Cloud Function ───────────────────────────────────────────────────────────

exports.instagramWebhook = functions.https.onRequest(async (req, res) => {
  const cfg = functions.config();
  const verifyToken = cfg.meta?.verify_token;
  const appSecret = cfg.meta?.app_secret;
  const instagramToken = cfg.meta?.instagram_token;

  // ── GET: Verification ───────────────────────────────────────────────────────
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === verifyToken) {
      console.log("Instagram webhook verified");
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Verification failed");
  }

  // ── POST: Incoming event ────────────────────────────────────────────────────
  if (req.method === "POST") {
    const signature = req.headers["x-hub-signature-256"];
    const rawBody = JSON.stringify(req.body);

    if (appSecret && !verifySignature(rawBody, signature, appSecret)) {
      console.error("Instagram webhook: invalid signature");
      return res.status(401).send("Invalid signature");
    }

    const body = req.body;

    // Instagram events come through the "instagram" object field
    if (body.object !== "instagram") {
      return res.status(200).send("OK");
    }

    for (const entry of body.entry || []) {
      for (const messagingEvent of entry.messaging || []) {
        // Skip echo events (messages sent by the page itself)
        if (messagingEvent.message?.is_echo) continue;

        try {
          const senderId = messagingEvent.sender?.id;
          const recipientId = messagingEvent.recipient?.id;
          const timestamp = messagingEvent.timestamp;

          if (!senderId) continue;

          // Determine if this is inbound (customer → us) or outbound echo
          // sender = customer, recipient = our page
          const isInbound = senderId !== recipientId;
          if (!isInbound) continue;

          const message = messagingEvent.message;
          const postback = messagingEvent.postback;

          let content, messageType, mediaUrl;

          if (message) {
            ({ content, messageType, mediaUrl } = extractIgContent(message));
          } else if (postback) {
            content = postback.title || postback.payload || "[Postback]";
            messageType = "postback";
            mediaUrl = null;
          } else {
            continue; // Unsupported event type
          }

          // Resolve display name (may be slow — consider caching)
          const contactName = await resolveInstagramName(senderId, instagramToken);

          const conversationId = await upsertConversation({
            platform: "instagram",
            contactId: senderId,
            contactName,
            lastMessage: content,
            direction: "inbound",
          });

          await storeMessage(conversationId, {
            platformMessageId: message?.mid || `ig_${senderId}_${timestamp}`,
            content,
            direction: "inbound",
            messageType,
            mediaUrl,
            timestamp: timestamp ? new Date(timestamp) : null,
          });

          await notifyOwner(contactName, "instagram", content, conversationId);

          console.log(`Instagram: stored inbound message from ${contactName}`);
        } catch (err) {
          console.error("Error processing Instagram message:", err.message, err.stack);
        }
      }
    }

    return res.status(200).send("OK");
  }

  return res.status(405).send("Method not allowed");
});
