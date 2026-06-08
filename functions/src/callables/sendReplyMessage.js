/**
 * sendReplyMessage.js
 * Firebase HTTPS Callable Function (v2).
 * Called from the React frontend when the owner sends a reply.
 *
 * Input:
 *   { conversationId, platform, contactId, text }
 *
 * Output:
 *   { success: true, messageId: "<platformMessageId>" }
 *
 * Handles:
 *   1. Auth check (owner or superadmin only)
 *   2. Car quick-send: if text starts with "/car:<carId>", fetch car data and send template
 *   3. Regular text reply via sendMessage()
 *   4. Store outbound message in Firestore
 *   5. Update conversation lastMessage
 *   6. Write audit log entry
 *
 * Issue 4 migration:
 *   - Migrated from v1 onCall(data, context) to v2 onCall(request)
 *   - Replaced functions.https.HttpsError with HttpsError from firebase-functions/v2/https
 *   - Declared secrets required by metaSender.js helpers
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret }       = require("firebase-functions/params");
const admin                  = require("firebase-admin");
const { FieldValue }         = require("firebase-admin/firestore");
const { sendMessage, sendWhatsAppCarLinks } = require("../helpers/metaSender");
const { storeMessage }       = require("../helpers/messageStore");

const db = admin.firestore();

// ── Secret declarations (module-level, required by Firebase v2) ───────────────
// These secrets are needed by metaSender.js helpers called within this function.
const WHATSAPP_ACCESS_TOKEN    = defineSecret("WHATSAPP_ACCESS_TOKEN");
const WHATSAPP_PHONE_NUMBER_ID = defineSecret("WHATSAPP_PHONE_NUMBER_ID");
const META_PAGE_ACCESS_TOKEN   = defineSecret("META_PAGE_ACCESS_TOKEN");
const META_INSTAGRAM_TOKEN     = defineSecret("META_INSTAGRAM_TOKEN");

exports.sendReplyMessage = onCall(
  {
    secrets: [
      WHATSAPP_ACCESS_TOKEN,
      WHATSAPP_PHONE_NUMBER_ID,
      META_PAGE_ACCESS_TOKEN,
      META_INSTAGRAM_TOKEN,
    ],
  },
  async (request) => {
    // ── Auth check ─────────────────────────────────────────────────────────────
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const role = request.auth.token.role;
    if (role !== "owner" && role !== "superadmin") {
      throw new HttpsError(
        "permission-denied",
        "Only Owner and SuperAdmin can send messages."
      );
    }

    const { conversationId, platform, contactId, text } = request.data;

    if (!conversationId || !platform || !contactId || !text) {
      throw new HttpsError(
        "invalid-argument",
        "conversationId, platform, contactId, and text are required."
      );
    }

    // ── Car quick-send ─────────────────────────────────────────────────────────
    // Detect "/car:<carId>" command from ReplyInput's handleCarSelect
    const carCommandMatch = text.match(/^\/car:(.+)$/);
    if (carCommandMatch && platform === "whatsapp") {
      const carId = carCommandMatch[1].trim();
      return sendCarLinks(carId, contactId, conversationId, request.auth);
    }

    // ── Regular reply ─────────────────────────────────────────────────────────
    let platformMessageId = null;

    try {
      platformMessageId = await sendMessage(platform, contactId, text);
    } catch (err) {
      console.error("Failed to send message via API:", err.message);
      throw new HttpsError("internal", `Message send failed: ${err.message}`);
    }

    // Store in Firestore
    await storeMessage(conversationId, {
      platformMessageId,
      content: text,
      direction: "outbound",
      messageType: "text",
      sentByUid: request.auth.uid,
      sentByName: request.auth.token.name || "Owner",
    });

    // Update conversation last message
    await db.collection("conversations").doc(conversationId).update({
      lastMessage: text,
      lastMessageAt: FieldValue.serverTimestamp(),
      lastMessageBy: "owner",
    });

    // Audit log
    await db.collection("auditLog").add({
      action: "message_sent",
      userId: request.auth.uid,
      targetId: conversationId,
      targetCollection: "conversations",
      timestamp: FieldValue.serverTimestamp(),
      metadata: {
        platform,
        messagePreview: text.substring(0, 100),
      },
    });

    return { success: true, messageId: platformMessageId };
  }
);

/**
 * Sends car media links as a WhatsApp template message.
 */
async function sendCarLinks(carId, contactId, conversationId, auth) {
  // Fetch car data from Car Repository
  const carRepoQuery = await db
    .collection("carRepository")
    .where("models", "array-contains", carId)
    .limit(1)
    .get();

  // Try direct document lookup
  let carData = null;
  const carDoc = await db.collection("carRepository").doc(carId).get().catch(() => null);

  if (carDoc && carDoc.exists) {
    carData = carDoc.data();
  } else {
    // Search through all car companies for this model
    const allCars = await db.collection("carRepository").get();
    for (const company of allCars.docs) {
      const data = company.data();
      const model = (data.models || []).find((m) => m.id === carId || m.name === carId);
      if (model) {
        carData = {
          carName: `${data.company} ${model.name}`,
          driveLink: model.driveLink || "",
          reelLinks: model.reelLinks || [],
        };
        break;
      }
    }
  }

  if (!carData) {
    throw new HttpsError("not-found", `Car not found: ${carId}`);
  }

  const { carName, driveLink, reelLinks } = carData;
  const platformMessageId = await sendWhatsAppCarLinks(
    contactId,
    carName,
    driveLink,
    reelLinks || []
  );

  const messageContent = `🚗 ${carName}\n📸 Photos: ${driveLink || "N/A"}\n🎥 Videos: ${
    (reelLinks || []).join(", ") || "N/A"
  }`;

  await storeMessage(conversationId, {
    platformMessageId,
    content: messageContent,
    direction: "outbound",
    messageType: "template",
    sentByUid: auth.uid,
    sentByName: auth.token.name || "Owner",
  });

  await db.collection("conversations").doc(conversationId).update({
    lastMessage: `🚗 Sent car info: ${carName}`,
    lastMessageAt: FieldValue.serverTimestamp(),
    lastMessageBy: "owner",
  });

  return { success: true, messageId: platformMessageId };
}