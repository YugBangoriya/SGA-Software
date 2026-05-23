// ============================================================
// functions/src/whatsappInvoice.js
// Cloud Function: sendInvoiceWhatsApp (callable)
// Phase 4 — Shree Ganesh Automobile
// ============================================================
// HOW IT WORKS:
// 1. Client calls this function with { invoiceId, phone }
// 2. Function loads invoice + settings from Firestore
// 3. Generates the PDF as a Buffer using @react-pdf/renderer
//    (server-side PDF generation in Node.js)
// 4. Uploads the PDF to Firebase Storage as a temporary file
// 5. Gets a time-limited public download URL
// 6. Sends the PDF document via WhatsApp Cloud API
//    using the document message type
// 7. Logs the result in audit log
// 8. Cleans up the temporary Storage file after 1 hour
// ============================================================

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { defineSecret } = require("firebase-functions/params");
const axios = require("axios");
const path = require("path");

const db = getFirestore();
const storage = getStorage();

// ── Environment secrets (set via: firebase functions:secrets:set) ──
// firebase functions:secrets:set WHATSAPP_ACCESS_TOKEN
// firebase functions:secrets:set WHATSAPP_PHONE_NUMBER_ID
const WHATSAPP_ACCESS_TOKEN = defineSecret("WHATSAPP_ACCESS_TOKEN");
const WHATSAPP_PHONE_NUMBER_ID = defineSecret("WHATSAPP_PHONE_NUMBER_ID");

// ── WhatsApp API base URL ──────────────────────────────────
const WA_API_VERSION = "v18.0";
const waUrl = (phoneNumberId) =>
  `https://graph.facebook.com/${WA_API_VERSION}/${phoneNumberId}/messages`;

// ── Format phone for WA API (remove spaces, ensure country code) ──
function formatPhone(phone) {
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");
  // Add India country code if not present
  if (cleaned.startsWith("0")) cleaned = "91" + cleaned.slice(1);
  if (!cleaned.startsWith("91") && cleaned.length === 10) {
    cleaned = "91" + cleaned;
  }
  return cleaned;
}

// ── Upload PDF buffer to Firebase Storage (temp) ──────────
async function uploadPDFToStorage(buffer, invoiceNo) {
  const bucket = storage.bucket();
  const fileName = `temp-invoices/${invoiceNo}-${Date.now()}.pdf`;
  const file = bucket.file(fileName);

  await file.save(buffer, {
    metadata: {
      contentType: "application/pdf",
      cacheControl: "no-cache",
    },
  });

  // Get signed URL valid for 1 hour
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 60 * 60 * 1000, // 1 hour
  });

  return { url, fileName };
}

// ── Upload PDF to WhatsApp Media endpoint, get media ID ───
async function uploadToWhatsAppMedia(buffer, invoiceNo, accessToken, phoneNumberId) {
  const FormData = require("form-data");
  const form = new FormData();
  form.append("file", buffer, {
    filename: `${invoiceNo}.pdf`,
    contentType: "application/pdf",
  });
  form.append("type", "application/pdf");
  form.append("messaging_product", "whatsapp");

  const response = await axios.post(
    `https://graph.facebook.com/${WA_API_VERSION}/${phoneNumberId}/media`,
    form,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...form.getHeaders(),
      },
    }
  );

  return response.data.id; // Media ID
}

// ── Send WhatsApp document message ────────────────────────
async function sendWhatsAppDocument(phone, mediaId, invoiceNo, customerName, accessToken, phoneNumberId) {
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "document",
    document: {
      id: mediaId,
      filename: `Invoice_${invoiceNo}.pdf`,
      caption:
        `Dear ${customerName},\n\nPlease find your invoice ${invoiceNo} attached.\n\nThank you for choosing Shree Ganesh Automobile! 🚗\n\nFor any queries, please contact us.`,
    },
  };

  const response = await axios.post(
    waUrl(phoneNumberId),
    payload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
}

// ── Main callable function ────────────────────────────────
exports.sendInvoiceWhatsApp = onCall(
  {
    region: "asia-south1",
    secrets: [WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID],
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    // ── Auth ─────────────────────────────────────────
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }

    const role = request.auth.token.role;
    if (!["owner", "superadmin"].includes(role)) {
      throw new HttpsError(
        "permission-denied",
        "Only Owner or SuperAdmin can send invoices via WhatsApp."
      );
    }

    const { invoiceId, phone } = request.data;
    if (!invoiceId || !phone) {
      throw new HttpsError(
        "invalid-argument",
        "invoiceId and phone are required."
      );
    }

    // ── Load invoice ──────────────────────────────────
    const invoiceSnap = await db
      .collection("invoices")
      .doc(invoiceId)
      .get();

    if (!invoiceSnap.exists) {
      throw new HttpsError("not-found", "Invoice not found.");
    }

    const invoice = { id: invoiceSnap.id, ...invoiceSnap.data() };

    // ── Load business settings ────────────────────────
    const settingsSnap = await db
      .collection("settings")
      .doc("business")
      .get();

    const businessSettings = settingsSnap.exists ? settingsSnap.data() : {};

    // ── Get WhatsApp credentials ──────────────────────
    const accessToken = WHATSAPP_ACCESS_TOKEN.value();
    const phoneNumberId = WHATSAPP_PHONE_NUMBER_ID.value();

    if (!accessToken || !phoneNumberId) {
      throw new HttpsError(
        "failed-precondition",
        "WhatsApp API credentials not configured. " +
          "Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID secrets."
      );
    }

    const formattedPhone = formatPhone(phone);

    // ── Generate PDF server-side ──────────────────────
    // NOTE: @react-pdf/renderer works in Node.js environments.
    // If you face issues, use the Firebase Storage URL approach
    // (upload from client, then send URL via WA API).
    let pdfBuffer;
    try {
      // Dynamic import — @react-pdf/renderer must be in functions/package.json
      const { renderToBuffer } = await import("@react-pdf/renderer");
      const React = await import("react");
      // The PDF document component must be compiled for Node.js.
      // For Phase 4, we use a simplified server-side PDF approach:
      pdfBuffer = await generateSimplePDF(invoice, businessSettings);
    } catch (pdfErr) {
      console.error("PDF generation error:", pdfErr);
      throw new HttpsError(
        "internal",
        "Failed to generate invoice PDF: " + pdfErr.message
      );
    }

    // ── Upload to WhatsApp Media endpoint ─────────────
    let mediaId;
    let tempFileName;
    try {
      mediaId = await uploadToWhatsAppMedia(
        pdfBuffer,
        invoice.invoiceNo,
        accessToken,
        phoneNumberId
      );
    } catch (uploadErr) {
      console.error("WhatsApp media upload error:", uploadErr);
      // Fallback: upload to Storage and use URL approach
      try {
        const { url, fileName } = await uploadPDFToStorage(
          pdfBuffer,
          invoice.invoiceNo
        );
        tempFileName = fileName;
        // Send as link in text message instead
        await sendWhatsAppTextWithLink(
          formattedPhone,
          invoice,
          url,
          accessToken,
          phoneNumberId
        );

        await logWhatsAppAudit(
          invoiceId,
          invoice,
          formattedPhone,
          request.auth,
          "sent_as_link_fallback"
        );

        // Schedule temp file cleanup (delete after 1 hour)
        setTimeout(async () => {
          try {
            await storage.bucket().file(fileName).delete();
          } catch {}
        }, 60 * 60 * 1000);

        return { success: true, method: "link", invoiceNo: invoice.invoiceNo };
      } catch (fallbackErr) {
        throw new HttpsError(
          "internal",
          "WhatsApp send failed: " + fallbackErr.message
        );
      }
    }

    // ── Send the document message ─────────────────────
    try {
      const waResponse = await sendWhatsAppDocument(
        formattedPhone,
        mediaId,
        invoice.invoiceNo,
        invoice.customerSnapshot?.name || "Customer",
        accessToken,
        phoneNumberId
      );

      await logWhatsAppAudit(
        invoiceId,
        invoice,
        formattedPhone,
        request.auth,
        "sent_as_document"
      );

      return {
        success: true,
        method: "document",
        invoiceNo: invoice.invoiceNo,
        messageId: waResponse?.messages?.[0]?.id,
      };
    } catch (sendErr) {
      console.error("WhatsApp send error:", sendErr?.response?.data || sendErr);
      throw new HttpsError(
        "internal",
        "WhatsApp send failed: " +
          (sendErr?.response?.data?.error?.message || sendErr.message)
      );
    }
  }
);

// ── Simplified server-side PDF generator ──────────────────
// Uses PDFKit (pure Node.js, no React required) as a lightweight
// server-side alternative. Add pdfkit to functions/package.json.
async function generateSimplePDF(invoice, businessSettings) {
  const PDFDocument = require("pdfkit");
  const { Writable } = require("stream");

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks = [];
    const stream = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    });

    doc.pipe(stream);

    const C = {
      primary: "#661F1F",
      text: "#222222",
      muted: "#666666",
      border: "#E8E2DF",
    };

    // ── Header ──────────────────────────────────────
    doc
      .fillColor(C.primary)
      .fontSize(22)
      .font("Helvetica-Bold")
      .text("Shree Ganesh Automobile", 50, 50);

    doc
      .fillColor(C.muted)
      .fontSize(9)
      .font("Helvetica")
      .text("CNG Kit Installation Specialists", 50, 76);

    if (businessSettings.address) {
      doc.text(businessSettings.address, 50, 88);
    }
    if (businessSettings.phone) {
      doc.text(`Ph: ${businessSettings.phone}`, 50, 100);
    }
    if (invoice.gstEnabled && businessSettings.gstNumber) {
      doc.text(`GSTIN: ${businessSettings.gstNumber}`, 50, 112);
    }

    // Invoice title on right
    doc
      .fillColor(C.primary)
      .fontSize(28)
      .font("Helvetica-Bold")
      .text("INVOICE", 350, 50, { align: "right" });

    doc
      .fillColor(C.text)
      .fontSize(11)
      .font("Courier-Bold")
      .text(invoice.invoiceNo || "", 350, 84, { align: "right" });

    const invDate = invoice.invoiceDate
      ? (invoice.invoiceDate.toDate
          ? invoice.invoiceDate.toDate()
          : new Date(invoice.invoiceDate + "T00:00:00")
        ).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      : new Date().toLocaleDateString("en-IN");

    doc
      .fillColor(C.muted)
      .fontSize(9)
      .font("Helvetica")
      .text(`Date: ${invDate}`, 350, 100, { align: "right" });

    // ── Divider ──────────────────────────────────────
    doc
      .moveTo(50, 132)
      .lineTo(545, 132)
      .strokeColor(C.primary)
      .lineWidth(2)
      .stroke();

    let y = 148;

    // ── Customer + Vehicle ───────────────────────────
    doc.fillColor(C.primary).fontSize(9).font("Helvetica-Bold").text("BILL TO", 50, y);
    doc.fillColor(C.primary).fontSize(9).font("Helvetica-Bold").text("VEHICLE", 310, y);
    y += 14;

    const customer = invoice.customerSnapshot || {};
    const vehicle = invoice.vehicleSnapshot || {};

    doc.fillColor(C.text).fontSize(11).font("Helvetica-Bold").text(customer.name || "—", 50, y);
    doc.fontSize(9).font("Helvetica").fillColor(C.muted).text(`Ph: ${customer.phone || "—"}`, 50, y + 14);

    doc.fillColor(C.text).fontSize(11).font("Courier-Bold").text(vehicle.registrationNo || "—", 310, y);
    doc.fontSize(9).font("Helvetica").fillColor(C.muted).text(
      `${vehicle.make || ""} ${vehicle.model || ""} ${vehicle.year ? `(${vehicle.year})` : ""}`.trim(),
      310, y + 14
    );

    y += 44;

    // ── Items table ──────────────────────────────────
    doc.fillColor(C.primary).rect(50, y, 495, 24).fill();
    doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica-Bold");
    doc.text("#", 58, y + 8);
    doc.text("Description", 75, y + 8);
    doc.text("Qty", 370, y + 8, { width: 40, align: "center" });
    doc.text("Unit Price", 418, y + 8, { width: 60, align: "right" });
    doc.text("Total", 490, y + 8, { width: 55, align: "right" });
    y += 24;

    const items = invoice.items || [];
    items.forEach((item, idx) => {
      const rowBg = idx % 2 === 0 ? "#FFFFFF" : "#FAF6F5";
      doc.fillColor(rowBg).rect(50, y, 495, 22).fill();
      doc.fillColor(C.text).fontSize(9).font("Helvetica");
      doc.text(String(idx + 1), 58, y + 7);
      doc.text(item.name || item.itemName || "", 75, y + 7, { width: 280 });
      doc.font("Courier").text(String(item.quantity), 370, y + 7, { width: 40, align: "center" });
      doc.text(`Rs.${parseFloat(item.sellingPrice || 0).toFixed(2)}`, 418, y + 7, { width: 60, align: "right" });
      doc.text(`Rs.${(item.sellingPrice * item.quantity).toFixed(2)}`, 490, y + 7, { width: 55, align: "right" });
      y += 22;
    });

    // Labour row
    const labourCost = parseFloat(invoice.labourCost || 0);
    if (labourCost > 0) {
      doc.fillColor("#FBF8F7").rect(50, y, 495, 22).fill();
      doc.fillColor(C.muted).fontSize(9).font("Helvetica");
      doc.text(String(items.length + 1), 58, y + 7);
      doc.text("Labour / Installation Charges", 75, y + 7);
      doc.font("Courier").text("1", 370, y + 7, { width: 40, align: "center" });
      doc.text(`Rs.${labourCost.toFixed(2)}`, 418, y + 7, { width: 60, align: "right" });
      doc.text(`Rs.${labourCost.toFixed(2)}`, 490, y + 7, { width: 55, align: "right" });
      y += 22;
    }

    // ── Totals ───────────────────────────────────────
    doc.moveTo(50, y).lineTo(545, y).strokeColor(C.primary).lineWidth(1.5).stroke();
    y += 10;

    const totalsX = 390;
    const valX = 490;

    const totalAmount = parseFloat(invoice.totalAmount || 0);
    const amountPaid = parseFloat(invoice.amountPaid || 0);
    const balanceDue = Math.max(0, totalAmount - amountPaid);

    doc.fillColor(C.muted).fontSize(9).font("Helvetica");
    doc.text("Subtotal:", totalsX, y).font("Courier").fillColor(C.text).text(`Rs.${parseFloat(invoice.subtotal || 0).toFixed(2)}`, valX, y, { width: 55, align: "right" });
    y += 14;

    if (invoice.gstEnabled) {
      doc.fillColor(C.muted).font("Helvetica").text("CGST (9%):", totalsX, y);
      doc.font("Courier").fillColor(C.text).text(`Rs.${parseFloat(invoice.cgst || 0).toFixed(2)}`, valX, y, { width: 55, align: "right" });
      y += 14;
      doc.fillColor(C.muted).font("Helvetica").text("SGST (9%):", totalsX, y);
      doc.font("Courier").fillColor(C.text).text(`Rs.${parseFloat(invoice.sgst || 0).toFixed(2)}`, valX, y, { width: 55, align: "right" });
      y += 14;
    }

    doc.moveTo(totalsX, y).lineTo(545, y).strokeColor(C.border).lineWidth(1).stroke();
    y += 6;

    doc.fillColor(C.primary).fontSize(11).font("Helvetica-Bold").text("TOTAL:", totalsX, y);
    doc.font("Courier-Bold").text(`Rs.${totalAmount.toFixed(2)}`, valX, y, { width: 55, align: "right" });
    y += 18;

    doc.fillColor("#1A7A1A").fontSize(9).font("Helvetica").text("Amount Paid:", totalsX, y);
    doc.font("Courier").text(`Rs.${amountPaid.toFixed(2)}`, valX, y, { width: 55, align: "right" });
    y += 14;

    doc.fillColor(balanceDue > 0 ? "#CC0000" : "#1A7A1A").fontSize(10).font("Helvetica-Bold").text("Balance Due:", totalsX, y);
    doc.font("Courier-Bold").text(`Rs.${balanceDue.toFixed(2)}`, valX, y, { width: 55, align: "right" });
    y += 24;

    // ── Payment info ─────────────────────────────────
    doc.fillColor(C.muted).fontSize(9).font("Helvetica");
    doc.text(`Payment Method: ${invoice.paymentMethod || "—"}`, 50, y);
    doc.text(`Status: ${invoice.paymentStatus || "—"}`, 200, y);
    y += 14;
    if (invoice.loanProvider) {
      doc.text(`Provider: ${invoice.loanProvider}`, 50, y);
      y += 14;
    }

    // ── Terms ────────────────────────────────────────
    y += 10;
    doc.moveTo(50, y).lineTo(545, y).strokeColor(C.border).lineWidth(1).stroke();
    y += 10;
    doc.fillColor(C.primary).fontSize(9).font("Helvetica-Bold").text("TERMS & CONDITIONS", 50, y);
    y += 12;
    const terms = businessSettings.termsAndConditions ||
      "1. All goods sold subject to warranty per manufacturer terms.\n" +
      "2. Goods once sold will not be taken back.\n" +
      "3. Payment due within 30 days from invoice date.\n" +
      "4. In case of disputes, jurisdiction shall be Ahmedabad, Gujarat.\n" +
      "5. Thank you for choosing Shree Ganesh Automobile!";
    doc.fillColor(C.muted).fontSize(8).font("Helvetica").text(terms, 50, y, { width: 495 });

    // ── Signature area ───────────────────────────────
    const sigY = doc.page.height - 100;
    doc.moveTo(50, sigY).lineTo(200, sigY).strokeColor(C.border).lineWidth(1).stroke();
    doc.moveTo(345, sigY).lineTo(545, sigY).strokeColor(C.border).lineWidth(1).stroke();
    doc.fillColor(C.muted).fontSize(9).font("Helvetica");
    doc.text("Customer Signature", 50, sigY + 6, { width: 150, align: "center" });
    doc.text("Authorised Signatory", 345, sigY + 6, { width: 200, align: "center" });
    doc.text("Shree Ganesh Automobile", 345, sigY + 18, { width: 200, align: "center" });

    // ── Footer ───────────────────────────────────────
    doc
      .fillColor(C.muted)
      .fontSize(8)
      .text(
        `${invoice.invoiceNo} — Shree Ganesh Automobile — Thank you for your business!`,
        50,
        doc.page.height - 30,
        { align: "center", width: 495 }
      );

    doc.end();

    stream.on("finish", () => {
      resolve(Buffer.concat(chunks));
    });

    stream.on("error", reject);
    doc.on("error", reject);
  });
}

// ── Fallback: send WhatsApp text message with storage link ─
async function sendWhatsAppTextWithLink(phone, invoice, pdfUrl, accessToken, phoneNumberId) {
  const customer = invoice.customerSnapshot || {};
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "text",
    text: {
      preview_url: false,
      body:
        `Dear ${customer.name || "Customer"},\n\n` +
        `Your invoice *${invoice.invoiceNo}* of ₹${parseFloat(invoice.totalAmount || 0).toFixed(2)} is ready.\n\n` +
        `Download PDF: ${pdfUrl}\n\n` +
        `Thank you for choosing *Shree Ganesh Automobile*! 🚗`,
    },
  };

  await axios.post(waUrl(phoneNumberId), payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
}

// ── Audit log helper ──────────────────────────────────────
async function logWhatsAppAudit(invoiceId, invoice, phone, auth, method) {
  await db.collection("auditLog").add({
    action: "invoice_whatsapp_sent",
    targetId: invoiceId,
    targetCollection: "invoices",
    userId: auth.uid,
    userName: auth.token.name || auth.token.email || "Unknown",
    timestamp: FieldValue.serverTimestamp(),
    metadata: {
      invoiceNo: invoice.invoiceNo,
      sentToPhone: phone,
      method,
    },
  });
}
