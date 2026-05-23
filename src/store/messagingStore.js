/**
 * messagingStore.js
 * Zustand store for the Unified Messaging module.
 *
 * Manages:
 *   - Conversations list + active conversation
 *   - Messages for active conversation
 *   - Notes for active conversation
 *   - Follow-ups list + templates
 *   - UI state (mobile tab, panels, modals)
 *   - Send/reply operations
 *
 * FIX (sendReply): Cloud Function errors (e.g. functions/not-found when APIs
 * are not yet configured) are now caught, classified, and surfaced to the user
 * as a toast notification. The reply draft is preserved on failure so the
 * owner can retry. The error is no longer re-thrown (UI stays stable).
 */

import { create } from "zustand";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDocs,
  getDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { getFunctions, httpsCallable } from "firebase/functions";

// Toast store — accessed via .getState() so no React hook is needed here.
// This is the standard Zustand pattern for calling stores outside React.
import useToastStore from "../components/ui/Toast";

// ─── Helper: format Firestore Timestamp ──────────────────────────────────────

export function formatTimestamp(ts) {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diff = now - date;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);

  if (mins < 1)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7)   return `${days}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ─── Platform config ──────────────────────────────────────────────────────────

export const PLATFORM_CONFIG = {
  whatsapp: {
    label: "WhatsApp",
    shortLabel: "WA",
    color: "#25D366",
    bgColor: "#E8FFF0",
    darkBg: "#0A3A1A",
    icon: "💬",
  },
  instagram: {
    label: "Instagram",
    shortLabel: "IG",
    color: "#E1306C",
    bgColor: "#FFF0F5",
    darkBg: "#3A0A1A",
    icon: "📸",
  },
  facebook: {
    label: "Facebook",
    shortLabel: "FB",
    color: "#1877F2",
    bgColor: "#EFF5FF",
    darkBg: "#0A1A3A",
    icon: "💙",
  },
};

// ─── Error classifier ─────────────────────────────────────────────────────────

/**
 * Returns a user-friendly message for Cloud Function / network errors.
 * Handles the common pre-launch case where the Cloud Function is not yet
 * deployed (functions/not-found) because the WhatsApp API isn't configured.
 */
function classifySendError(err) {
  const code = err?.code || "";
  const msg  = err?.message || "";

  if (
    code === "functions/not-found"     ||
    code === "functions/unavailable"   ||
    code === "functions/unimplemented" ||
    msg.includes("not-found")          ||
    msg.includes("NOT_FOUND")
  ) {
    return "WhatsApp API is not yet configured. Sending is disabled until setup is complete.";
  }

  if (
    code === "functions/deadline-exceeded" ||
    code === "functions/internal"          ||
    msg.includes("network")                ||
    msg.includes("fetch")
  ) {
    return "Network error — could not reach the server. Please check your connection and try again.";
  }

  if (code === "functions/unauthenticated" || code === "functions/permission-denied") {
    return "You don't have permission to send messages. Please contact the SuperAdmin.";
  }

  return "Failed to send message. Please try again.";
}

// ─── Store ────────────────────────────────────────────────────────────────────

const useMessagingStore = create((set, get) => ({
  // ── Conversations ──────────────────────────────────────────────────────────
  conversations: [],
  activeConversationId: null,
  platformFilter: "all", // "all" | "whatsapp" | "instagram" | "facebook"
  conversationListScrollTop: 0,

  // ── Messages ───────────────────────────────────────────────────────────────
  messages: [],
  messagesLoading: false,

  // ── Notes ─────────────────────────────────────────────────────────────────
  notes: [],
  notesLoading: false,

  // ── Follow-ups ─────────────────────────────────────────────────────────────
  followUps: [],
  followUpTemplates: [],
  followUpLoading: false,

  // ── UI State ────────────────────────────────────────────────────────────────
  mobileTab: "chat",
  showFollowUpModal: false,
  showTemplateManager: false,
  showCarQuickSend: false,
  carQuickSendQuery: "",
  sendingMessage: false,
  replyDraft: "",
  sendError: null, // last send error message (null = no error)

  // ── First-reply follow-up prompt ───────────────────────────────────────────
  showFirstReplyFollowUpPrompt: false,

  // ─────────────────────────────────────────────────────────────────────────
  // Setters
  // ─────────────────────────────────────────────────────────────────────────

  setConversations: (conversations) => set({ conversations }),

  setActiveConversationId: (id) => {
    set({
      activeConversationId: id,
      mobileTab: "chat",
      messages: [],
      notes: [],
      showFirstReplyFollowUpPrompt: false,
      sendError: null,
    });
  },

  setPlatformFilter: (filter) => set({ platformFilter: filter }),

  setConversationListScrollTop: (top) => set({ conversationListScrollTop: top }),

  setMessages: (messages) => set({ messages }),

  setMessagesLoading: (loading) => set({ messagesLoading: loading }),

  setNotes: (notes) => set({ notes }),

  setNotesLoading: (loading) => set({ notesLoading: loading }),

  setMobileTab: (tab) => set({ mobileTab: tab }),

  setReplyDraft: (text) => set({ replyDraft: text }),

  setShowFollowUpModal: (show) => set({ showFollowUpModal: show }),

  setShowTemplateManager: (show) => set({ showTemplateManager: show }),

  setShowCarQuickSend: (show, query = "") =>
    set({ showCarQuickSend: show, carQuickSendQuery: query }),

  setShowFirstReplyFollowUpPrompt: (show) =>
    set({ showFirstReplyFollowUpPrompt: show }),

  setFollowUps: (followUps) => set({ followUps }),

  setFollowUpTemplates: (templates) => set({ followUpTemplates: templates }),

  // ─────────────────────────────────────────────────────────────────────────
  // Active conversation getter
  // ─────────────────────────────────────────────────────────────────────────

  getActiveConversation: () => {
    const { conversations, activeConversationId } = get();
    return conversations.find((c) => c.id === activeConversationId) || null;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Send message
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Sends a reply message from the owner.
   * Calls a Cloud Function that handles platform-specific delivery.
   *
   * On success: message added to local state, draft cleared.
   * On failure: user-facing toast shown, draft PRESERVED for retry.
   *
   * Does NOT re-throw — the UI remains stable on error.
   *
   * @param {string} text        - message text
   * @param {Object} currentUser - { uid, displayName }
   * @returns {boolean} true on success, false on failure
   */
  sendReply: async (text, currentUser) => {
    const { activeConversationId, messages } = get();
    if (!activeConversationId || !text.trim()) return false;

    set({ sendingMessage: true, sendError: null });

    try {
      const conversation = get().getActiveConversation();
      if (!conversation) throw new Error("No active conversation");

      const { platform, contactId } = conversation;

      // Call the send Cloud Function
      const functions = getFunctions();
      const sendMessageFn = httpsCallable(functions, "sendReplyMessage");

      const result = await sendMessageFn({
        conversationId: activeConversationId,
        platform,
        contactId,
        text,
      });

      const platformMessageId = result.data?.messageId || null;

      // Optimistically add to local state and clear the draft
      const newMessage = {
        id: `local_${Date.now()}`,
        platformMessageId,
        content: text,
        direction: "outbound",
        messageType: "text",
        status: "sent",
        sentByUid: currentUser.uid,
        sentByName: currentUser.displayName || "Owner",
        timestamp: { toDate: () => new Date() },
        createdAt: { toDate: () => new Date() },
      };

      set({ messages: [...messages, newMessage], replyDraft: "" });

      // Update conversation preview in local state
      const { conversations } = get();
      set({
        conversations: conversations.map((c) =>
          c.id === activeConversationId
            ? {
                ...c,
                lastMessage: text,
                lastMessageAt: { toDate: () => new Date() },
                lastMessageBy: "owner",
              }
            : c
        ),
      });

      // First outbound message → show follow-up prompt
      const outboundCount = messages.filter((m) => m.direction === "outbound").length;
      if (outboundCount === 0) {
        setTimeout(() => {
          set({ showFirstReplyFollowUpPrompt: true });
        }, 800);
      }

      return true;
    } catch (err) {
      console.error("sendReply failed:", err);

      const userMessage = classifySendError(err);

      // Surface to user via toast (no React hook — calling Zustand store directly)
      useToastStore.getState().show(userMessage, "error");

      // Store the error so ReplyInput can optionally show inline feedback
      set({ sendError: userMessage });

      // Draft is intentionally NOT cleared — owner can fix and retry
      return false;
    } finally {
      set({ sendingMessage: false });
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Notes CRUD
  // ─────────────────────────────────────────────────────────────────────────

  addNote: async (content, currentUserUid) => {
    const { activeConversationId, notes } = get();
    if (!activeConversationId || !content.trim()) return;

    const notesRef = collection(db, "conversations", activeConversationId, "notes");
    const docRef = await addDoc(notesRef, {
      content: content.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: currentUserUid,
    });

    set({
      notes: [
        ...notes,
        {
          id: docRef.id,
          content: content.trim(),
          createdAt: { toDate: () => new Date() },
          updatedAt: { toDate: () => new Date() },
          createdBy: currentUserUid,
        },
      ],
    });
  },

  updateNote: async (noteId, content) => {
    const { activeConversationId, notes } = get();
    if (!activeConversationId) return;

    const noteRef = doc(db, "conversations", activeConversationId, "notes", noteId);
    await updateDoc(noteRef, {
      content: content.trim(),
      updatedAt: serverTimestamp(),
    });

    set({
      notes: notes.map((n) =>
        n.id === noteId
          ? { ...n, content: content.trim(), updatedAt: { toDate: () => new Date() } }
          : n
      ),
    });
  },

  deleteNote: async (noteId) => {
    const { activeConversationId, notes } = get();
    if (!activeConversationId) return;

    const noteRef = doc(db, "conversations", activeConversationId, "notes", noteId);
    await deleteDoc(noteRef);
    set({ notes: notes.filter((n) => n.id !== noteId) });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Follow-up scheduling
  // ─────────────────────────────────────────────────────────────────────────

  scheduleFollowUp: async ({ scheduledDate, message, language, templateId, currentUser }) => {
    const { activeConversationId } = get();
    if (!activeConversationId) return;

    const conversation = get().getActiveConversation();
    if (!conversation) return;

    const followUpRef = await addDoc(collection(db, "followUps"), {
      conversationId: activeConversationId,
      platform: conversation.platform,
      contactId: conversation.contactId,
      contactName: conversation.contactName,
      scheduledAt: scheduledDate,
      customMessage: message,
      language: language || "en",
      templateId: templateId || null,
      status: "pending",
      sentAt: null,
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
    });

    await updateDoc(doc(db, "conversations", activeConversationId), {
      hasFollowUp: true,
      followUpScheduledAt: scheduledDate,
    });

    const { conversations } = get();
    set({
      conversations: conversations.map((c) =>
        c.id === activeConversationId
          ? { ...c, hasFollowUp: true, followUpScheduledAt: scheduledDate }
          : c
      ),
      showFollowUpModal: false,
      showFirstReplyFollowUpPrompt: false,
    });

    return followUpRef.id;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Template CRUD
  // ─────────────────────────────────────────────────────────────────────────

  createTemplate: async ({ name, messageEn, messageHi, messageGu, currentUserUid }) => {
    const ref = await addDoc(collection(db, "followUpTemplates"), {
      name,
      messageEn: messageEn || "",
      messageHi: messageHi || "",
      messageGu: messageGu || "",
      createdBy: currentUserUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const { followUpTemplates } = get();
    set({
      followUpTemplates: [
        ...followUpTemplates,
        {
          id: ref.id,
          name,
          messageEn,
          messageHi,
          messageGu,
          createdAt: { toDate: () => new Date() },
        },
      ],
    });
  },

  updateTemplate: async (templateId, updates) => {
    const templateRef = doc(db, "followUpTemplates", templateId);
    await updateDoc(templateRef, { ...updates, updatedAt: serverTimestamp() });

    const { followUpTemplates } = get();
    set({
      followUpTemplates: followUpTemplates.map((t) =>
        t.id === templateId ? { ...t, ...updates } : t
      ),
    });
  },

  deleteTemplate: async (templateId) => {
    await deleteDoc(doc(db, "followUpTemplates", templateId));
    const { followUpTemplates } = get();
    set({ followUpTemplates: followUpTemplates.filter((t) => t.id !== templateId) });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Mark conversation as read
  // ─────────────────────────────────────────────────────────────────────────

  markAsRead: async (conversationId) => {
    const convRef = doc(db, "conversations", conversationId);
    await updateDoc(convRef, { unreadCount: 0 });

    const { conversations } = get();
    set({
      conversations: conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      ),
    });
  },
}));

export default useMessagingStore;