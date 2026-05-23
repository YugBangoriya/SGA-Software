/**
 * MessageBubble.jsx
 * Individual message bubble in the chat view.
 * Handles inbound (customer) and outbound (owner) messages with
 * delivery status indicators for outbound WhatsApp messages.
 */

import { formatTimestamp } from "../../store/messagingStore";

const STATUS_ICONS = {
  sent: "✓",
  delivered: "✓✓",
  read: "✓✓", // We colour these blue
  failed: "✗",
  received: null,
};

const MESSAGE_TYPE_ICONS = {
  image: "🖼️",
  document: "📄",
  audio: "🎵",
  video: "🎬",
  location: "📍",
  sticker: "😊",
  template: "📋",
  story_mention: "📖",
  reel: "🎬",
  link: "🔗",
};

export default function MessageBubble({ message }) {
  const isOutbound = message.direction === "outbound";
  const isAutoFollowUp = message.sentByName === "Auto Follow-up";

  const bubbleStyle = {
    maxWidth: "75%",
    padding: "8px 12px",
    borderRadius: isOutbound ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
    background: isOutbound ? "#661F1F" : "var(--color-card)",
    color: isOutbound ? "#fff" : "var(--color-text)",
    border: isOutbound ? "none" : "1px solid var(--color-border)",
    fontSize: 14,
    lineHeight: 1.5,
    wordBreak: "break-word",
    fontFamily: "'Inter', sans-serif",
    position: "relative",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  };

  const hasMedia = message.mediaUrl || MESSAGE_TYPE_ICONS[message.messageType];
  const typeIcon = MESSAGE_TYPE_ICONS[message.messageType];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isOutbound ? "flex-end" : "flex-start",
        marginBottom: 6,
        padding: "0 16px",
      }}
    >
      {/* Auto follow-up label */}
      {isAutoFollowUp && (
        <div
          style={{
            fontSize: 10,
            color: "#CC6600",
            fontWeight: 600,
            marginBottom: 3,
            fontFamily: "'Inter', sans-serif",
          }}
        >
          ⏰ Auto Follow-up
        </div>
      )}

      <div style={bubbleStyle}>
        {/* Media type icon for non-text messages */}
        {typeIcon && message.messageType !== "text" && (
          <div style={{ marginBottom: 4, opacity: 0.8 }}>
            {typeIcon} {message.content}
          </div>
        )}

        {/* Clickable media link */}
        {message.mediaUrl && (
          <a
            href={message.mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: isOutbound ? "#FFD0D0" : "#0055CC",
              fontSize: 12,
              display: "block",
              marginBottom: 4,
              textDecoration: "underline",
            }}
          >
            View attachment ↗
          </a>
        )}

        {/* Message text */}
        {message.messageType === "text" && (
          <span>{message.content}</span>
        )}

        {/* Timestamp + status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 4,
            marginTop: 4,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: isOutbound ? "rgba(255,255,255,0.65)" : "var(--color-text-secondary)",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {formatTimestamp(message.timestamp)}
          </span>

          {/* Delivery status (outbound only) */}
          {isOutbound && message.status && STATUS_ICONS[message.status] && (
            <span
              style={{
                fontSize: 11,
                color: message.status === "read"
                  ? "#A0FFD0"
                  : message.status === "failed"
                  ? "#FF8888"
                  : "rgba(255,255,255,0.65)",
                fontWeight: 600,
                letterSpacing: -0.5,
              }}
            >
              {STATUS_ICONS[message.status]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}