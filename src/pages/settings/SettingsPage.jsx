// src/pages/Settings/SettingsPage.jsx
// Master Settings shell — role-based tab navigation, renders all settings panels.
// SuperAdmin sees: SuperAdmin + Owner + User sections (god-mode).
// Owner sees: Owner + User sections.
// Employee sees: User section only.

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// SuperAdmin components
import UserManagement from "./UserManagement";
import InvoiceDBControls from "./InvoiceDBControls";
import CustomFieldsManager from "./CustomFieldsManager";

// Owner components
import BusinessInfo from "./BusinessInfo";
import { GSTSettings, LowStockDefault, TermsAndConditions } from "./GSTAndTerms";
import DropdownManager from "./DropdownManager";
import FollowUpTemplates from "./FollowUpTemplates";

// User components
import { ThemeToggle, LanguageToggle, ChangePassword } from "./UserPreferences";

// Shared UI
import { T } from "./SettingsUI";
import { useSettings } from "../../hooks/useSettings";
import useAuthStore from "../../store/authStore"; // your existing Phase 1 auth store

// ─── Tab definitions ──────────────────────────────────────────────────────────
const ALL_TABS = [
  {
    id: "superadmin",
    label: "SuperAdmin",
    icon: "🛡️",
    roles: ["superadmin"],
    sections: [
      { id: "users", label: "User Management", icon: "👥", component: <UserManagement /> },
      { id: "invoicedb", label: "Invoice DB Controls", icon: "🔒", component: <InvoiceDBControls /> },
      {
        id: "carrepo",
        label: "Car Repository",
        icon: "🚗",
        component: <CarRepoLink />,
      },
      { id: "customfields", label: "Custom Fields", icon: "🧩", component: <CustomFieldsManager /> },
    ],
  },
  {
    id: "owner",
    label: "Business",
    icon: "🏢",
    roles: ["superadmin", "owner"],
    sections: [
      { id: "bizinfo", label: "Business Information", icon: "🏢", component: <BusinessInfo /> },
      { id: "gst", label: "GST Settings", icon: "📋", component: <GSTSettings /> },
      { id: "lowstock", label: "Low Stock Default", icon: "📦", component: <LowStockDefault /> },
      { id: "dropdowns", label: "Dropdown Values", icon: "📝", component: <DropdownManager /> },
      { id: "templates", label: "Follow-Up Templates", icon: "✉️", component: <FollowUpTemplates /> },
      { id: "terms", label: "Invoice Terms & Conditions", icon: "📄", component: <TermsAndConditions /> },
    ],
  },
  {
    id: "account",
    label: "My Account",
    icon: "👤",
    roles: ["superadmin", "owner", "employee", "accountant"],
    sections: [
      { id: "theme", label: "Theme", icon: "🌙", component: <ThemeToggle /> },
      { id: "language", label: "Language", icon: "🌐", component: <LanguageToggle /> },
      { id: "password", label: "Change Password", icon: "🔑", component: <ChangePassword /> },
    ],
  },
];

export default function SettingsPage() {
  const { loading } = useSettings();
  const user = useAuthStore((s) => s.user);
  const role = user?.role || "employee";

  const visibleTabs = ALL_TABS.filter((tab) => tab.roles.includes(role));
  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.id || "account");
  const [activeSection, setActiveSection] = useState(null);

  const currentTab = visibleTabs.find((t) => t.id === activeTab);
  const sections = currentTab?.sections || [];

  // On tab change, scroll to top and reset section
  useEffect(() => {
    setActiveSection(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab]);

  // Scroll to a specific section when a sidebar link is clicked
  const scrollToSection = (sectionId) => {
    const el = document.getElementById(`section-${sectionId}`);
    if (el) {
      const offset = 80;
      const y = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
    setActiveSection(sectionId);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--color-bg, #CDCBC9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: T.primary, fontSize: 15 }}>Loading settings…</div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-bg, #CDCBC9)",
        fontFamily: "'Inter', system-ui, sans-serif",
        paddingBottom: 80,
      }}
    >
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div
        style={{
          background: T.primary,
          padding: "20px 20px 0",
          boxShadow: "0 4px 12px rgba(102,31,31,0.2)",
        }}
      >
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <h1
            style={{
              color: "#fff",
              fontSize: 22,
              fontWeight: 700,
              margin: "0 0 4px",
            }}
          >
            Settings
          </h1>
          <p style={{ color: "#F0BABA", fontSize: 13, margin: "0 0 16px" }}>
            Manage business configuration, user accounts, and preferences
          </p>

          {/* ── Tab Bar ────────────────────────────────────────────────────── */}
          <div style={{ display: "flex", gap: 2, overflowX: "auto", paddingBottom: 0 }}>
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "10px 18px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "none",
                  background: "transparent",
                  color: activeTab === tab.id ? "#fff" : "rgba(255,255,255,0.6)",
                  borderBottom: activeTab === tab.id ? "3px solid #fff" : "3px solid transparent",
                  borderRadius: "6px 6px 0 0",
                  transition: "all 0.2s",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content Area ───────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px 0" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr)",
            gap: 0,
          }}
          className="settings-layout"
        >
          {/* On desktop: show sticky left nav; on mobile, hide it */}
          <style>{`
            @media (min-width: 768px) {
              .settings-layout {
                grid-template-columns: 200px minmax(0, 1fr) !important;
                gap: 24px !important;
              }
              .settings-sidenav { display: block !important; }
            }
            @keyframes shimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `}</style>

          {/* Sticky Left Nav (desktop only) */}
          <div
            className="settings-sidenav"
            style={{
              display: "none",
              position: "sticky",
              top: 80,
              height: "fit-content",
            }}
          >
            <div
              style={{
                background: "var(--color-card, #F5F0EE)",
                borderRadius: 12,
                border: `1px solid ${T.border}`,
                overflow: "hidden",
              }}
            >
              {sections.map((sec, i) => (
                <button
                  key={sec.id}
                  onClick={() => scrollToSection(sec.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "11px 14px",
                    fontSize: 13,
                    fontWeight: activeSection === sec.id ? 600 : 400,
                    cursor: "pointer",
                    border: "none",
                    borderBottom: i < sections.length - 1 ? `1px solid ${T.border}` : "none",
                    background: activeSection === sec.id ? "#FFF5F5" : "transparent",
                    color: activeSection === sec.id ? T.primary : T.textSecondary,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    transition: "all 0.15s",
                    fontFamily: "inherit",
                    borderLeft: activeSection === sec.id ? `3px solid ${T.primary}` : "3px solid transparent",
                  }}
                >
                  <span style={{ fontSize: 14 }}>{sec.icon}</span>
                  <span>{sec.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div>
            {sections.map((sec) => (
              <div key={sec.id} id={`section-${sec.id}`}>
                {sec.component}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Car Repository Link Component ───────────────────────────────────────────
function CarRepoLink() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        background: "var(--color-card, #F5F0EE)",
        borderRadius: 14,
        border: `1.5px solid ${T.border}`,
        marginBottom: 18,
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          padding: "16px 20px 14px",
          borderBottom: `1px solid ${T.border}`,
          background: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 18 }}>🚗</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.primary }}>Car Repository</div>
          <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>
            Manage car companies, models, and media links
          </div>
        </div>
      </div>
      <div style={{ padding: "18px 20px" }}>
        <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.6, marginBottom: 16 }}>
          The Car Repository is managed in its own dedicated module (Phase 6). Click below to open it.
          Add car companies, models, Google Drive image links, and Instagram Reel links there.
        </div>
        <button
          onClick={() => navigate("/car-repository")}
          style={{
            background: T.primary,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          🚗 Open Car Repository →
        </button>
      </div>
    </div>
  );
}