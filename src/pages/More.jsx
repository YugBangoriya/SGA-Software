// src/pages/More.jsx
import { useNavigate }     from "react-router-dom";
import { MessageSquare, ClipboardList, Car, FolderOpen, ShieldCheck, Settings2, Settings } from "lucide-react";
import useAuthStore        from "@/store/authStore";
import useThemeStore       from "@/store/themeStore";
import { getMoreMenuItemsForRole } from "@/lib/rbac";
import AppShell            from "@/components/layout/AppShell";
import { useTranslation }  from "react-i18next";

const ICON_MAP = {
  MessageSquare, ClipboardList, Car, FolderOpen,
  ShieldCheck, Settings2, Settings,
};

export default function More() {
  const { role, userDoc, logout } = useAuthStore();
  const { theme, toggleTheme, language, toggleLanguage } = useThemeStore();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const items = getMoreMenuItemsForRole(role);

  const handleLangToggle = () => {
    const next = toggleLanguage();
    i18n.changeLanguage(next);
  };

  return (
    <AppShell pageTitle={t("nav.more")}>
      {/* Module grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
        {items.map((item) => {
          const Icon = ICON_MAP[item.icon] || Settings;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className="sg-card flex flex-col items-start gap-2 p-4 text-left hover:border-[var(--color-secondary)] transition-all cursor-pointer"
              style={{ minHeight: "96px" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "var(--color-primary-light)", color: "var(--color-primary)" }}
              >
                <Icon size={20} />
              </div>
              <div>
                <p className="font-semibold" style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                  {item.label}
                </p>
                <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px", lineHeight: "1.3" }}>
                  {item.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick preferences */}
      <div className="sg-card mb-4">
        <p className="font-semibold mb-4" style={{ fontSize: "14px", color: "var(--text-primary)" }}>
          Quick Preferences
        </p>
        <div className="flex flex-col gap-3">
          {/* Theme toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {t("settings.theme")}
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {theme === "dark" ? t("settings.darkMode") : t("settings.lightMode")}
              </p>
            </div>
            <ToggleSwitch
              checked={theme === "dark"}
              onChange={toggleTheme}
              aria-label="Toggle dark mode"
            />
          </div>

          {/* Language toggle */}
          <div
            className="flex items-center justify-between pt-3"
            style={{ borderTop: "1px solid var(--border-default)" }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {t("settings.language")}
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {language === "en" ? "English" : "ગુજરાતી"}
              </p>
            </div>
            <button
              onClick={handleLangToggle}
              className="px-3 py-1.5 rounded-badge text-xs font-semibold transition-colors"
              style={{
                background: "var(--color-primary-light)",
                color:      "var(--color-primary)",
                border:     "1px solid var(--color-primary)",
              }}
              aria-label="Toggle language"
            >
              {language === "en" ? "EN → GU" : "GU → EN"}
            </button>
          </div>
        </div>
      </div>

      {/* User info + Sign out */}
      <div className="sg-card">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
            style={{ background: "var(--color-primary)" }}
          >
            {userDoc?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div>
            <p className="font-semibold" style={{ color: "var(--text-primary)", fontSize: "15px" }}>
              {userDoc?.name || "User"}
            </p>
            <p className="text-xs capitalize" style={{ color: "var(--color-primary)" }}>
              {userDoc?.role}
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {userDoc?.email}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="sg-btn sg-btn-danger w-full"
          style={{ fontSize: "13px", minHeight: "40px" }}
        >
          Sign Out
        </button>
      </div>
    </AppShell>
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="relative w-11 h-6 rounded-full transition-colors focus-visible:outline-2 flex-shrink-0"
      style={{
        background: checked ? "var(--color-primary)" : "var(--border-default)",
      }}
    >
      <span
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }}
        aria-hidden="true"
      />
    </button>
  );
}
