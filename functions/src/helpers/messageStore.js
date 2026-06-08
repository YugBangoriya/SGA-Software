/**
 * messageStore.js
 * Firestore read/write helpers for conversations, messages, and notes.
 * Used by all three webhook handlers.
 */

const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

const db = admin.firestore();

/**
 * Creates or updates a conversation document.
 * Conversations are keyed by platform + contactId (e.g. "whatsapp_+919876543210").
 *
 * @param {Object} params
 * @param {'whatsapp'|'instagram'|'facebook'} params.platform
 * @param {string} params.contactId  - phone number (WA) or platform user ID (IG/FB)
 * @param {string} params.contactName
 * @param {string} params.lastMessage - text preview of the last message
 * @param {'inbound'|'outbound'} params.direction
 * @param {string} [params.contactProfilePic]
 * @param {string} [params.contactPhone] - WA only
 * @returns {Promise<string>} conversationId
 */
async function upsertConversation({
  platform,
  contactId,
  contactName,
  lastMessage,
  direction,
  contactProfilePic = "",
  contactPhone = "",
}) {
  const conversationId = `${platform}_${contactId}`;
  const ref = db.collection("conversations").doc(conversationId);

  const snap = await ref.get();

  if (!snap.exists) {
    // Create new conversation
    await ref.set({
      id: conversationId,
      platform,
      contactId,
      contactName,
      contactPhone,
      contactProfilePic,
      lastMessage,
      lastMessageAt: FieldValue.serverTimestamp(),
      lastMessageBy: direction === "inbound" ? "customer" : "owner",
      unreadCount: direction === "inbound" ? 1 : 0,
      hasFollowUp: false,
      followUpScheduledAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });
  } else {
    // Update existing conversation
    const updateData = {
      lastMessage,
      lastMessageAt: FieldValue.serverTimestamp(),
      lastMessageBy: direction === "inbound" ? "customer" : "owner",
    };

    if (direction === "inbound") {
      updateData.unreadCount = FieldValue.increment(1);
    }

    // Update contact name/pic if provided and different
    if (contactName && contactName !== snap.data().contactName) {
      updateData.contactName = contactName;
    }
    if (contactProfilePic) {
      updateData.contactProfilePic = contactProfilePic;
    }

    await ref.update(updateData);
  }

  return conversationId;
}

/**
 * Stores an individual message in the messages subcollection.
 *
 * @param {string} conversationId
 * @param {Object} params
 * @param {string} params.platformMessageId - ID from Meta's platform
 * @param {string} params.content - text content
 * @param {'inbound'|'outbound'} params.direction
 * @param {'text'|'image'|'document'|'audio'|'video'|'template'} params.messageType
 * @param {string} [params.mediaUrl]
 * @param {string} [params.mediaType]
 * @param {string} [params.sentByUid] - Firebase UID for outbound messages
 * @param {string} [params.sentByName] - Display name for outbound messages
 * @param {Date} [params.timestamp] - actual timestamp from Meta (if available)
 * @returns {Promise<string>} messageId
 */
async function storeMessage(
  conversationId,
  {
    platformMessageId,
    content,
    direction,
    messageType = "text",
    mediaUrl = null,
    mediaType = null,
    sentByUid = null,
    sentByName = null,
    timestamp = null,
  }
) {
  const messagesRef = db
    .collection("conversations")
    .doc(conversationId)
    .collection("messages");

  // Check for duplicate (Meta sometimes re-delivers webhooks)
  if (platformMessageId) {
    const existing = await messagesRef
      .where("platformMessageId", "==", platformMessageId)
      .limit(1)
      .get();
    if (!existing.empty) {
      return existing.docs[0].id; // already stored
    }
  }

  const messageData = {
    platformMessageId: platformMessageId || null,
    content,
    direction,
    messageType,
    mediaUrl,
    mediaType,
    status: direction === "outbound" ? "sent" : "received",
    sentByUid,
    sentByName,
    timestamp: timestamp
      ? admin.firestore.Timestamp.fromDate(new Date(timestamp))
      : FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  };

  const ref = await messagesRef.add(messageData);
  return ref.id;
}

/**
 * Marks all messages in a conversation as read (resets unreadCount).
 * Called when owner opens a conversation.
 *
 * @param {string} conversationId
 */
async function markConversationRead(conversationId) {
  await db.collection("conversations").doc(conversationId).update({
    unreadCount: 0,
  });
}

/**
 * Updates the status of a sent outbound message (delivered / read / failed).
 *
 * @param {string} conversationId
 * @param {string} platformMessageId
 * @param {'delivered'|'read'|'failed'} status
 */
async function updateMessageStatus(conversationId, platformMessageId, status) {
  const snap = await db
    .collection("conversations")
    .doc(conversationId)
    .collection("messages")
    .where("platformMessageId", "==", platformMessageId)
    .limit(1)
    .get();

  if (!snap.empty) {
    await snap.docs[0].ref.update({ status });
  }
}

/**
 * Sends a push notification to the owner when a new inbound message arrives.
 * Uses Firebase Cloud Messaging. Owner's FCM token must be stored in /users/{ownerUid}.
 *
 * Set OWNER_UID in functions/.env (non-secret environment variable):
 *   OWNER_UID=<firebase_uid_of_owner>
 *
 * @param {string} contactName
 * @param {string} platform
 * @param {string} messagePreview
 * @param {string} conversationId
 */
async function notifyOwner(contactName, platform, messagePreview, conversationId) {
  try {
    // Issue 4 migration: removed functions.config() fallback.
    // Set OWNER_UID in functions/.env — if not set, notifications are silently skipped.
    const ownerUid = process.env.OWNER_UID;

    if (!ownerUid) return;

    const ownerDoc = await db.collection("users").doc(ownerUid).get();
    if (!ownerDoc.exists) return;

    const { fcmToken } = ownerDoc.data();
    if (!fcmToken) return;

    const platformLabels = {
      whatsapp: "WhatsApp",
      instagram: "Instagram",
      facebook: "Facebook",
    };

    await admin.messaging().send({
      token: fcmToken,
      notification: {
        title: `${contactName} (${platformLabels[platform] || platform})`,
        body: messagePreview.length > 100
          ? messagePreview.substring(0, 97) + "..."
          : messagePreview,
      },
      data: {
        type: "new_message",
        conversationId,
        platform,
      },
      webpush: {
        fcmOptions: {
          link: `/messaging`,
        },
      },
    });
  } catch (err) {
    // Non-fatal — log but don't throw
    console.error("Failed to send owner notification:", err.message);
  }
}

module.exports = {
  upsertConversation,
  storeMessage,
  markConversationRead,
  updateMessageStatus,
  notifyOwner,
};