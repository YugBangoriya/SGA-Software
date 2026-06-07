/**
 * FollowUpScheduler.jsx
 * Modal for scheduling a follow-up message.
 *
 * Features:
 *   - Date picker (7–15 days from today, or custom date up to 30 days)
 *   - Quick day presets: +7, +10, +14, +15 days
 *   - Language selector (English / Hindi / Gujarati)
 *   - Template picker from saved templates
 *   - Custom message textarea
 *   - Live auto-translate: typing in one language shows translations in the other two
 *   - Preview of what will be sent
 *   - Submit schedules the follow-up in Firestore
 *
 * Fixes applied (from Part 1 bug-fix session):
 *   1. useCallback removed from import — it was imported but never used.
 *   2. const { user: currentUser } = useAuth() — fixed from const { currentUser }
 *      which always returned undefined (useAuth() has no currentUser key).
 *   3. Debounce stale closure fixed — split into two separate useEffects with
 *      clear responsibilities (init once / call on change), eliminating the race
 *      condition where initialisation and invocation shared a single effect.
 */

import { useState, useEffect, useRef } from "react";
import useMessagingStore from "../../store/messagingStore";
import { useAuth } from "../../hooks/useAuth";
import { translateToLanguages, debounce } from "../../lib/translationApi";

const LANG_LABELS = { en: "English", hi: "Hindi", gu: "Gujarati" };
const LANG_FLAGS  = { en: "🇬🇧", hi: "🇮🇳", gu: "🇮🇳" };

// ─── Day preset chip ──────────────────────────────────────────────────────────
function DayChip({ days, selected, onClick }) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const label = date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return (
    <button
      onClick={() => onClick(days)}
      style={{
        padding: "6px 12px",
        borderRadius: 8,
        border: `1.5px solid ${selected ? "#661F1F" : "var(--color-border)"}`,
        background: selected ? "#661F1F12" : "var(--color-bg)",
        color: selected ? "#661F1F" : "var(--color-text)",
        fontSize: 12,
        fontWeight: selected ? 600 : 400,
        cursor: "pointer",
        fontFamily: "'Inter', sans-serif",
        textAlign: "center",
        transition: "all 0.15s",
      }}
    >
      <div style={{ fontWeight: 700 }}>+{days}d</div>
      <div style={{ fontSize: 10, opacity: 0.7 }}>{label}</div>
    </button>
  );
}

// ─── Translation suggestion box ───────────────────────────────────────────────
function TranslationSuggestion({ lang, text, onUse, loading }) {
  if (!text && !loading) return null;

  return (
    <div
      style={{
        padding: "8px 10px",
        background: "var(--color-bg)",
        border: "1px solid var(--color-border)",
        borderRadius: 7,
        marginTop: 6,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--color-text-secondary)",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {LANG_FLAGS[lang]} {LANG_LABELS[lang]} translation
        </span>
        {text && (
          <button
            onClick={() => onUse(lang, text)}
            style={{
              fontSize: 10,
              color: "#661F1F",
              background: "#661F1F12",
              border: "none",
              borderRadius: 5,
              padding: "2px 7px",
              cursor: "pointer",
              fontWeight: 600,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Use this
          </button>
        )}
      </div>
      {loading ? (
        <div
          style={{
            height: 16,
            background: "var(--color-border)",
            borderRadius: 4,
            animation: "pulse 1.4s ease-in-out infinite",
          }}
        />
      ) : (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--color-text)",
            lineHeight: 1.5,
            fontFamily: "'Inter', sans-serif",
            direction: lang === "hi" || lang === "gu" ? "ltr" : undefined,
          }}
        >
          {text}
        </p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FollowUpScheduler() {
  // FIX #2: useAuth() returns { user, uid, displayName, role, ... } — it has no
  // `currentUser` key. Destructuring `currentUser` previously always gave undefined,
  // meaning scheduleFollowUp({ ..., currentUser: undefined }) silently stored no
  // creator on scheduled follow-ups. Fixed to `user: currentUser` so the actual
  // Firebase User object is passed for the audit trail.
  const { user: currentUser } = useAuth();

  const {
    setShowFollowUpModal,
    scheduleFollowUp,
    followUpTemplates,
    getActiveConversation,
    setShowFirstReplyFollowUpPrompt,
  } = useMessagingStore();

  const conversation = getActiveConversation();

  // ── Form state ──────────────────────────────────────────────────────────────
  const [selectedDays, setSelectedDays]           = useState(7);
  const [customDate, setCustomDate]               = useState("");
  const [language, setLanguage]                   = useState("en");
  const [message, setMessage]                     = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [saving, setSaving]                       = useState(false);
  const [error, setError]                         = useState("");

  // ── Translation state ───────────────────────────────────────────────────────
  const [translations, setTranslations] = useState({ en: "", hi: "", gu: "" });
  const [translating, setTranslating]   = useState(false);

  // ── Debounced translate ref ─────────────────────────────────────────────────
  // FIX #3: Stale closure eliminated by splitting into two effects.
  //
  // OLD pattern (bug): initialisation and invocation were mixed in a single
  // effect with a `!debouncedTranslateRef.current` guard. On re-renders, the
  // guard prevented re-initialisation but the ref's closure could be stale if
  // `sourceLang` changed rapidly. Also prevented cleanup on unmount.
  //
  // NEW pattern (two effects):
  //   Effect 1 (deps: []):         Create the debounced fn once at mount.
  //                                Cancel on unmount — no setState on unmounted component.
  //   Effect 2 (deps: [message, language]): Call the stable ref whenever input changes.
  //
  // `sourceLang` is a PARAMETER (not captured in closure), so it always reflects
  // the current value at call time. `setTranslations` / `setTranslating` are stable
  // React state setters — zero stale closure risk.
  // ─────────────────────────────────────────────────────────────────────────────
  const debouncedTranslateRef = useRef(null);

  // Effect 1: Create the debounced function exactly once at component mount.
  useEffect(() => {
    debouncedTranslateRef.current = debounce(async (text, sourceLang) => {
      if (!text.trim()) {
        setTranslations({ en: "", hi: "", gu: "" });
        return;
      }
      setTranslating(true);
      try {
        const targets = ["en", "hi", "gu"].filter((l) => l !== sourceLang);
        const result  = await translateToLanguages(text, targets);
        setTranslations({ ...result, [sourceLang]: text });
      } catch {
        // Translation is a non-critical, API-pending feature — fail silently.
        // The user can still send a message without auto-translation.
      } finally {
        setTranslating(false);
      }
    }, 900);

    // Cancel any pending debounce call when component unmounts
    return () => debouncedTranslateRef.current?.cancel?.();
  }, []); // Empty deps: create once, never recreate — sourceLang is a parameter

  // Effect 2: Trigger translation whenever message or language changes.
  useEffect(() => {
    if (debouncedTranslateRef.current) {
      debouncedTranslateRef.current(message, language);
    }
  }, [message, language]);

  // Compute scheduled date from selectedDays or customDate
  const getScheduledDate = () => {
    if (customDate) return new Date(customDate);
    const d = new Date();
    d.setDate(d.getDate() + selectedDays);
    d.setHours(9, 0, 0, 0); // 9 AM IST
    return d;
  };

  // ── Template selection ──────────────────────────────────────────────────────
  const handleTemplateSelect = (templateId) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const tpl = followUpTemplates.find((t) => t.id === templateId);
    if (!tpl) return;
    const langKey = `message${language.charAt(0).toUpperCase() + language.slice(1)}`;
    const text = tpl[langKey] || tpl.messageEn || "";
    setMessage(text);
  };

  const handleUseTranslation = (lang, text) => {
    setLanguage(lang);
    setMessage(text);
  };

  // ── Minimum / maximum date constraints ─────────────────────────────────────
  const minDateStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  })();

  const maxDateStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  })();

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!message.trim()) {
      setError("Please enter a follow-up message.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const scheduledDate = getScheduledDate();
      const { Timestamp } = await import("firebase/firestore");
      await scheduleFollowUp({
        scheduledDate: Timestamp.fromDate(scheduledDate),
        message:       message.trim(),
        language,
        templateId:    selectedTemplateId || null,
        currentUser,   // now the actual Firebase User object (was undefined before fix)
      });
      setShowFirstReplyFollowUpPrompt(false);
    } catch (err) {
      console.error("Schedule error:", err);
      setError("Failed to schedule follow-up. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const scheduledDateFormatted = (() => {
    const d = getScheduledDate();
    return d.toLocaleDateString("en-IN", {
      weekday: "short",
      day:     "numeric",
      month:   "long",
      year:    "numeric",
    });
  })();

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setShowFollowUpModal(false)}
        style={{
          position:       "fixed",
          inset:          0,
          background:     "rgba(0,0,0,0.45)",
          zIndex:         200,
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position:        "fixed",
          top:             "50%",
          left:            "50%",
          transform:       "translate(-50%, -50%)",
          width:           "min(560px, 95vw)",
          maxHeight:       "90vh",
          overflowY:       "auto",
          background:      "var(--color-card)",
          borderRadius:    16,
          boxShadow:       "0 20px 60px rgba(0,0,0,0.3)",
          zIndex:          201,
          display:         "flex",
          flexDirection:   "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding:        "18px 20px 14px",
            borderBottom:   "1px solid var(--color-border)",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
            flexShrink:     0,
          }}
        >
          <div>
            <h2
              style={{
                margin:     0,
                fontSize:   17,
                fontWeight: 700,
                color:      "var(--color-text)",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              ⏰ Schedule Follow-Up
            </h2>
            <p
              style={{
                margin:     "3px 0 0",
                fontSize:   12,
                color:      "var(--color-text-secondary)",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              For{" "}
              <strong>{conversation?.contactName || "this contact"}</strong> via{" "}
              {conversation?.platform || "WhatsApp"}
            </p>
          </div>
          <button
            onClick={() => setShowFollowUpModal(false)}
            style={{
              background:  "none",
              border:      "none",
              fontSize:    22,
              cursor:      "pointer",
              color:       "var(--color-text-secondary)",
              padding:     4,
              lineHeight:  1,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding:        "18px 20px",
            display:        "flex",
            flexDirection:  "column",
            gap:            18,
          }}
        >
          {/* ── Date selection ──────────────────────────────────────────────── */}
          <div>
            <label
              style={{
                fontSize:    12,
                fontWeight:  600,
                color:       "var(--color-text)",
                fontFamily:  "'Inter', sans-serif",
                display:     "block",
                marginBottom: 8,
              }}
            >
              Send date
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[7, 10, 14, 15].map((d) => (
                <DayChip
                  key={d}
                  days={d}
                  selected={!customDate && selectedDays === d}
                  onClick={(days) => {
                    setSelectedDays(days);
                    setCustomDate("");
                  }}
                />
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    fontSize:   12,
                    color:      "var(--color-text-secondary)",
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  Custom:
                </span>
                <input
                  type="date"
                  min={minDateStr}
                  max={maxDateStr}
                  value={customDate}
                  onChange={(e) => {
                    setCustomDate(e.target.value);
                    setSelectedDays(0);
                  }}
                  style={{
                    padding:    "6px 10px",
                    borderRadius: 8,
                    border:     `1.5px solid ${customDate ? "#661F1F" : "var(--color-border)"}`,
                    background: "var(--color-bg)",
                    color:      "var(--color-text)",
                    fontSize:   12,
                    fontFamily: "'Inter', sans-serif",
                    outline:    "none",
                  }}
                />
              </div>
            </div>
            <div
              style={{
                marginTop:  6,
                fontSize:   12,
                color:      "#661F1F",
                fontWeight: 500,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              📅 Will send on: {scheduledDateFormatted} at 9:00 AM
            </div>
          </div>

          {/* ── Template picker ─────────────────────────────────────────────── */}
          {followUpTemplates.length > 0 && (
            <div>
              <label
                style={{
                  fontSize:    12,
                  fontWeight:  600,
                  color:       "var(--color-text)",
                  fontFamily:  "'Inter', sans-serif",
                  display:     "block",
                  marginBottom: 6,
                }}
              >
                Use a template (optional)
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                style={{
                  width:       "100%",
                  padding:     "9px 12px",
                  borderRadius: 8,
                  border:      "1.5px solid var(--color-border)",
                  background:  "var(--color-bg)",
                  color:       "var(--color-text)",
                  fontSize:    13,
                  fontFamily:  "'Inter', sans-serif",
                  outline:     "none",
                }}
              >
                <option value="">— Select a template —</option>
                {followUpTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ── Language selector ────────────────────────────────────────────── */}
          <div>
            <label
              style={{
                fontSize:    12,
                fontWeight:  600,
                color:       "var(--color-text)",
                fontFamily:  "'Inter', sans-serif",
                display:     "block",
                marginBottom: 6,
              }}
            >
              Message language
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {["en", "hi", "gu"].map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  style={{
                    flex:       1,
                    padding:    "8px 4px",
                    borderRadius: 8,
                    border:     `1.5px solid ${language === lang ? "#661F1F" : "var(--color-border)"}`,
                    background: language === lang ? "#661F1F12" : "var(--color-bg)",
                    color:      language === lang ? "#661F1F" : "var(--color-text)",
                    fontSize:   12,
                    fontWeight: language === lang ? 700 : 400,
                    cursor:     "pointer",
                    fontFamily: "'Inter', sans-serif",
                    transition: "all 0.15s",
                  }}
                >
                  {LANG_FLAGS[lang]} {LANG_LABELS[lang]}
                </button>
              ))}
            </div>
          </div>

          {/* ── Message input ────────────────────────────────────────────────── */}
          <div>
            <label
              style={{
                fontSize:    12,
                fontWeight:  600,
                color:       "var(--color-text)",
                fontFamily:  "'Inter', sans-serif",
                display:     "block",
                marginBottom: 6,
              }}
            >
              Message in {LANG_LABELS[language]} *
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder={
                language === "en"
                  ? "Hi {{customer_name}}, just following up on your CNG kit enquiry..."
                  : language === "hi"
                  ? "नमस्ते, आपकी CNG किट के बारे में जानकारी के लिए..."
                  : "નમસ્તે, તમારી CNG કિટ વિશે..."
              }
              style={{
                width:       "100%",
                padding:     "10px 12px",
                borderRadius: 8,
                border:      "1.5px solid var(--color-border)",
                background:  "var(--color-bg)",
                color:       "var(--color-text)",
                fontSize:    13,
                lineHeight:  1.6,
                resize:      "vertical",
                outline:     "none",
                fontFamily:  "'Inter', sans-serif",
                boxSizing:   "border-box",
                transition:  "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
              onBlur={(e)  => (e.target.style.borderColor = "var(--color-border)")}
            />
            <div
              style={{
                marginTop:  4,
                fontSize:   11,
                color:      "var(--color-text-secondary)",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Tip: As you type, translations will appear below — tap "Use this" to switch
            </div>
          </div>

          {/* ── Translation suggestions ──────────────────────────────────────── */}
          <div>
            <div
              style={{
                fontSize:    12,
                fontWeight:  600,
                color:       "var(--color-text-secondary)",
                fontFamily:  "'Inter', sans-serif",
                marginBottom: 4,
              }}
            >
              🌐 Auto-translation suggestions
            </div>
            {["en", "hi", "gu"]
              .filter((l) => l !== language)
              .map((lang) => (
                <TranslationSuggestion
                  key={lang}
                  lang={lang}
                  text={translations[lang]}
                  loading={translating}
                  onUse={handleUseTranslation}
                />
              ))}
          </div>

          {/* ── Error ────────────────────────────────────────────────────────── */}
          {error && (
            <div
              style={{
                padding:     "8px 12px",
                background:  "#FFEBEE",
                border:      "1px solid #FFAAAA",
                borderRadius: 8,
                fontSize:    13,
                color:       "#CC0000",
                fontFamily:  "'Inter', sans-serif",
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding:        "14px 20px",
            borderTop:      "1px solid var(--color-border)",
            display:        "flex",
            gap:            10,
            justifyContent: "flex-end",
            flexShrink:     0,
          }}
        >
          <button
            onClick={() => setShowFollowUpModal(false)}
            style={{
              padding:     "10px 18px",
              borderRadius: 8,
              background:  "none",
              color:       "var(--color-text)",
              border:      "1.5px solid var(--color-border)",
              fontSize:    13,
              fontWeight:  500,
              cursor:      "pointer",
              fontFamily:  "'Inter', sans-serif",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !message.trim()}
            style={{
              padding:     "10px 20px",
              borderRadius: 8,
              background:  message.trim() ? "#661F1F" : "var(--color-border)",
              color:       message.trim() ? "#fff" : "var(--color-text-secondary)",
              border:      "none",
              fontSize:    13,
              fontWeight:  600,
              cursor:      message.trim() ? "pointer" : "not-allowed",
              fontFamily:  "'Inter', sans-serif",
              transition:  "all 0.15s",
            }}
          >
            {saving ? "Scheduling..." : `Schedule for ${scheduledDateFormatted}`}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </>
  );
}