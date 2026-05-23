/**
 * NotesPanel.jsx
 * Private notes for the active conversation.
 * Visible ONLY to Owner and SuperAdmin — never to the customer.
 *
 * Features:
 *   - Add new notes with a text area
 *   - Edit existing notes inline
 *   - Delete notes with confirmation
 *   - Timestamps on each note
 *   - Empty state with helpful prompt
 */

import { useState, useRef, useEffect } from "react";
import useMessagingStore, { formatTimestamp } from "../../store/messagingStore";
import { useAuth } from "../../hooks/useAuth";

// ─── Single note card ─────────────────────────────────────────────────────────
function NoteCard({ note, onEdit, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(note.content);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [isEditing]);

  const handleSaveEdit = async () => {
    if (!editValue.trim()) return;
    await onEdit(note.id, editValue);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditValue(note.content);
    setIsEditing(false);
  };

  return (
    <div
      style={{
        background: "#FFFBEA",
        border: "1px solid #F0D080",
        borderRadius: 10,
        padding: "12px 14px",
        position: "relative",
        transition: "box-shadow 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
    >
      {/* Note content / edit area */}
      {isEditing ? (
        <>
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              padding: "6px 8px",
              borderRadius: 6,
              border: "1.5px solid #661F1F",
              background: "#fff",
              color: "#222",
              fontSize: 13,
              lineHeight: 1.5,
              resize: "vertical",
              outline: "none",
              fontFamily: "'Inter', sans-serif",
              boxSizing: "border-box",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.ctrlKey) handleSaveEdit();
              if (e.key === "Escape") handleCancelEdit();
            }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button
              onClick={handleSaveEdit}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                background: "#661F1F",
                color: "#fff",
                border: "none",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Save
            </button>
            <button
              onClick={handleCancelEdit}
              style={{
                padding: "5px 10px",
                borderRadius: 6,
                background: "none",
                color: "#661F1F",
                border: "1px solid #661F1F",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "#3A2A00",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: "'Inter', sans-serif",
            paddingRight: 48, // space for action buttons
          }}
        >
          {note.content}
        </p>
      )}

      {/* Timestamp */}
      {!isEditing && (
        <div
          style={{
            marginTop: 6,
            fontSize: 10,
            color: "#8A7040",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {formatTimestamp(note.updatedAt || note.createdAt)}
          {note.updatedAt && note.updatedAt !== note.createdAt && " (edited)"}
        </div>
      )}

      {/* Action buttons */}
      {!isEditing && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            display: "flex",
            gap: 4,
          }}
        >
          <button
            onClick={() => setIsEditing(true)}
            title="Edit note"
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: "rgba(255,255,255,0.7)",
              border: "1px solid #E0C060",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              color: "#886600",
            }}
          >
            ✏️
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            title="Delete note"
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: "rgba(255,255,255,0.7)",
              border: "1px solid #F0B0B0",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              color: "#CC0000",
            }}
          >
            🗑️
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div
          style={{
            marginTop: 8,
            padding: "8px 10px",
            background: "#FFF0F0",
            border: "1px solid #FFAAAA",
            borderRadius: 7,
            fontSize: 12,
            color: "#990000",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Delete this note?
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button
              onClick={() => {
                onDelete(note.id);
                setConfirmDelete(false);
              }}
              style={{
                padding: "4px 10px",
                borderRadius: 5,
                background: "#CC0000",
                color: "#fff",
                border: "none",
                fontSize: 11,
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
                padding: "4px 8px",
                borderRadius: 5,
                background: "none",
                color: "#CC0000",
                border: "1px solid #CC0000",
                fontSize: 11,
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
export default function NotesPanel() {
  const { currentUser } = useAuth();
  const {
    notes,
    notesLoading,
    activeConversationId,
    addNote,
    updateNote,
    deleteNote,
    getActiveConversation,
  } = useMessagingStore();

  const [newNoteText, setNewNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const newNoteRef = useRef(null);
  const conversation = getActiveConversation();

  const handleAddNote = async () => {
    if (!newNoteText.trim()) return;
    setSaving(true);
    setError("");
    try {
      await addNote(newNoteText, currentUser.uid);
      setNewNoteText("");
    } catch (err) {
      setError("Failed to save note. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (noteId, content) => {
    try {
      await updateNote(noteId, content);
    } catch (err) {
      console.error("Failed to update note:", err);
    }
  };

  const handleDelete = async (noteId) => {
    try {
      await deleteNote(noteId);
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  };

  if (!activeConversationId) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-secondary)",
          fontSize: 13,
          fontFamily: "'Inter', sans-serif",
          padding: 24,
          textAlign: "center",
        }}
      >
        Select a conversation to see notes
      </div>
    );
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
          flexShrink: 0,
          background: "var(--color-card)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
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
            📝 Private Notes
          </h3>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "#CC6600",
              background: "#FFF3E0",
              padding: "2px 7px",
              borderRadius: 8,
              border: "1px solid #CC660033",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            OWNER ONLY
          </span>
        </div>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 11,
            color: "var(--color-text-secondary)",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          For {conversation?.contactName || "this contact"} — never visible to customer
        </p>
      </div>

      {/* Notes list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {notesLoading ? (
          [...Array(2)].map((_, i) => (
            <div
              key={i}
              style={{
                height: 70,
                borderRadius: 10,
                background: "#FFF8D0",
                animation: "pulse 1.4s ease-in-out infinite",
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))
        ) : notes.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "32px 16px",
              color: "var(--color-text-secondary)",
              fontSize: 13,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.5 }}>📝</div>
            No notes yet for this conversation.
            <br />
            Add notes about pricing, preferences, or follow-up history.
          </div>
        ) : (
          notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* Add note input */}
      <div
        style={{
          padding: "12px 14px",
          borderTop: "1px solid var(--color-border)",
          background: "var(--color-card)",
          flexShrink: 0,
        }}
      >
        {error && (
          <div
            style={{
              marginBottom: 8,
              padding: "6px 10px",
              background: "#FFEBEE",
              border: "1px solid #FFAAAA",
              borderRadius: 6,
              fontSize: 12,
              color: "#CC0000",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {error}
          </div>
        )}
        <textarea
          ref={newNoteRef}
          value={newNoteText}
          onChange={(e) => setNewNoteText(e.target.value)}
          placeholder="Add a private note... (e.g. quoted ₹18,000 for Maruti Swift)"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.ctrlKey) handleAddNote();
          }}
          style={{
            width: "100%",
            padding: "9px 12px",
            borderRadius: 8,
            border: "1.5px solid var(--color-border)",
            background: "var(--color-bg)",
            color: "var(--color-text)",
            fontSize: 13,
            lineHeight: 1.5,
            resize: "none",
            outline: "none",
            fontFamily: "'Inter', sans-serif",
            boxSizing: "border-box",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#661F1F")}
          onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 6,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: "var(--color-text-secondary)",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Ctrl+Enter to save
          </span>
          <button
            onClick={handleAddNote}
            disabled={!newNoteText.trim() || saving}
            style={{
              padding: "7px 16px",
              borderRadius: 7,
              background: newNoteText.trim() ? "#661F1F" : "var(--color-border)",
              color: newNoteText.trim() ? "#fff" : "var(--color-text-secondary)",
              border: "none",
              fontSize: 12,
              fontWeight: 600,
              cursor: newNoteText.trim() ? "pointer" : "not-allowed",
              fontFamily: "'Inter', sans-serif",
              transition: "all 0.15s",
            }}
          >
            {saving ? "Saving..." : "Add Note"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
