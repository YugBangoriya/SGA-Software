/**
 * whatsappService.js
 * Sends WhatsApp Business API template messages via Meta Cloud API (v18).
 *
 * Environment variables required (set via Firebase Secret Manager or .env):
 *   WHATSAPP_TOKEN            — Permanent access token from Meta App Dashboard
 *   WHATSAPP_PHONE_NUMBER_ID  — Phone Number ID from WhatsApp Business Manager
 *   SHOP_PHONE_NUMBER         — Shop's contact phone (shown in 'final' template)
 *
 * Set with:
 *   firebase functions:secrets:set WHATSAPP_TOKEN
 *   firebase functions:secrets:set WHATSAPP_PHONE_NUMBER_ID
 *   firebase functions:secrets:set SHOP_PHONE_NUMBER
 *
 * Then reference in onSchedule options:
 *   secrets: ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'SHOP_PHONE_NUMBER']
 */

'use strict';

const axios = require('axios');
const { getWhatsAppTemplateName, addMonths, toYMD } = require('./reminderUtils');

// ── Config ────────────────────────────────────────────────────────────────────

const WA_API_VERSION = 'v18.0';

function getApiUrl() {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneId) throw new Error('WHATSAPP_PHONE_NUMBER_ID env var not set');
  return `https://graph.facebook.com/${WA_API_VERSION}/${phoneId}/messages`;
}

function getToken() {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) throw new Error('WHATSAPP_TOKEN env var not set');
  return token;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalize an Indian phone number to E.164 format with country code 91.
 * Handles formats: 9876543210, 09876543210, +919876543210
 */
function normalizeIndianPhone(rawPhone) {
  let phone = String(rawPhone || '').replace(/\D/g, '');
  if (phone.startsWith('0')) phone = phone.slice(1);       // strip leading 0
  if (phone.length === 10) phone = `91${phone}`;           // add country code
  if (phone.startsWith('91') && phone.length === 12) return phone;
  return null; // invalid
}

/**
 * Format a YYYY-MM-DD date string for display in WhatsApp messages.
 * e.g. "2025-09-15" → "15 Sep 2025"
 */
function fmtDateForWA(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  });
}

/**
 * Build the template body parameter array for each reminder type.
 * Each parameter must match the {{N}} placeholders in the approved template.
 */
function buildBodyParams(reminderType, customer, dueDate) {
  const param = (text) => ({ type: 'text', text: String(text || '') });

  const name    = customer.name || 'Customer';
  const model   = [customer.vehicleCompany, customer.vehicleModel]
    .filter(Boolean).join(' ') || 'your vehicle';
  const regNo   = customer.vehicleNo || 'N/A';
  const dueFmt  = fmtDateForWA(dueDate);
  const shopPh  = process.env.SHOP_PHONE_NUMBER || 'our shop';

  // Templates [1-3]: {{1}}=name {{2}}=model {{3}}=reg {{4}}=due_date
  if (['warning_3m', 'warning_2m', 'warning_1m'].includes(reminderType)) {
    return [param(name), param(model), param(regNo), param(dueFmt)];
  }

  // Template [4] — final: {{4}}=shop phone
  if (reminderType === 'final') {
    return [param(name), param(model), param(regNo), param(shopPh)];
  }

  // Template [5] — overdue: {{4}}=overdue duration string
  if (reminderType.startsWith('overdue_')) {
    const n   = reminderType.split('_')[1];
    const dur = `${n} month${n === '1' ? '' : 's'}`;
    return [param(name), param(model), param(regNo), param(dur)];
  }

  // Fallback
  return [param(name), param(model), param(regNo), param(dueFmt)];
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Send a WhatsApp template reminder message to a customer.
 *
 * @param {Object} customer       Customer Firestore document data (with .id)
 * @param {string} reminderType   e.g. 'warning_3m', 'final', 'overdue_2'
 * @param {string} dueDate        The actual 3-year deadline date (YYYY-MM-DD)
 *                                Shown in message body as the expiry date.
 * @returns {Promise<{ success: boolean, messageId: string|null, error: string|null }>}
 */
async function sendReminderWhatsApp(customer, reminderType, dueDate) {
  // Use altPhone as fallback if primary phone fails
  const phone = normalizeIndianPhone(customer.phone)
             || normalizeIndianPhone(customer.altPhone);

  if (!phone) {
    return {
      success:   false,
      messageId: null,
      error:     `Invalid or missing phone number: "${customer.phone}"`,
    };
  }

  const templateName = getWhatsAppTemplateName(reminderType);
  const bodyParams   = buildBodyParams(reminderType, customer, dueDate);

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type:    'individual',
    to:                phone,
    type:              'template',
    template: {
      name:     templateName,
      language: { code: 'en' },
      components: [
        {
          type:       'body',
          parameters: bodyParams,
        },
      ],
    },
  };

  try {
    const response = await axios.post(getApiUrl(), payload, {
      headers: {
        Authorization:  `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000, // 15s timeout
    });

    const messageId = response.data?.messages?.[0]?.id || null;
    console.log(
      `[WhatsApp] ✓ Sent "${templateName}" to ${phone} (customer: ${customer.id}) — msgId: ${messageId}`
    );
    return { success: true, messageId, error: null };

  } catch (err) {
    const errData  = err.response?.data?.error;
    const errMsg   = errData
      ? `[${errData.code}] ${errData.message}`
      : err.message;

    console.error(
      `[WhatsApp] ✗ Failed to send "${templateName}" to ${phone} (customer: ${customer.id}): ${errMsg}`
    );
    return { success: false, messageId: null, error: errMsg };
  }
}

module.exports = { sendReminderWhatsApp, normalizeIndianPhone };
