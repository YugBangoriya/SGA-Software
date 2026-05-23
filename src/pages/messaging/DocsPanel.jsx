/**
 * DocsPanel.jsx
 * Wrapper that embeds the Phase 7 DocsRepositoryPanel inside
 * the messaging interface (right panel on desktop, Docs tab on mobile).
 *
 * FIX: The previous version tried to require a non-existent
 * "DocsPanelEmbed" component. The actual Phase 7 component is
 * "DocsRepositoryPanel" at ../docsRepository/DocsRepositoryPanel,
 * with props: onSendDocument, onClose (unused in inline mode),
 * darkMode, and inline=true for embedded rendering.
 */

import useMessagingStore from "../../store/messagingStore";
import { useAuth } from "../../hooks/useAuth";
import useThemeStore from "../../store/themeStore";

// ── Correct Phase 7 import ─────────────────────────────────────────────────
let DocsRepositoryPanel = null;
try {
  DocsRepositoryPanel = require("../docsRepository/DocsRepositoryPanel").default;
} catch {
  DocsRepositoryPanel = null;
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
  const { theme } = useThemeStore();
  const isDark = theme === "dark";
  const conversation = getActiveConversation();

  /**
   * Called by DocsRepositoryPanel when owner taps "Send" on a document.
   * Sends the document URL as a message in the active conversation.
   *
   * @param {Object} doc - { id, fileName, fileUrl, category }
   */
  const handleSendDocument = async (doc) => {
    if (!activeConversationId || !doc?.fileUrl) return;
    const message = `📄 ${doc.fileName}\n${doc.fileUrl}`;
    try {
      await sendReply(message, currentUser);
    } catch (err) {
      console.error("Failed to send document:", err);
    }
  };

  if (!DocsRepositoryPanel) {
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

      {/* Phase 7 embed — inline=true removes the overlay wrapper */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <DocsRepositoryPanel
          inline={true}
          darkMode={isDark}
          onSendDocument={activeConversationId ? handleSendDocument : undefined}
          onClose={() => {}}
        />
      </div>
    </div>
  );
}