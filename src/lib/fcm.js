// src/lib/fcm.js — FIREBASE CLOUD MESSAGING SETUP
// Handles: token registration, notification permission, message display, SW integration

import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { app, db } from './firebase'; // your existing firebase init file

// ─────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
// Add VITE_FIREBASE_VAPID_KEY to your .env file:
//   VITE_FIREBASE_VAPID_KEY=your_vapid_key_here
// Get it from: Firebase Console → Project Settings → Cloud Messaging → Web Push certificates

let messaging = null;

// ─────────────────────────────────────────────────────────────────────────
// INIT MESSAGING (call after Firebase app is initialized)
// ─────────────────────────────────────────────────────────────────────────
export function initMessaging() {
  try {
    messaging = getMessaging(app);
  } catch (err) {
    console.warn('[FCM] Messaging not supported in this environment:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// REQUEST PERMISSION & REGISTER TOKEN
// ─────────────────────────────────────────────────────────────────────────
// IMPORTANT: Call this AFTER a meaningful user action (not on app load).
// Suggested trigger: after first successful invoice approval, or after 
// a "Enable Notifications" button click in Settings.
//
// Usage:
//   import { requestNotificationPermission } from '@/lib/fcm';
//   // In your Settings screen or post-action handler:
//   const token = await requestNotificationPermission(currentUser.uid);

export async function requestNotificationPermission(userId) {
  if (!messaging) {
    console.warn('[FCM] Messaging not initialized.');
    return null;
  }

  // Check if browser supports notifications
  if (!('Notification' in window)) {
    console.warn('[FCM] Browser does not support notifications.');
    return null;
  }

  // If already denied, direct user to browser settings
  if (Notification.permission === 'denied') {
    console.warn('[FCM] Notification permission was denied by user.');
    return null;
  }

  try {
    // Request permission — this shows the browser prompt
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[FCM] Permission not granted:', permission);
      return null;
    }

    // Get FCM token
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.ready,
    });

    if (token) {
      await saveFCMToken(userId, token);
      console.log('[FCM] Token registered successfully.');
      return token;
    }
  } catch (err) {
    console.error('[FCM] Error requesting permission or getting token:', err);
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// SAVE TOKEN TO FIRESTORE (under user document)
// ─────────────────────────────────────────────────────────────────────────
async function saveFCMToken(userId, token) {
  try {
    await setDoc(
      doc(db, 'users', userId),
      {
        fcmTokens: {
          [token]: {
            createdAt: serverTimestamp(),
            platform: getPlatformInfo(),
          },
        },
      },
      { merge: true }
    );
  } catch (err) {
    console.error('[FCM] Failed to save token to Firestore:', err);
  }
}

function getPlatformInfo() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS Safari';
  if (/Android/.test(ua)) return 'Android Chrome';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac/.test(ua)) return 'macOS';
  return 'Unknown';
}

// ─────────────────────────────────────────────────────────────────────────
// FOREGROUND MESSAGE HANDLER
// Fires when a push message arrives WHILE the app is open.
// Shows an in-app toast instead of a system notification.
// ─────────────────────────────────────────────────────────────────────────
export function setupForegroundMessageHandler(showToast) {
  if (!messaging) return;

  onMessage(messaging, (payload) => {
    const { title, body, data } = payload.notification || {};

    console.log('[FCM] Foreground message received:', payload);

    // Show in-app notification using your toast/snackbar component
    showToast({
      title: title || 'Shree Ganesh Automobile',
      body:  body  || '',
      type:  data?.type || 'INFO',
      action: getToastAction(data),
    });
  });
}

function getToastAction(data) {
  if (!data?.type) return null;
  const routes = {
    INVOICE_PENDING: { label: 'View Invoice',   path: `/invoices/${data.invoiceId}` },
    LOW_STOCK:       { label: 'View Inventory',  path: '/inventory' },
    CNG_REMINDER:    { label: 'View Customer',   path: `/customers/${data.customerId}` },
    NEW_MESSAGE:     { label: 'Open Inbox',      path: '/messaging' },
    FOLLOW_UP_SENT:  { label: 'View Follow-Ups', path: '/messaging' },
  };
  return routes[data.type] || null;
}

// ─────────────────────────────────────────────────────────────────────────
// SYNC HANDLER — listens to SW messages for background sync completion
// Call this once in your App.jsx to update UI after queued writes sync
// ─────────────────────────────────────────────────────────────────────────
export function setupSyncHandler(onSyncComplete) {
  if (!navigator.serviceWorker) return;

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'SYNC_COMPLETED') {
      console.log('[SW] Background sync completed — refreshing data.');
      onSyncComplete(); // e.g. invalidate Zustand store / refetch Firestore
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────
// PWA INSTALL PROMPT HANDLER
// Call setupInstallPrompt() in App.jsx once.
// Call showInstallPrompt() when user clicks "Install App" button.
// ─────────────────────────────────────────────────────────────────────────
let deferredInstallPrompt = null;

export function setupInstallPrompt(onInstallAvailable) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    onInstallAvailable(true); // show your "Add to Home Screen" button
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    onInstallAvailable(false); // hide the install button
    console.log('[PWA] App installed successfully.');
  });
}

export async function showInstallPrompt() {
  if (!deferredInstallPrompt) return false;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  return outcome === 'accepted';
}

export function isInstallAvailable() {
  return deferredInstallPrompt !== null;
}

// ─────────────────────────────────────────────────────────────────────────
// SERVICE WORKER UPDATE HANDLER
// Prompts user to refresh when a new SW version is available.
// ─────────────────────────────────────────────────────────────────────────
export function setupSWUpdateHandler(onUpdateAvailable) {
  if (!navigator.serviceWorker) return;

  navigator.serviceWorker.ready.then((registration) => {
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New SW installed, waiting to activate
          onUpdateAvailable(() => {
            // When user confirms update, tell SW to skip waiting
            newWorker.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
          });
        }
      });
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// ONLINE / OFFLINE STATUS HELPERS
// ─────────────────────────────────────────────────────────────────────────
export function setupConnectivityListeners(onOnline, onOffline) {
  window.addEventListener('online',  () => { console.log('[Net] Back online');  onOnline();  });
  window.addEventListener('offline', () => { console.log('[Net] Gone offline'); onOffline(); });

  // Fire immediately based on current state
  if (!navigator.onLine) onOffline();
}

// ─────────────────────────────────────────────────────────────────────────
// FIREBASE CLOUD MESSAGING BACKGROUND HANDLER (firebase-messaging-sw.js)
// ─────────────────────────────────────────────────────────────────────────
// NOTE: Firebase requires a SEPARATE service worker file named
// "firebase-messaging-sw.js" in the PUBLIC folder for background message
// handling. Create public/firebase-messaging-sw.js with the content below:
//
// ─── public/firebase-messaging-sw.js ────────────────────────────────────
//
// importScripts('https://www.gstatic.com/firebasejs/10.x.x/firebase-app-compat.js');
// importScripts('https://www.gstatic.com/firebasejs/10.x.x/firebase-messaging-compat.js');
//
// firebase.initializeApp({
//   apiKey: "YOUR_API_KEY",
//   authDomain: "YOUR_PROJECT.firebaseapp.com",
//   projectId: "YOUR_PROJECT_ID",
//   storageBucket: "YOUR_PROJECT.appspot.com",
//   messagingSenderId: "YOUR_SENDER_ID",
//   appId: "YOUR_APP_ID",
// });
//
// const messaging = firebase.messaging();
//
// messaging.onBackgroundMessage((payload) => {
//   const { title, body, icon } = payload.notification;
//   self.registration.showNotification(title, {
//     body,
//     icon: icon || '/icons/icon-192x192.png',
//     badge: '/icons/badge-72x72.png',
//     tag: payload.data?.type || 'sga-bg-notification',
//     data: payload.data,
//     vibrate: [200, 100, 200],
//   });
// });
//
// ─────────────────────────────────────────────────────────────────────────
