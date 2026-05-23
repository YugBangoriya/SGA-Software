/**
 * DocsPanel.jsx
 * Wrapper that embeds the Phase 7 Docs Repository panel inside
 * the messaging interface (right panel on desktop, Docs tab on mobile).
 *
 * In messaging context, selecting a document should "send" it
 * to the active conversation rather than just download/preview it.
 *
 * If Phase 7's DocsPanelEmbed component is available, it is used.
 * If it is not yet built, a placeholder is shown.
 *
 * Phase 7 contract:
 *   DocsPanelEmbed receives:
 *     - mode="messaging"            → enables send-to-chat button
 *     - onSendDoc(doc)             → called when owner taps "Send" on a doc
 *     - conversationId             → the active conversation
 */

import useMessagingStore from "../../store/messagingStore";
import { useAuth } from "../../hooks/useAuth";

// Try to import Phase 7's embed component
let DocsPanelEmbed = null;
try {
  DocsPanelEmbed = require("../docsRepository/DocsPanelEmbed").default;
} catch {
  DocsPanelEmbed = null;
}

// ─── Fallback placeholder when Phase 7 is not yet present ────────────────────
function DocsPanelPlaceholder() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
        color: "var(--color-text-secondary)",
        gap: 12,
      }}
    >
      <div style={{ fontSize: 40, opacity: 0.5 }}>📁</div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--color-text)",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        Docs Repository
      </div>
      <div
        style={{
          fontSize: 12,
          lineHeight: 1.6,
          fontFamily: "'Inter', sans-serif",
          maxWidth: 220,
        }}
      >
        Documents from Phase 7 will appear here. Build Phase 7 first to enable
        quick-send of price lists, banners, and images directly into conversations.
      </div>
      <div
        style={{
          padding: "6px 12px",
          background: "var(--color-border)",
          borderRadius: 8,
          fontSize: 11,
          fontFamily: "'Inter', sans-serif",
          color: "var(--color-text-secondary)",
        }}
      >
        Phase 7 not yet installed
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DocsPanel() {
  const { activeConversationId, sendReply, getActiveConversation } = useMessagingStore();
  const { currentUser } = useAuth();
  const conversation = getActiveConversation();

  /**
   * Called by Phase 7's DocsPanelEmbed when owner taps "Send" on a document.
   * Sends the document URL as a message in the active conversation.
   *
   * @param {Object} doc - { id, fileName, fileUrl, category }
   */
  const handleSendDoc = async (doc) => {
    if (!activeConversationId || !doc?.fileUrl) return;

    const message = `📄 ${doc.fileName}\n${doc.fileUrl}`;
    try {
      await sendReply(message, currentUser);
    } catch (err) {
      console.error("Failed to send document:", err);
    }
  };

  if (!DocsPanelEmbed) {
    return <DocsPanelPlaceholder />;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--color-bg)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 16px 10px",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-card)",
          flexShrink: 0,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            color: "var(--color-text)",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          📁 Docs Repository
        </h3>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 11,
            color: "var(--color-text-secondary)",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {activeConversationId
            ? `Tap "Send" to share a document with ${conversation?.contactName || "the customer"}`
            : "Select a conversation first"}
        </p>
      </div>

      {/* Phase 7 embed */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <DocsPanelEmbed
          mode="messaging"
          onSendDoc={handleSendDoc}
          conversationId={activeConversationId}
          disabled={!activeConversationId}
        />
      </div>
    </div>
  );
}
