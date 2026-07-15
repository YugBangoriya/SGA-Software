// SGA — Last updated: New component — "Check for Updates" section for the Settings My Account tab.
// Uses the standalone checkForUpdates() function exported from AppUpdateBanner.
// src/pages/settings/AppUpdateCheck.jsx

import { useState } from "react";
import { RefreshCw, CheckCircle, AlertTriangle, Wifi } from "lucide-react";
import { checkForUpdates } from "../../components/layout/AppUpdateBanner";

export default function AppUpdateCheck() {
  const [status, setStatus]   = useState("idle"); // "idle" | "checking" | "done" | "error"
  const [message, setMessage] = useState("");

  const handleCheck = async () => {
    setStatus("checking");
    setMessage("");
    try {
      const result = await checkForUpdates();
      setMessage(result.message);
      setStatus("done");
    } catch {
      setMessage("Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  const handleForceReload = () => {
    window.location.reload(true);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Info block */}
      <div style={{
        background: "#E3F2FD",
        border: "1px solid #90CAF9",
        borderRadius: 10,
        padding: "12px 14px",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}>
        <Wifi size={16} color="#1A4A8A" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 13, color: "#1A3A6A", fontFamily: "Arial, sans-serif", margin: 0, lineHeight: 1.5 }}>
          SGA Software updates automatically in the background. Use this button to manually
          check for updates if you think a new version was recently deployed.
        </p>
      </div>

      {/* Status message */}
      {status === "done" && (
        <div style={{
          background: "#E8F5E9", border: "1px solid #A5D6A7", borderRadius: 10,
          padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <CheckCircle size={15} color="#1A7A1A" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 13, color: "#1A5A1A", fontFamily: "Arial, sans-serif", margin: 0 }}>
            {message}
          </p>
        </div>
      )}
      {status === "error" && (
        <div style={{
          background: "#FFEBEE", border: "1px solid #FFCDD2", borderRadius: 10,
          padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <AlertTriangle size={15} color="#CC0000" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 13, color: "#7A0000", fontFamily: "Arial, sans-serif", margin: 0 }}>
            {message}
          </p>
        </div>
      )}

      {/* Buttons row */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {/* Check for Updates */}
        <button
          onClick={handleCheck}
          disabled={status === "checking"}
          style={{
            background: "#661F1F",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "Arial, sans-serif",
            cursor: status === "checking" ? "not-allowed" : "pointer",
            opacity: status === "checking" ? 0.7 : 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
            minHeight: 44,
            transition: "opacity 0.2s",
          }}
        >
          <RefreshCw
            size={15}
            style={status === "checking" ? { animation: "spin 1s linear infinite" } : {}}
          />
          {status === "checking" ? "Checking…" : "Check for Updates"}
        </button>

        {/* Force Reload */}
        <button
          onClick={handleForceReload}
          style={{
            background: "transparent",
            color: "#661F1F",
            border: "1.5px solid #661F1F",
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "Arial, sans-serif",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            minHeight: 44,
          }}
        >
          <RefreshCw size={15} />
          Reload App Now
        </button>
      </div>

      {/* Version note */}
      <p style={{ fontSize: 11, color: "#999", fontFamily: "Arial, sans-serif", margin: 0, marginTop: 4 }}>
        "Reload App Now" always loads the latest cached version. Use it when you know an update was deployed.
      </p>
    </div>
  );
}
