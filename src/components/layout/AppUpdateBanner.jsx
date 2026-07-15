// SGA — Last updated: New component — detects when a new service worker has activated
// and shows a non-intrusive banner prompting the user to reload and get the latest version.
// src/components/layout/AppUpdateBanner.jsx

import { useState, useEffect } from "react";
import { RefreshCw, X } from "lucide-react";
import useThemeStore from "../../store/themeStore";

/**
 * AppUpdateBanner
 *
 * Listens for the native service-worker `controllerchange` event.  
 * When the SGA service worker activates a new version (which happens automatically
 * because sw.js calls self.skipWaiting() in its install event), this banner appears
 * at the top of the screen asking the user to reload.
 *
 * Usage: render this inside AppShell, above the main content area.
 */
export default function AppUpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isReloading, setIsReloading]         = useState(false);
  const { theme } = useThemeStore();
  const isDark = theme === "dark";

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Track whether a service worker was already controlling this page.
    // If there was NO previous controller (first-ever install), we don't
    // show a banner — that's not an "update", that's the first install.
    const hadController = !!navigator.serviceWorker.controller;

    const handleControllerChange = () => {
      if (hadController) {
        // A new SW has taken control — there is now an updated version running.
        setUpdateAvailable(true);
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  const handleReload = () => {
    setIsReloading(true);
    // Give a brief moment for the button animation, then reload.
    setTimeout(() => window.location.reload(), 300);
  };

  const handleDismiss = () => setUpdateAvailable(false);

  if (!updateAvailable) return null;

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 1000,
        background: isDark ? "#1A3A1A" : "#E8F5E9",
        borderBottom: `1px solid ${isDark ? "#2A5A2A" : "#A5D6A7"}`,
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: isDark ? "#2A5A2A" : "#C8E6C9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <RefreshCw size={16} color={isDark ? "#66BB6A" : "#1A7A1A"} />
      </div>

      {/* Text */}
      <div style={{ flex: 1 }}>
        <p style={{
          fontSize: 13,
          fontWeight: 700,
          color: isDark ? "#A5D6A7" : "#1A5A1A",
          fontFamily: "Arial, sans-serif",
          margin: 0,
        }}>
          Update available
        </p>
        <p style={{
          fontSize: 12,
          color: isDark ? "#66BB6A" : "#2E7D32",
          fontFamily: "Arial, sans-serif",
          margin: 0,
          marginTop: 1,
        }}>
          A new version of SGA Software is ready.
        </p>
      </div>

      {/* Reload button */}
      <button
        onClick={handleReload}
        disabled={isReloading}
        style={{
          background: "#1A7A1A",
          color: "#FFFFFF",
          border: "none",
          borderRadius: 8,
          padding: "7px 14px",
          fontSize: 12,
          fontWeight: 700,
          fontFamily: "Arial, sans-serif",
          cursor: isReloading ? "not-allowed" : "pointer",
          opacity: isReloading ? 0.7 : 1,
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexShrink: 0,
          minHeight: 34,
          transition: "opacity 0.2s",
        }}
        aria-label="Reload to apply update"
      >
        {isReloading ? (
          <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} />
        ) : (
          <RefreshCw size={13} />
        )}
        {isReloading ? "Reloading…" : "Reload Now"}
      </button>

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: isDark ? "#66BB6A" : "#388E3C",
          padding: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
          flexShrink: 0,
        }}
        aria-label="Dismiss update banner"
        title="Dismiss"
      >
        <X size={15} />
      </button>
    </div>
  );
}

/**
 * checkForUpdates
 *
 * Exported standalone function for the Settings page's manual
 * "Check for Updates" button.  Asks the active service worker registration
 * to poll the server for a new SW file.  If a new SW is found and activates
 * (via skipWaiting in sw.js), the AppUpdateBanner above will show automatically.
 *
 * Returns a promise that resolves to { hasUpdate: bool, message: string }.
 */
export async function checkForUpdates() {
  if (!("serviceWorker" in navigator)) {
    return { hasUpdate: false, message: "Service Worker not supported in this browser." };
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
    // After update() resolves, if a new SW was found it will auto-activate
    // (because sw.js calls skipWaiting), which triggers the controllerchange
    // event and the banner above.  If nothing was found, no change occurs.
    return { hasUpdate: true, message: "Update check complete. The app will notify you if a new version is available." };
  } catch (err) {
    console.warn("[AppUpdate] SW update check failed:", err);
    return { hasUpdate: false, message: "Could not check for updates. Please ensure you are connected to the internet." };
  }
}
