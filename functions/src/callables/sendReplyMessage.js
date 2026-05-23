/**
 * sendReplyMessage.js
 * Firebase HTTPS Callable Function.
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
 * Add to functions/src/index.js:
 *   const { sendReplyMessage } = require("./callables/sendReplyMessage");
 *   module.exports = { ..., sendReplyMessage };
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { sendMessage, sendWhatsAppCarLinks } = require("../helpers/metaSender");
const { storeMessage } = require("../helpers/messageStore");

const db = admin.firestore();

exports.sendReplyMessage = functions.https.onCall(async (data, context) => {
  // ── Auth check ─────────────────────────────────────────────────────────────
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be signed in.");
  }

  const role = context.auth.token.role;
  if (role !== "owner" && role !== "superadmin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only Owner and SuperAdmin can send messages."
    );
  }

  const { conversationId, platform, contactId, text } = data;

  if (!conversationId || !platform || !contactId || !text) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "conversationId, platform, contactId, and text are required."
    );
  }

  // ── Car quick-send ─────────────────────────────────────────────────────────
  // Detect "/car:<carId>" command from ReplyInput's handleCarSelect
  const carCommandMatch = text.match(/^\/car:(.+)$/);
  if (carCommandMatch && platform === "whatsapp") {
    const carId = carCommandMatch[1].trim();
    return sendCarLinks(carId, contactId, conversationId, context.auth);
  }

  // ── Regular reply ─────────────────────────────────────────────────────────
  let platformMessageId = null;

  try {
    platformMessageId = await sendMessage(platform, contactId, text);
  } catch (err) {
    console.error("Failed to send message via API:", err.message);
    throw new functions.https.HttpsError("internal", `Message send failed: ${err.message}`);
  }

  // Store in Firestore
  await storeMessage(conversationId, {
    platformMessageId,
    content: text,
    direction: "outbound",
    messageType: "text",
    sentByUid: context.auth.uid,
    sentByName: context.auth.token.name || "Owner",
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
    userId: context.auth.uid,
    targetId: conversationId,
    targetCollection: "conversations",
    timestamp: FieldValue.serverTimestamp(),
    metadata: {
      platform,
      messagePreview: text.substring(0, 100),
    },
  });

  return { success: true, messageId: platformMessageId };
});

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
    throw new functions.https.HttpsError("not-found", `Car not found: ${carId}`);
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
