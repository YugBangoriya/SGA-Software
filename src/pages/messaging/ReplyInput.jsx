/**
 * ReplyInput.jsx
 * Message composer for the unified inbox.
 *
 * Features:
 *   - Auto-expanding textarea
 *   - Platform indicator (shows which platform the message will be sent on)
 *   - "/" shortcut to trigger Car Repository quick-send
 *   - Send on Enter (Shift+Enter for new line)
 *   - Disabled state when sending
 *   - Follow-up schedule button in toolbar
 */

import { useRef, useEffect, useCallback } from "react";
import useMessagingStore, { PLATFORM_CONFIG } from "../../store/messagingStore";
import { useAuth } from "../../hooks/useAuth";

// ─── Platform indicator pill ──────────────────────────────────────────────────
function PlatformIndicator({ platform }) {
  const cfg = PLATFORM_CONFIG[platform] || {};
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        background: cfg.bgColor || "#F0F0F0",
        border: `1px solid ${cfg.color || "#888"}33`,
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        color: cfg.color || "#666",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <span style={{ fontSize: 12 }}>
        {platform === "whatsapp" ? "💬" : platform === "instagram" ? "📸" : "💙"}
      </span>
      {cfg.shortLabel || platform}
    </div>
  );
}

// ─── Car quick-send popup ─────────────────────────────────────────────────────
// When owner types "/" the CarQuickSend component from Phase 6 is summoned.
// This is a placeholder trigger — the actual CarQuickSend component renders
// as an overlay via the store flag and handles selection + sends via WhatsApp.
function CarCommandHint({ visible, query }) {
  if (!visible) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(100% + 6px)",
        left: 0,
        right: 0,
        background: "var(--color-card)",
        border: "1.5px solid #661F1F30",
        borderRadius: 10,
        padding: "8px 12px",
        fontSize: 12,
        color: "var(--color-text-secondary)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        fontFamily: "'Inter', sans-serif",
        zIndex: 10,
      }}
    >
      <span style={{ color: "#661F1F", fontWeight: 600 }}>Car Quick-Send</span>
      {" — "}type a car name to search
      {query && (
        <span style={{ fontStyle: "italic", marginLeft: 4 }}>
          "{query}"
        </span>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ReplyInput() {
  const { currentUser } = useAuth();
  const textareaRef = useRef(null);

  const {
    replyDraft,
    setReplyDraft,
    sendReply,
    sendingMessage,
    activeConversationId,
    getActiveConversation,
    setShowFollowUpModal,
    setShowCarQuickSend,
    showCarQuickSend,
    carQuickSendQuery,
  } = useMessagingStore();

  const conversation = getActiveConversation();
  const platform = conversation?.platform || "whatsapp";

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }, [replyDraft]);

  // Focus input when conversation changes
  useEffect(() => {
    if (activeConversationId && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [activeConversationId]);

  const handleChange = useCallback(
    (e) => {
      const val = e.target.value;
      setReplyDraft(val);

      // Detect "/" at start to trigger car quick-send
      if (val.startsWith("/")) {
        const query = val.slice(1);
        setShowCarQuickSend(true, query);
      } else if (showCarQuickSend) {
        setShowCarQuickSend(false);
      }
    },
    [setReplyDraft, setShowCarQuickSend, showCarQuickSend]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      // Escape clears car quick-send
      if (e.key === "Escape" && showCarQuickSend) {
        setShowCarQuickSend(false);
      }
    },
    [replyDraft, showCarQuickSend]
  );

  const handleSend = useCallback(async () => {
    if (!replyDraft.trim() || sendingMessage || !activeConversationId) return;
    try {
      await sendReply(replyDraft, currentUser);
    } catch (err) {
      console.error("Send failed:", err);
      // Toast notification would be shown here via Phase 1's notification system
    }
  }, [replyDraft, sendingMessage, activeConversationId, sendReply, currentUser]);

  const canSend = replyDraft.trim().length > 0 && !sendingMessage;

  if (!activeConversationId) return null;

  return (
    <div
      style={{
        borderTop: "1px solid var(--color-border)",
        background: "var(--color-card)",
        padding: "10px 12px",
        flexShrink: 0,
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <PlatformIndicator platform={platform} />

        <div style={{ display: "flex", gap: 6 }}>
          {/* Follow-up button — always visible */}
          <button
            onClick={() => setShowFollowUpModal(true)}
            title="Schedule follow-up"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 10px",
              borderRadius: 8,
              border: "1.5px solid var(--color-border)",
              background: "var(--color-bg)",
              color: "var(--color-text-secondary)",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
              fontWeight: 500,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#CC6600";
              e.currentTarget.style.color = "#CC6600";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border)";
              e.currentTarget.style.color = "var(--color-text-secondary)";
            }}
          >
            ⏰ Follow-up
          </button>
        </div>
      </div>

      {/* Input area */}
      <div style={{ position: "relative" }}>
        {/* Car command hint */}
        <CarCommandHint visible={showCarQuickSend} query={carQuickSendQuery} />

        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          {/* Textarea */}
          <div style={{ flex: 1, position: "relative" }}>
            <textarea
              ref={textareaRef}
              value={replyDraft}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={
                platform === "whatsapp"
                  ? 'Type a message... (type "/" to send car links)'
                  : "Type a message..."
              }
              rows={1}
              disabled={sendingMessage}
              style={{
                width: "100%",
                minHeight: 42,
                maxHeight: 140,
                padding: "10px 14px",
                borderRadius: 10,
                border: "1.5px solid var(--color-border)",
                background: "var(--color-bg)",
                color: "var(--color-text)",
                fontSize: 14,
                lineHeight: 1.5,
                resize: "none",
                outline: "none",
                fontFamily: "'Inter', sans-serif",
                boxSizing: "border-box",
                overflowY: "auto",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#661F1F";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--color-border)";
              }}
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: canSend ? "#661F1F" : "var(--color-border)",
              color: canSend ? "#fff" : "var(--color-text-secondary)",
              border: "none",
              cursor: canSend ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              flexShrink: 0,
              transition: "all 0.15s ease",
              transform: canSend ? "scale(1)" : "scale(0.95)",
            }}
          >
            {sendingMessage ? (
              <span
                style={{
                  width: 16,
                  height: 16,
                  border: "2px solid #fff3",
                  borderTop: "2px solid #fff",
                  borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                  display: "inline-block",
                }}
              />
            ) : (
              "➤"
            )}
          </button>
        </div>

        {/* Hint text */}
        <div
          style={{
            marginTop: 5,
            fontSize: 11,
            color: "var(--color-text-secondary)",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Press <kbd style={{ background: "var(--color-border)", padding: "1px 4px", borderRadius: 3, fontSize: 10 }}>Enter</kbd> to send ·{" "}
          <kbd style={{ background: "var(--color-border)", padding: "1px 4px", borderRadius: 3, fontSize: 10 }}>Shift+Enter</kbd> for new line
          {platform === "whatsapp" && (
            <> · Type <kbd style={{ background: "var(--color-border)", padding: "1px 4px", borderRadius: 3, fontSize: 10 }}>/</kbd> for car links</>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
