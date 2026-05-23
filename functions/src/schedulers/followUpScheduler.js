/**
 * followUpScheduler.js
 * Firebase Scheduled Cloud Function — runs daily at 9:00 AM IST.
 *
 * Scans /followUps collection for documents where:
 *   status == "pending"
 *   scheduledAt <= now
 *
 * For each due follow-up:
 *   1. Resolves the conversation to get contact details
 *   2. Sends the message via the appropriate platform
 *   3. Updates followUp.status = "sent", followUp.sentAt = now
 *   4. Stores the sent message in the conversation's messages subcollection
 *   5. Sends an in-app push notification to the owner
 *   6. Creates an audit log entry
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const {
  sendWhatsAppFollowUp,
  sendInstagramMessage,
  sendFacebookMessage,
} = require("../helpers/metaSender");
const { storeMessage, notifyOwner } = require("../helpers/messageStore");

const db = admin.firestore();

// Runs every day at 09:00 AM IST (UTC+5:30 = 03:30 UTC)
exports.followUpScheduler = functions.pubsub
  .schedule("30 3 * * *")
  .timeZone("Asia/Kolkata")
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();

    console.log(`Follow-up scheduler running at ${new Date().toISOString()}`);

    // Query all pending follow-ups that are due
    const snapshot = await db
      .collection("followUps")
      .where("status", "==", "pending")
      .where("scheduledAt", "<=", now)
      .get();

    if (snapshot.empty) {
      console.log("No pending follow-ups due today.");
      return null;
    }

    console.log(`Found ${snapshot.size} due follow-up(s)`);

    const results = await Promise.allSettled(
      snapshot.docs.map((doc) => processSingleFollowUp(doc))
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(`Follow-up scheduler complete: ${succeeded} sent, ${failed} failed`);
    return null;
  });

/**
 * Processes and sends a single follow-up.
 * @param {FirebaseFirestore.DocumentSnapshot} doc
 */
async function processSingleFollowUp(doc) {
  const followUp = doc.data();
  const followUpId = doc.id;

  try {
    const {
      conversationId,
      platform,
      contactId,
      contactName,
      customMessage,
      language = "en",
    } = followUp;

    if (!conversationId || !platform || !contactId || !customMessage) {
      throw new Error(`Missing required fields in followUp ${followUpId}`);
    }

    let platformMessageId = null;

    // Send via appropriate platform
    switch (platform) {
      case "whatsapp":
        platformMessageId = await sendWhatsAppFollowUp(
          contactId,
          contactName || "Customer",
          customMessage,
          language
        );
        break;

      case "instagram":
        platformMessageId = await sendInstagramMessage(contactId, customMessage);
        break;

      case "facebook":
        platformMessageId = await sendFacebookMessage(contactId, customMessage);
        break;

      default:
        throw new Error(`Unknown platform: ${platform}`);
    }

    // Store the sent message in the conversation thread
    await storeMessage(conversationId, {
      platformMessageId,
      content: customMessage,
      direction: "outbound",
      messageType: platform === "whatsapp" ? "template" : "text",
      sentByName: "Auto Follow-up",
    });

    // Update conversation's last message
    await db.collection("conversations").doc(conversationId).update({
      lastMessage: customMessage,
      lastMessageAt: FieldValue.serverTimestamp(),
      lastMessageBy: "owner",
      hasFollowUp: false,
      followUpScheduledAt: null,
    });

    // Mark follow-up as sent
    await doc.ref.update({
      status: "sent",
      sentAt: FieldValue.serverTimestamp(),
      platformMessageId: platformMessageId || null,
    });

    // Notify owner that follow-up was sent
    await notifyOwner(
      contactName || "Customer",
      platform,
      `✅ Follow-up sent: "${customMessage.substring(0, 60)}${customMessage.length > 60 ? "..." : ""}"`,
      conversationId
    );

    // Write audit log
    await db.collection("auditLog").add({
      action: "follow_up_sent",
      userId: "system",
      targetId: followUpId,
      targetCollection: "followUps",
      timestamp: FieldValue.serverTimestamp(),
      metadata: {
        conversationId,
        platform,
        contactName: contactName || "Unknown",
        messagePreview: customMessage.substring(0, 100),
      },
    });

    console.log(`✅ Follow-up sent to ${contactName} (${platform})`);
  } catch (err) {
    console.error(`❌ Failed to send follow-up ${followUpId}:`, err.message);

    // Mark as failed so owner can review and retry
    await doc.ref.update({
      status: "failed",
      failedAt: FieldValue.serverTimestamp(),
      failureReason: err.message,
    }).catch(() => {}); // Don't throw if this update also fails

    throw err; // Re-throw so Promise.allSettled captures it
  }
}
