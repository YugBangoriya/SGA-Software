/**
 * TemplateManager.jsx
 * Full-page interface for managing follow-up message templates.
 * Templates are saved in 3 languages: English, Hindi, Gujarati.
 * Includes live auto-translate for filling in the other two languages.
 *
 * Route: /messaging/templates
 * Access: Owner + SuperAdmin only
 *
 * Can also be rendered in modal mode (embedded in FollowUpScheduler).
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import useMessagingStore from "../../store/messagingStore";
import { useAuth } from "../../hooks/useAuth";
import { translateToAllLanguages, debounce } from "../../lib/translationApi";

const LANG_CONFIG = [
  { key: "messageEn", lang: "en", label: "English", flag: "🇬🇧", placeholder: "Hi {{customer_name}}, following up on your CNG kit enquiry..." },
  { key: "messageHi", lang: "hi", label: "Hindi", flag: "🇮🇳", placeholder: "नमस्ते {{customer_name}}, आपकी CNG किट की जांच के बारे में..." },
  { key: "messageGu", lang: "gu", label: "Gujarati", flag: "🇮🇳", placeholder: "નમસ્તે {{customer_name}}, આપની CNG કિટ વિશેની..." },
];

// ─── Template form (for create / edit) ───────────────────────────────────────
function TemplateForm({ initial, onSave, onCancel, saving }) {
  const [name, setName] = useState(initial?.name || "");
  const [messages, setMessages] = useState({
    messageEn: initial?.messageEn || "",
    messageHi: initial?.messageHi || "",
    messageGu: initial?.messageGu || "",
  });
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState("");
  const debouncedTranslateRef = useRef(null);
  const [lastEditedLang, setLastEditedLang] = useState("en");

  // Auto-translate when any language field changes
  const handleMessageChange = (key, value) => {
    setMessages((prev) => ({ ...prev, [key]: value }));

    const langMap = { messageEn: "en", messageHi: "hi", messageGu: "gu" };
    const sourceLang = langMap[key];
    setLastEditedLang(sourceLang);

    if (!debouncedTranslateRef.current) {
      debouncedTranslateRef.current = debounce(async (text, srcLang) => {
        if (!text.trim()) return;
        setTranslating(true);
        try {
          const all = await translateToAllLanguages(text, srcLang);
          // Only fill empty fields — don't overwrite what the owner already typed
          setMessages((prev) => ({
            messageEn: prev.messageEn || all.en || "",
            messageHi: prev.messageHi || all.hi || "",
            messageGu: prev.messageGu || all.gu || "",
          }));
        } catch {
          // Non-critical
        } finally {
          setTranslating(false);
        }
      }, 1200);
    }
    debouncedTranslateRef.current(value, sourceLang);
  };

  const handleFillTranslation = async () => {
    const srcKey = `message${lastEditedLang.charAt(0).toUpperCase() + lastEditedLang.slice(1)}`;
    const sourceText = messages[srcKey];
    if (!sourceText.trim()) return;

    setTranslating(true);
    try {
      const all = await translateToAllLanguages(sourceText, lastEditedLang);
      setMessages({
        messageEn: all.en || "",
        messageHi: all.hi || "",
        messageGu: all.gu || "",
      });
    } catch {
      // Non-critical
    } finally {
      setTranslating(false);
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setError("Template name is required.");
      return;
    }
    if (!messages.messageEn.trim()) {
      setError("English message is required.");
      return;
    }
    setError("");
    onSave({ name: name.trim(), ...messages });
  };

  return (
    <div
      style={{
        background: "var(--color-card)",
        border: "1.5px solid var(--color-border)",
        borderRadius: 12,
        padding: "20px",
        marginBottom: 16,
      }}
    >
      <h3
        style={{
          margin: "0 0 16px",
          fontSize: 15,
          fontWeight: 700,
          color: "var(--color-text)",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {initial ? "Edit Template" : "New Template"}
      </h3>

      {/* Template name */}
      <div style={{ marginBottom: 14 }}>
        <label
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--color-text)",
            display: "block",
            marginBottom: 5,
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Template Name *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Post-Enquiry Follow-up"
          style={{
            width: "100%",
            padding: "9px 12px",
            borderRadius: 8,
            border: "1.5px solid var(--color-border)",
            background: "var(--color-bg)",
            color: "var(--color-text)",
            fontSize: 13,
            fontFamily: "'Inter', sans-serif",
            outline: "none",
            boxSizing: "border-box",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
          onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
        />
      </div>

      {/* Auto-fill button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--color-text)",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Messages (in 3 languages)
        </span>
        <button
          onClick={handleFillTranslation}
          disabled={translating}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "5px 12px",
            borderRadius: 7,
            background: "#661F1F12",
            color: "#661F1F",
            border: "1.5px solid #661F1F33",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {translating ? "Translating..." : "🌐 Auto-fill all languages"}
        </button>
      </div>

      {/* Language fields */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {LANG_CONFIG.map(({ key, lang, label, flag, placeholder }) => (
          <div key={key}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: lang === "en" ? "#661F1F" : "var(--color-text-secondary)",
                display: "flex",
                alignItems: "center",
                gap: 5,
                marginBottom: 5,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {flag} {label}{lang === "en" && " *"}
            </label>
            <textarea
              value={messages[key]}
              onChange={(e) => handleMessageChange(key, e.target.value)}
              placeholder={placeholder}
              rows={3}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: 8,
                border: `1.5px solid ${messages[key] ? "var(--color-border)" : "var(--color-border)"}`,
                background: "var(--color-bg)",
                color: "var(--color-text)",
                fontSize: 13,
                lineHeight: 1.6,
                resize: "vertical",
                outline: "none",
                fontFamily: "'Inter', sans-serif",
                boxSizing: "border-box",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
            />
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 10,
          padding: "8px 12px",
          background: "var(--color-bg)",
          borderRadius: 7,
          fontSize: 11,
          color: "var(--color-text-secondary)",
          fontFamily: "'Inter', sans-serif",
          border: "1px solid var(--color-border)",
        }}
      >
        💡 Use <code style={{ background: "var(--color-border)", padding: "1px 4px", borderRadius: 3 }}>{"{{customer_name}}"}</code> as a placeholder — it will be replaced with the contact's name when sent.
      </div>

      {error && (
        <div
          style={{
            marginTop: 10,
            padding: "8px 12px",
            background: "#FFEBEE",
            border: "1px solid #FFAAAA",
            borderRadius: 7,
            fontSize: 13,
            color: "#CC0000",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
        <button
          onClick={onCancel}
          style={{
            padding: "9px 16px",
            borderRadius: 8,
            background: "none",
            color: "var(--color-text)",
            border: "1.5px solid var(--color-border)",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          style={{
            padding: "9px 18px",
            borderRadius: 8,
            background: "#661F1F",
            color: "#fff",
            border: "none",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'Inter', sans-serif",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving..." : initial ? "Update Template" : "Save Template"}
        </button>
      </div>
    </div>
  );
}

// ─── Template card (list view) ────────────────────────────────────────────────
function TemplateCard({ template, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      style={{
        background: "var(--color-card)",
        border: "1.5px solid var(--color-border)",
        borderRadius: 12,
        padding: "16px",
        marginBottom: 12,
        transition: "box-shadow 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.08)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <h4
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 700,
            color: "var(--color-text)",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {template.name}
        </h4>
        <div style={{ display: "flex", gap: 7 }}>
          <button
            onClick={() => onEdit(template)}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              background: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            ✏️ Edit
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              background: "#FFEBEE",
              border: "1px solid #FFAAAA",
              color: "#CC0000",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            🗑️ Delete
          </button>
        </div>
      </div>

      {/* Language previews */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {LANG_CONFIG.filter((lc) => template[lc.key]).map(({ key, label, flag }) => (
          <div key={key}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--color-text-secondary)",
                fontFamily: "'Inter', sans-serif",
                marginBottom: 2,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {flag} {label}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--color-text)",
                lineHeight: 1.5,
                fontFamily: "'Inter', sans-serif",
                background: "var(--color-bg)",
                padding: "7px 10px",
                borderRadius: 7,
                border: "1px solid var(--color-border)",
              }}
            >
              {template[key]}
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            background: "#FFEBEE",
            border: "1px solid #FFAAAA",
            borderRadius: 8,
            fontSize: 13,
            color: "#CC0000",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Delete template "{template.name}"? This cannot be undone.
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              onClick={() => {
                onDelete(template.id);
                setConfirmDelete(false);
              }}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                background: "#CC0000",
                color: "#fff",
                border: "none",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{
                padding: "5px 10px",
                borderRadius: 6,
                background: "none",
                color: "#CC0000",
                border: "1px solid #CC0000",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TemplateManager() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const {
    followUpTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  } = useMessagingStore();

  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleCreate = async (data) => {
    setSaving(true);
    try {
      await createTemplate({ ...data, currentUserUid: currentUser.uid });
      setShowForm(false);
    } catch (err) {
      console.error("Failed to create template:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (data) => {
    setSaving(true);
    try {
      await updateTemplate(editingTemplate.id, data);
      setEditingTemplate(null);
    } catch (err) {
      console.error("Failed to update template:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (templateId) => {
    try {
      await deleteTemplate(templateId);
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
  };

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh", paddingBottom: 40 }}>
      {/* Page header */}
      <div
        style={{
          background: "var(--color-card)",
          borderBottom: "1px solid var(--color-border)",
          padding: "20px 24px 16px",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => navigate("/messaging")}
              style={{
                background: "none",
                border: "none",
                color: "#661F1F",
                fontSize: 20,
                cursor: "pointer",
                padding: "2px 6px",
              }}
            >
              ←
            </button>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 700,
                  color: "var(--color-text)",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Follow-Up Templates
              </h1>
              <p
                style={{
                  margin: "3px 0 0",
                  fontSize: 13,
                  color: "var(--color-text-secondary)",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {followUpTemplates.length} template{followUpTemplates.length !== 1 ? "s" : ""} — available in English, Hindi & Gujarati
              </p>
            </div>
          </div>

          {!showForm && !editingTemplate && (
            <button
              onClick={() => setShowForm(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 18px",
                borderRadius: 9,
                background: "#661F1F",
                color: "#fff",
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              + New Template
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 24px 0" }}>
        {/* Create form */}
        {showForm && (
          <TemplateForm
            onSave={handleCreate}
            onCancel={() => setShowForm(false)}
            saving={saving}
          />
        )}

        {/* Edit form */}
        {editingTemplate && (
          <TemplateForm
            initial={editingTemplate}
            onSave={handleUpdate}
            onCancel={() => setEditingTemplate(null)}
            saving={saving}
          />
        )}

        {/* Template list */}
        {!showForm && !editingTemplate && (
          <>
            {followUpTemplates.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "64px 24px",
                  color: "var(--color-text-secondary)",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.5 }}>📋</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text)", marginBottom: 8 }}>
                  No templates yet
                </div>
                <div style={{ fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
                  Create follow-up message templates in English, Hindi, and Gujarati.
                  <br />
                  Templates can be reused across multiple conversations.
                </div>
                <button
                  onClick={() => setShowForm(true)}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 9,
                    background: "#661F1F",
                    color: "#fff",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  + Create First Template
                </button>
              </div>
            ) : (
              followUpTemplates.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onEdit={setEditingTemplate}
                  onDelete={handleDelete}
                />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
