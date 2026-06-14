// SGA — Last updated: Feature 3 — standardized formatDate() from month:'long' (e.g. "02 April 2026")
// to month:'short' (e.g. "02 Apr 2026") so dates match QuotationList.jsx, QuotationPDF.jsx, and
// the Invoice module across the app.
// the component shows a clear error instead of crashing with "Cannot read properties of undefined".
// No other behaviour or UI has been changed.
//
// src/pages/quotations/QuotationDetail.jsx
// Phase 5 — Quotation Module
// Shows full quotation, generates PDF via @react-pdf/renderer,
// uploads to Storage, and triggers WhatsApp send via Cloud Function.

import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { pdf } from "@react-pdf/renderer";
import {
  ArrowLeft, Download, Send, Loader2, CheckCircle,
  AlertTriangle, ExternalLink, RefreshCcw, Car, User,
  FileText, Calendar, Hash, Phone
} from "lucide-react";
import { QuotationPDFDocument } from "./QuotationPDF";
import {
  fetchQuotationById,
  fetchBusinessSettings,
  uploadQuotationPdf,
  sendQuotationWhatsApp,
  updateQuotationPdfUrl,
} from "../../lib/quotationService";
import { useAuth } from "../../hooks/useAuth";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatINR(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 });
}
function formatDate(ts) {
  if (!ts) return "—";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function formatDateTime(ts) {
  if (!ts) return "—";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    draft: { bg: "#F3E5F5", text: "#6A1B9A", label: "Draft" },
    sent:  { bg: "#E8F5E9", text: "#1A7A1A", label: "Sent via WhatsApp" },
  };
  const c = cfg[status] || cfg.draft;
  return (
    <span className="text-[10px] font-semibold font-sans px-3 py-1 rounded-full"
      style={{ background: c.bg, color: c.text }}>
      {c.label}
    </span>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────
function SectionCard({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8E2DF] overflow-hidden shadow-sm">
      <div className="bg-[#F5F0EE] px-5 py-3 border-b border-[#E8E2DF]">
        <h3 className="text-xs font-bold text-[#661F1F] font-sans uppercase tracking-widest">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-[#F5F0EE] last:border-0">
      <span className="text-xs text-[#888] font-sans w-28 flex-shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm text-[#222] font-semibold flex-1 ${mono ? "font-mono" : "font-sans"}`}>
        {value || "—"}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function QuotationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // FIX: useAuth() returns { user, uid, displayName, role, ... } — it does NOT have a
  // `currentUser` key. Destructuring `currentUser` previously always gave `undefined`,
  // causing `currentUser.uid` to throw a TypeError when the WhatsApp send button was pressed.
  // We now use `uid` directly, which is the string UID (or null when not authenticated).
  const { uid: currentUserUid } = useAuth();

  // Try to use data passed from create form (avoids a Firestore fetch)
  const passedQuotation    = location.state?.quotation    || null;
  const passedBizSettings  = location.state?.bizSettings  || null;
  const isNewlyCreated     = location.state?.newlyCreated || false;

  const [quotation,    setQuotation]    = useState(passedQuotation);
  const [bizSettings,  setBizSettings]  = useState(passedBizSettings);
  const [isLoading,    setIsLoading]    = useState(!passedQuotation);
  const [loadError,    setLoadError]    = useState(null);

  // Action states
  const [isGeneratingPdf,   setIsGeneratingPdf]   = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [pdfBlob,           setPdfBlob]           = useState(null);
  const [localPdfUrl,       setLocalPdfUrl]       = useState(null); // object URL for preview/download
  const [actionSuccess,     setActionSuccess]     = useState(null);
  const [actionError,       setActionError]       = useState(null);
  const [showSuccessBanner, setShowSuccessBanner] = useState(isNewlyCreated);

  // ─── Load data ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!quotation || !bizSettings) {
      (async () => {
        setIsLoading(true);
        try {
          const [q, s] = await Promise.all([
            quotation ? Promise.resolve(quotation) : fetchQuotationById(id),
            bizSettings ? Promise.resolve(bizSettings) : fetchBusinessSettings(),
          ]);
          setQuotation(q);
          setBizSettings(s);
        } catch (e) {
          setLoadError("Failed to load quotation. Please try again.");
        } finally {
          setIsLoading(false);
        }
      })();
    }
  }, [id]);

  // Hide new-creation banner after 5s
  useEffect(() => {
    if (showSuccessBanner) {
      const t = setTimeout(() => setShowSuccessBanner(false), 5000);
      return () => clearTimeout(t);
    }
  }, [showSuccessBanner]);

  // Revoke object URL on unmount
  useEffect(() => {
    return () => { if (localPdfUrl) URL.revokeObjectURL(localPdfUrl); };
  }, [localPdfUrl]);

  // ─── Generate PDF ────────────────────────────────────────────────────────
  const handleGeneratePdf = async () => {
    setIsGeneratingPdf(true);
    setActionError(null);
    try {
      const doc = <QuotationPDFDocument quotation={quotation} businessSettings={bizSettings} />;
      const blob = await pdf(doc).toBlob();
      setPdfBlob(blob);

      // Create a local object URL for download/preview
      if (localPdfUrl) URL.revokeObjectURL(localPdfUrl);
      const objUrl = URL.createObjectURL(blob);
      setLocalPdfUrl(objUrl);

      // Upload to Firebase Storage and persist URL to Firestore (if not already done)
      if (!quotation.pdfUrl) {
        const downloadUrl = await uploadQuotationPdf(blob, quotation.quotationNumber);
        await updateQuotationPdfUrl(quotation.id, downloadUrl);
        setQuotation((prev) => ({ ...prev, pdfUrl: downloadUrl }));
      }

      setActionSuccess("pdf_generated");
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (e) {
      console.error(e);
      setActionError("Failed to generate PDF. Please try again.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // ─── Download PDF ────────────────────────────────────────────────────────
  const handleDownloadPdf = () => {
    if (!localPdfUrl) return;
    const a = document.createElement("a");
    a.href = localPdfUrl;
    a.download = `${quotation.quotationNumber}.pdf`;
    a.click();
  };

  // ─── Send via WhatsApp ───────────────────────────────────────────────────
  const handleSendWhatsApp = async () => {
    // FIX: Guard against expired/missing session before attempting the send.
    // `currentUserUid` is null when the user is not authenticated (e.g. session
    // expired while the page was open). Previously this crashed with TypeError
    // because `currentUser.uid` was called on undefined. Now we show a clear
    // user-facing error instead.
    if (!currentUserUid) {
      setActionError("Your session has expired. Please log in again to send the quotation.");
      return;
    }

    setIsSendingWhatsApp(true);
    setActionError(null);
    try {
      // Generate + upload PDF if not already done
      let pdfUrl = quotation.pdfUrl;
      if (!pdfUrl) {
        const doc = <QuotationPDFDocument quotation={quotation} businessSettings={bizSettings} />;
        const blob = await pdf(doc).toBlob();
        pdfUrl = await uploadQuotationPdf(blob, quotation.quotationNumber);
        await updateQuotationPdfUrl(quotation.id, pdfUrl);
        setQuotation((prev) => ({ ...prev, pdfUrl }));
      }

      await sendQuotationWhatsApp(
        quotation.id,
        pdfUrl,
        quotation.customerPhone,
        quotation.customerName,
        quotation.quotationNumber,
        currentUserUid  // now a string UID, never undefined
      );

      setQuotation((prev) => ({
        ...prev,
        status: "sent",
        whatsappSentAt: new Date(),
        whatsappSentTo: quotation.customerPhone,
      }));
      setActionSuccess("whatsapp_sent");
      setTimeout(() => setActionSuccess(null), 6000);
    } catch (e) {
      console.error(e);
      setActionError(
        e.message?.includes("WhatsApp")
          ? "WhatsApp send failed. Check the API configuration and try again."
          : "Failed to send. Please try again."
      );
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#CDCBC9] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="text-[#661F1F] animate-spin" />
          <p className="text-sm text-[#666] font-sans">Loading quotation…</p>
        </div>
      </div>
    );
  }

  if (loadError || !quotation) {
    return (
      <div className="min-h-screen bg-[#CDCBC9] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-lg border border-[#E8E2DF]">
          <AlertTriangle size={36} className="text-[#CC0000] mx-auto mb-4" />
          <h2 className="text-lg font-bold text-[#222] mb-2">Quotation Not Found</h2>
          <p className="text-sm text-[#888] font-sans mb-6">{loadError || "This quotation could not be loaded."}</p>
          <button onClick={() => navigate("/quotations")}
            className="w-full h-11 rounded-xl bg-[#661F1F] text-white font-semibold font-sans text-sm">
            ← Back to Quotations
          </button>
        </div>
      </div>
    );
  }

  const grandTotal = (quotation.lineItems || []).reduce(
    (sum, item) => sum + (item.total || item.quantity * item.unitPrice || 0), 0
  ) + Number(quotation.labourCost || 0);

  return (
    <div className="min-h-screen bg-[#CDCBC9] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#661F1F] shadow-xl">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate("/quotations")}
            className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white hover:bg-white/25 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[#F0BABA] text-[10px] font-sans tracking-widest uppercase">Quotation</p>
            <h1 className="text-white text-lg font-bold leading-tight font-mono truncate">
              {quotation.quotationNumber}
            </h1>
          </div>
          <StatusBadge status={quotation.status} />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 flex flex-col gap-5">

        {/* ── New creation success banner ── */}
        {showSuccessBanner && (
          <div className="bg-[#E8F5E9] border border-[#B8E0B8] rounded-xl px-4 py-3 flex items-center gap-3">
            <CheckCircle size={18} className="text-[#1A7A1A] flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#1A7A1A] font-sans">Quotation created successfully!</p>
              <p className="text-xs text-[#4A8A4A] font-sans">Generate a PDF and send it to the customer via WhatsApp below.</p>
            </div>
          </div>
        )}

        {/* ── Action success / error banners ── */}
        {actionSuccess === "pdf_generated" && (
          <div className="bg-[#E8F5E9] border border-[#B8E0B8] rounded-xl px-4 py-3 flex items-center gap-3">
            <CheckCircle size={16} className="text-[#1A7A1A] flex-shrink-0" />
            <p className="text-sm text-[#1A7A1A] font-sans font-semibold">
              PDF ready! Click Download to save it.
            </p>
          </div>
        )}
        {actionSuccess === "whatsapp_sent" && (
          <div className="bg-[#E8F5E9] border border-[#B8E0B8] rounded-xl px-4 py-3 flex items-center gap-3">
            <CheckCircle size={16} className="text-[#1A7A1A] flex-shrink-0" />
            <p className="text-sm text-[#1A7A1A] font-sans font-semibold">
              Quotation sent to {quotation.customerPhone} via WhatsApp ✓
            </p>
          </div>
        )}
        {actionError && (
          <div className="bg-[#FFEBEE] border border-[#F0B8B8] rounded-xl px-4 py-3 flex items-center gap-3">
            <AlertTriangle size={16} className="text-[#CC0000] flex-shrink-0" />
            <p className="text-sm text-[#CC0000] font-sans">{actionError}</p>
          </div>
        )}

        {/* ── Action buttons ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Generate / Regenerate PDF */}
          <button
            onClick={handleGeneratePdf}
            disabled={isGeneratingPdf || isSendingWhatsApp}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-[#E8E2DF]
              hover:border-[#8B3A3A] hover:bg-[#FDF6F6] transition-all shadow-sm
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGeneratingPdf
              ? <Loader2 size={20} className="text-[#661F1F] animate-spin" />
              : quotation.pdfUrl
              ? <RefreshCcw size={20} className="text-[#661F1F]" />
              : <FileText size={20} className="text-[#661F1F]" />
            }
            <span className="text-xs font-semibold text-[#333] font-sans text-center leading-tight">
              {isGeneratingPdf ? "Generating…" : quotation.pdfUrl ? "Regenerate PDF" : "Generate PDF"}
            </span>
          </button>

          {/* Download PDF */}
          <button
            onClick={handleDownloadPdf}
            disabled={!localPdfUrl && !quotation.pdfUrl}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-[#E8E2DF]
              hover:border-[#8B3A3A] hover:bg-[#FDF6F6] transition-all shadow-sm
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={20} className="text-[#661F1F]" />
            <span className="text-xs font-semibold text-[#333] font-sans text-center leading-tight">
              Download PDF
            </span>
          </button>

          {/* Open in new tab (if stored URL exists) */}
          {quotation.pdfUrl && (
            <a
              href={quotation.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-[#E8E2DF]
                hover:border-[#8B3A3A] hover:bg-[#FDF6F6] transition-all shadow-sm"
            >
              <ExternalLink size={20} className="text-[#661F1F]" />
              <span className="text-xs font-semibold text-[#333] font-sans text-center leading-tight">
                Open PDF
              </span>
            </a>
          )}
        </div>

        {/* ── WhatsApp Send Button ── */}
        <button
          onClick={handleSendWhatsApp}
          disabled={isSendingWhatsApp || isGeneratingPdf}
          className="w-full h-14 rounded-2xl flex items-center justify-center gap-3
            font-bold font-sans text-base shadow-lg transition-all
            disabled:opacity-60 disabled:cursor-not-allowed
            bg-[#25D366] hover:bg-[#1EBE58] active:bg-[#18A84D] text-white
            shadow-[#25D366]/30"
        >
          {isSendingWhatsApp ? (
            <><Loader2 size={20} className="animate-spin" /> Sending via WhatsApp…</>
          ) : quotation.status === "sent" ? (
            <><RefreshCcw size={20} /> Re-send via WhatsApp</>
          ) : (
            <><Send size={20} /> Send Quotation via WhatsApp</>
          )}
        </button>

        {/* WhatsApp sent info */}
        {quotation.status === "sent" && quotation.whatsappSentAt && (
          <div className="flex items-center gap-2 justify-center">
            <CheckCircle size={13} className="text-[#1A7A1A]" />
            <p className="text-xs text-[#666] font-sans">
              Last sent {formatDateTime(quotation.whatsappSentAt)} to +91 {quotation.whatsappSentTo}
            </p>
          </div>
        )}

        {/* ── Quotation Summary ── */}
        <SectionCard title="Quotation Details">
          <InfoRow label="Quotation No." value={quotation.quotationNumber} mono />
          <InfoRow label="Date"          value={formatDate(quotation.createdAt)} />
          <InfoRow label="Created By"    value={quotation.createdByName} />
          <InfoRow label="Status"        value={quotation.status === "sent" ? "Sent via WhatsApp" : "Draft"} />
        </SectionCard>

        {/* ── Customer ── */}
        <SectionCard title="Customer">
          <InfoRow label="Name"   value={quotation.customerName} />
          <InfoRow label="Phone"  value={`+91 ${quotation.customerPhone}`} mono />
        </SectionCard>

        {/* ── Vehicle ── */}
        <SectionCard title="Vehicle">
          <InfoRow label="Company" value={quotation.vehicleCompany} />
          <InfoRow label="Model"   value={quotation.vehicleModel} />
          {quotation.vehicleYear && <InfoRow label="Year" value={quotation.vehicleYear} />}
          {quotation.isManualVehicle && (
            <div className="mt-3 flex items-start gap-2 bg-[#FFF8E0] border border-[#FFD166] rounded-lg px-3 py-2">
              <AlertTriangle size={12} className="text-[#CC6600] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#7A4400] font-sans">
                Manually entered vehicle — SuperAdmin notified to add to Car Repository
              </p>
            </div>
          )}
        </SectionCard>

        {/* ── Car Media Links ── */}
        {(quotation.carDriveLink || (quotation.carReelLinks || []).length > 0) && (
          <SectionCard title="Car Media Links (included in PDF)">
            <div className="flex flex-col gap-2">
              {quotation.carDriveLink && (
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-[#888] font-sans w-20">Photos</span>
                  <a href={quotation.carDriveLink} target="_blank" rel="noreferrer"
                    className="text-sm text-[#0055CC] font-sans hover:underline flex items-center gap-1 truncate">
                    Google Drive <ExternalLink size={11} />
                  </a>
                </div>
              )}
              {(quotation.carReelLinks || []).map((reel, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[11px] text-[#888] font-sans w-20">Reel {i + 1}</span>
                  <a href={reel} target="_blank" rel="noreferrer"
                    className="text-sm text-[#0055CC] font-sans hover:underline flex items-center gap-1 truncate">
                    Instagram <ExternalLink size={11} />
                  </a>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* ── Line Items ── */}
        <SectionCard title="Items & Pricing">
          <div className="flex flex-col divide-y divide-[#F5F0EE]">
            {(quotation.lineItems || []).map((item, i) => (
              <div key={i} className="py-3 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm text-[#222] font-sans font-semibold">{item.description}</p>
                  <p className="text-xs text-[#888] font-sans mt-0.5">
                    {item.quantity} × {formatINR(item.unitPrice)}
                  </p>
                </div>
                <p className="text-sm font-mono font-bold text-[#333] flex-shrink-0">
                  {formatINR(item.total || item.quantity * item.unitPrice)}
                </p>
              </div>
            ))}

            {Number(quotation.labourCost) > 0 && (
              <div className="py-3 flex items-center justify-between gap-3">
                <p className="text-sm text-[#661F1F] font-semibold font-sans">
                  Labour / Installation Charges
                </p>
                <p className="text-sm font-mono font-bold text-[#661F1F]">
                  {formatINR(quotation.labourCost)}
                </p>
              </div>
            )}
          </div>

          {/* Total */}
          <div className="mt-4 bg-[#661F1F] rounded-xl px-5 py-4 flex items-center justify-between">
            <p className="text-[#F0BABA] text-xs font-sans uppercase tracking-widest font-semibold">
              Total Amount
            </p>
            <p className="text-white text-xl font-mono font-bold">
              {formatINR(grandTotal)}
            </p>
          </div>

          <p className="text-[10px] text-[#AAA] font-sans mt-3 italic text-center">
            Prices are subject to change. Please contact us for the latest pricing.
          </p>
        </SectionCard>

        {/* ── Notes (internal) ── */}
        {quotation.notes && (
          <SectionCard title="Internal Notes">
            <p className="text-sm text-[#444] font-sans leading-relaxed">{quotation.notes}</p>
          </SectionCard>
        )}

      </div>
    </div>
  );
}