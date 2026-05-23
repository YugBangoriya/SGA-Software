// functions/src/quotations/sendQuotationWhatsApp.js
// Phase 5 — Quotation Module
// Firebase Cloud Function (v2, callable) that sends a quotation PDF
// to a customer via the WhatsApp Business Cloud API.
// Called from QuotationDetail.jsx via httpsCallable().

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const axios = require("axios");

/**
 * Callable Cloud Function: sendQuotationWhatsApp
 *
 * Expected payload:
 * {
 *   quotationId:     string   — Firestore document ID
 *   pdfUrl:          string   — public Firebase Storage download URL
 *   customerPhone:   string   — 10-digit Indian mobile (without +91)
 *   customerName:    string
 *   quotationNumber: string   — e.g., "QT-2025-001"
 * }
 *
 * Returns: { success: true } | throws HttpsError
 */
exports.sendQuotationWhatsApp = onCall(
  {
    // Only authenticated users can call this
    enforceAppCheck: false,
    region: "asia-south1",
    // Runtime secrets — set via: firebase functions:secrets:set WHATSAPP_TOKEN etc.
    secrets: ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
  },
  async (request) => {
    // ── Auth check ──────────────────────────────────────────────────────────
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { uid } = request.auth;
    const db = getFirestore();

    // ── Role check: only owner or superadmin ─────────────────────────────────
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      throw new HttpsError("permission-denied", "User record not found.");
    }
    const userRole = userSnap.data().role;
    if (userRole !== "owner" && userRole !== "superadmin") {
      throw new HttpsError("permission-denied", "Only Owner or SuperAdmin can send quotations.");
    }

    // ── Validate payload ─────────────────────────────────────────────────────
    const { quotationId, pdfUrl, customerPhone, customerName, quotationNumber } = request.data;

    if (!quotationId || !pdfUrl || !customerPhone || !quotationNumber) {
      throw new HttpsError("invalid-argument", "Missing required fields.");
    }

    // Normalize phone — strip country code if present, ensure 10 digits
    const normalizedPhone = customerPhone.replace(/^\+?91/, "").replace(/\D/g, "");
    if (normalizedPhone.length !== 10) {
      throw new HttpsError("invalid-argument", `Invalid phone number: ${customerPhone}`);
    }
    const waPhone = `91${normalizedPhone}`; // WhatsApp requires full E.164 without '+'

    // ── Get WhatsApp credentials from secrets ────────────────────────────────
    const waToken         = process.env.WHATSAPP_TOKEN;
    const waPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!waToken || !waPhoneNumberId) {
      console.error("WhatsApp credentials not configured in environment secrets.");
      throw new HttpsError("internal", "WhatsApp API credentials are not configured.");
    }

    // ── Build WhatsApp API payload ────────────────────────────────────────────
    // We send a document (PDF) message with a caption.
    // Per Meta Cloud API docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages
    //
    // Note: pdfUrl must be a publicly accessible URL.
    // Firebase Storage download URLs are public if the Storage security rules allow it.

    const waPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: waPhone,
      type: "document",
      document: {
        link: pdfUrl,
        filename: `${quotationNumber}.pdf`,
        caption: buildCaption(customerName, quotationNumber),
      },
    };

    // ── Call Meta Cloud API ───────────────────────────────────────────────────
    let metaResponse;
    try {
      metaResponse = await axios.post(
        `https://graph.facebook.com/v18.0/${waPhoneNumberId}/messages`,
        waPayload,
        {
          headers: {
            Authorization: `Bearer ${waToken}`,
            "Content-Type": "application/json",
          },
          timeout: 15000, // 15 second timeout
        }
      );
    } catch (err) {
      const metaError = err.response?.data?.error;
      console.error("Meta WhatsApp API error:", JSON.stringify(metaError || err.message));

      // Surface useful error messages
      if (metaError?.code === 131047) {
        throw new HttpsError(
          "failed-precondition",
          "Message not sent — customer has not messaged in the last 24 hours. Use an approved template."
        );
      }
      if (metaError?.code === 100) {
        throw new HttpsError("invalid-argument", `Invalid API parameter: ${metaError.message}`);
      }

      throw new HttpsError("internal", `WhatsApp API error: ${metaError?.message || err.message}`);
    }

    console.log(
      `Quotation ${quotationNumber} sent to ${waPhone}. ` +
      `Meta message ID: ${metaResponse.data?.messages?.[0]?.id}`
    );

    // ── Update Firestore ─────────────────────────────────────────────────────
    // This is also done client-side, but we do it here server-side as authoritative source.
    try {
      await db.collection("quotations").doc(quotationId).update({
        status: "sent",
        whatsappSentAt: FieldValue.serverTimestamp(),
        whatsappSentTo: normalizedPhone,
        whatsappMessageId: metaResponse.data?.messages?.[0]?.id || null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Audit log
      await db.collection("auditLog").add({
        action: "quotation_whatsapp_sent",
        userId: uid,
        targetId: quotationId,
        targetCollection: "quotations",
        timestamp: FieldValue.serverTimestamp(),
        metadata: {
          quotationNumber,
          customerPhone: normalizedPhone,
          whatsappMessageId: metaResponse.data?.messages?.[0]?.id || null,
        },
      });
    } catch (firestoreErr) {
      // Don't fail the function if Firestore update fails — WhatsApp was already sent.
      console.error("Firestore update after WhatsApp send failed:", firestoreErr.message);
    }

    return { success: true, messageId: metaResponse.data?.messages?.[0]?.id };
  }
);

// ─── Caption Builder ──────────────────────────────────────────────────────────

function buildCaption(customerName, quotationNumber) {
  return (
    `Hello ${customerName}! 🙏\n\n` +
    `Please find your CNG kit quotation *${quotationNumber}* attached.\n\n` +
    `📋 This quotation includes item-wise pricing, installation charges, and media links for your vehicle model.\n\n` +
    `⚠️ _Prices are subject to change. Please contact us for the latest pricing._\n\n` +
    `For any queries, feel free to reply to this message. Thank you for choosing *Shree Ganesh Automobile*! 🚗`
  );
}
