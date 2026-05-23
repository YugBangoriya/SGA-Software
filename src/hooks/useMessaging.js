/**
 * useMessaging.js
 * Custom React hook that sets up real-time Firestore listeners for:
 *   - /conversations (all conversations, sorted by lastMessageAt)
 *   - /conversations/{id}/messages (when active conversation changes)
 *   - /conversations/{id}/notes (when active conversation changes)
 *   - /followUps (all follow-ups for the follow-up log)
 *   - /followUpTemplates (template list)
 *
 * Cleans up listeners on unmount.
 * Only active for Owner and SuperAdmin roles.
 */

import { useEffect, useCallback } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  where,
  limit,
  getDocs,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import useMessagingStore from "../store/messagingStore";
import { useAuth } from "./useAuth"; // Phase 1 hook

export function useMessaging() {
  const { currentUser } = useAuth();
  const {
    activeConversationId,
    setConversations,
    setMessages,
    setMessagesLoading,
    setNotes,
    setNotesLoading,
    setFollowUps,
    setFollowUpTemplates,
    markAsRead,
  } = useMessagingStore();

  // ── Conversations listener ──────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;

    const role = currentUser.role;
    if (role !== "owner" && role !== "superadmin") return;

    const q = query(
      collection(db, "conversations"),
      orderBy("lastMessageAt", "desc"),
      limit(200) // reasonable cap for initial load
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const convs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setConversations(convs);
      },
      (err) => {
        console.error("Conversations listener error:", err);
      }
    );

    return () => unsub();
  }, [currentUser, setConversations]);

  // ── Messages listener (changes with active conversation) ───────────────────
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    setMessagesLoading(true);

    const q = query(
      collection(db, "conversations", activeConversationId, "messages"),
      orderBy("timestamp", "asc"),
      limit(500)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const msgs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setMessages(msgs);
        setMessagesLoading(false);

        // Mark as read when messages load
        markAsRead(activeConversationId).catch(() => {});
      },
      (err) => {
        console.error("Messages listener error:", err);
        setMessagesLoading(false);
      }
    );

    return () => unsub();
  }, [activeConversationId, setMessages, setMessagesLoading, markAsRead]);

  // ── Notes listener (changes with active conversation) ─────────────────────
  useEffect(() => {
    if (!activeConversationId) {
      setNotes([]);
      return;
    }

    setNotesLoading(true);

    const q = query(
      collection(db, "conversations", activeConversationId, "notes"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const notesList = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setNotes(notesList);
        setNotesLoading(false);
      },
      (err) => {
        console.error("Notes listener error:", err);
        setNotesLoading(false);
      }
    );

    return () => unsub();
  }, [activeConversationId, setNotes, setNotesLoading]);

  // ── Follow-ups listener ────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role !== "owner" && currentUser.role !== "superadmin") return;

    const q = query(
      collection(db, "followUps"),
      orderBy("scheduledAt", "desc"),
      limit(100)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setFollowUps(items);
      },
      (err) => console.error("FollowUps listener error:", err)
    );

    return () => unsub();
  }, [currentUser, setFollowUps]);

  // ── Templates listener ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, "followUpTemplates"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const templates = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setFollowUpTemplates(templates);
      },
      (err) => console.error("Templates listener error:", err)
    );

    return () => unsub();
  }, [currentUser, setFollowUpTemplates]);
}

/**
 * useConversationSearch
 * Provides a search function that filters conversations client-side.
 * For a production app with thousands of conversations, replace with
 * a Firestore full-text search integration (e.g. Algolia / Typesense).
 */
export function useConversationSearch(conversations, searchQuery, platformFilter) {
  if (!searchQuery && platformFilter === "all") return conversations;

  let filtered = conversations;

  if (platformFilter !== "all") {
    filtered = filtered.filter((c) => c.platform === platformFilter);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(
      (c) =>
        c.contactName?.toLowerCase().includes(q) ||
        c.contactPhone?.includes(q) ||
        c.lastMessage?.toLowerCase().includes(q)
    );
  }

  return filtered;
}
