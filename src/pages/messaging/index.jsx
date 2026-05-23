/**
 * UnifiedInbox — Main container for Phase 8 Unified Messaging.
 *
 * Desktop (≥1024px): Three-panel layout
 *   [ConversationList 25%] [ChatView 45%] [Notes+Docs panel 30%]
 *
 * Mobile (<1024px):
 *   State A: ConversationList (full screen)
 *   State B: ChatView with bottom tab bar (Chat | Notes | Docs)
 *
 * Only accessible by Owner and SuperAdmin (enforced by router in Phase 1).
 */

import { useEffect } from "react";
import { useMessaging } from "../../hooks/useMessaging";
import useMessagingStore from "../../store/messagingStore";
import { useAuth } from "../../hooks/useAuth";
import ConversationList from "./ConversationList";
import ChatView from "./ChatView";
import NotesPanel from "./NotesPanel";
import DocsPanel from "./DocsPanel";
import FollowUpScheduler from "./FollowUpScheduler";

// ─── Platform badge icons (used across components) ───────────────────────────
export function PlatformBadge({ platform, size = "sm" }) {
  const config = {
    whatsapp: { label: "WA", color: "#25D366", bg: "#E8FFF0", darkBg: "#0A2A1A" },
    instagram: { label: "IG", color: "#E1306C", bg: "#FFF0F5", darkBg: "#2A0A1A" },
    facebook: { label: "FB", color: "#1877F2", bg: "#EFF5FF", darkBg: "#0A1A3A" },
  };

  const c = config[platform] || { label: "?", color: "#666", bg: "#F0F0F0" };
  const isLg = size === "lg";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: c.bg,
        color: c.color,
        fontSize: isLg ? 11 : 9,
        fontWeight: 700,
        letterSpacing: 0.3,
        borderRadius: 4,
        padding: isLg ? "3px 7px" : "2px 5px",
        border: `1px solid ${c.color}22`,
        fontFamily: "'Inter', sans-serif",
        flexShrink: 0,
      }}
    >
      {c.label}
    </span>
  );
}

// ─── Mobile tab bar (Chat | Notes | Docs) ────────────────────────────────────
function MobileTabBar({ activeTab, onChange, unreadNotes = 0 }) {
  const tabs = [
    { id: "chat", label: "Chat", icon: "💬" },
    { id: "notes", label: "Notes", icon: "📝", badge: unreadNotes },
    { id: "docs", label: "Docs", icon: "📁" },
  ];

  return (
    <div
      style={{
        display: "flex",
        borderTop: "1px solid var(--color-border)",
        background: "var(--color-card)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              padding: "10px 4px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: isActive ? "#661F1F" : "var(--color-text-secondary)",
              borderTop: isActive ? "2.5px solid #661F1F" : "2.5px solid transparent",
              transition: "all 0.15s ease",
              position: "relative",
            }}
          >
            <span style={{ fontSize: 18 }}>{tab.icon}</span>
            <span style={{ fontSize: 11, fontWeight: isActive ? 600 : 400 }}>{tab.label}</span>
            {tab.badge > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 6,
                  right: "calc(50% - 18px)",
                  background: "#661F1F",
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 700,
                  borderRadius: 10,
                  padding: "1px 5px",
                  minWidth: 16,
                  textAlign: "center",
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Right panel (Notes + Docs tabs) for desktop ─────────────────────────────
function RightPanel() {
  const { mobileTab: rightTab, setMobileTab: setRightTab } = useMessagingStore();

  // On desktop we repurpose mobileTab for the right-panel tab too
  const activeTab = rightTab === "docs" ? "docs" : "notes";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--color-card)",
        borderLeft: "1px solid var(--color-border)",
      }}
    >
      {/* Tab header */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-bg)",
          flexShrink: 0,
        }}
      >
        {[
          { id: "notes", label: "📝 Notes" },
          { id: "docs", label: "📁 Docs" },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setRightTab(tab.id)}
              style={{
                flex: 1,
                padding: "12px 8px",
                background: "none",
                border: "none",
                borderBottom: isActive ? "2.5px solid #661F1F" : "2.5px solid transparent",
                color: isActive ? "#661F1F" : "var(--color-text-secondary)",
                fontWeight: isActive ? 600 : 400,
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.15s",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {activeTab === "notes" ? <NotesPanel /> : <DocsPanel />}
      </div>
    </div>
  );
}

// ─── Empty state (no conversation selected) ───────────────────────────────────
function NoChatSelected() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        color: "var(--color-text-secondary)",
        background: "var(--color-bg)",
      }}
    >
      <div style={{ fontSize: 64, opacity: 0.4 }}>💬</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: "var(--color-text)" }}>
        Unified Inbox
      </div>
      <div style={{ fontSize: 14, textAlign: "center", maxWidth: 260, lineHeight: 1.6 }}>
        Select a conversation from the list to start messaging across WhatsApp, Instagram, and
        Facebook.
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function UnifiedInbox() {
  const { currentUser } = useAuth();

  // Start all real-time listeners
  useMessaging();

  const {
    activeConversationId,
    mobileTab,
    setMobileTab,
    showFollowUpModal,
    notes,
  } = useMessagingStore();

  const unreadNotesCount = notes.length; // badge on Notes tab

  return (
    <>
      {/* ── Desktop layout (≥1024px) ─────────────────────────────────────── */}
      <div
        className="hidden lg:flex"
        style={{
          height: "calc(100vh - 64px)", // subtract top nav height from Phase 1
          overflow: "hidden",
        }}
      >
        {/* Panel 1 — Conversation list (25%) */}
        <div
          style={{
            width: "25%",
            minWidth: 280,
            maxWidth: 360,
            flexShrink: 0,
            borderRight: "1px solid var(--color-border)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <ConversationList />
        </div>

        {/* Panel 2 — Chat view (45%) */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {activeConversationId ? <ChatView /> : <NoChatSelected />}
        </div>

        {/* Panel 3 — Notes + Docs (30%) */}
        <div
          style={{
            width: "30%",
            minWidth: 260,
            maxWidth: 380,
            flexShrink: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {activeConversationId ? <RightPanel /> : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-text-secondary)",
                fontSize: 14,
                borderLeft: "1px solid var(--color-border)",
                background: "var(--color-card)",
              }}
            >
              No conversation selected
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile layout (<1024px) ──────────────────────────────────────── */}
      <div
        className="flex flex-col lg:hidden"
        style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}
      >
        {!activeConversationId ? (
          // State A: Conversation list
          <div style={{ flex: 1, overflow: "hidden" }}>
            <ConversationList />
          </div>
        ) : (
          // State B: Active chat with tab bar
          <>
            {/* Tab content */}
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {mobileTab === "chat" && <ChatView />}
              {mobileTab === "notes" && <NotesPanel />}
              {mobileTab === "docs" && <DocsPanel />}
            </div>

            {/* Bottom tab bar */}
            <MobileTabBar
              activeTab={mobileTab}
              onChange={setMobileTab}
              unreadNotes={unreadNotesCount}
            />
          </>
        )}
      </div>

      {/* ── Follow-up scheduler modal (portal) ─────────────────────────── */}
      {showFollowUpModal && <FollowUpScheduler />}
    </>
  );
}
