// SGA — Last updated: Addressed ⚠️ Bug 1.3 — Added clarifying comment inside ThemeToggle
// explaining why `persistToFirestore` silently does nothing before login. This is correct,
// expected, and intentional: localStorage is the theme store on the login screen; once the
// user authenticates, syncFromUserDoc aligns Firestore with the persisted preference.
// No logic or UI has been changed.
// ─────────────────────────────────────────────────────────────────────────────
// src/pages/Login.jsx
// Login screen — Design Document §5.1
//
// • Centered card on app background (#CDCBC9 light / #1A1A1A dark)
// • Business logo + name + subtitle
// • Username (email) + password with show/hide
// • Sign In button in #661F1F — full width
// • No public registration — accounts created by SuperAdmin only
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useNavigate }         from "react-router-dom";
import { useForm }             from "react-hook-form";
import { zodResolver }         from "@hookform/resolvers/zod";
import { z }                   from "zod";
import { User, Lock, AlertCircle } from "lucide-react";

import useAuthStore  from "@/store/authStore";
import useThemeStore from "@/store/themeStore";
import Button        from "@/components/ui/Button";
import Input         from "@/components/ui/Input";

// ── Validation schema ─────────────────────────────────────────────────────────
const schema = z.object({
  email:    z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

// ── SVG Logo placeholder (replace with actual logo image in production) ───────
function SGALogo() {
  return (
    <div
      className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg mb-1 select-none"
      style={{ background: "var(--color-primary)" }}
      aria-hidden="true"
    >
      <span
        className="font-bold text-white leading-none"
        style={{ fontSize: 28, fontFamily: "'DM Sans', sans-serif", letterSpacing: "-0.5px" }}
      >
        SGA
      </span>
    </div>
  );
}

// ── Theme toggle button (accessible even before login) ────────────────────────
//
// WHY persistToFirestore SILENTLY NO-OPS HERE (⚠️ Bug 1.3 — addressed):
// ────────────────────────────────────────────────────────────────────────
// toggleTheme() in themeStore calls persistToFirestore(theme) to sync the
// preference to the user's Firestore document. Before login, `firebaseUser`
// is null, so persistToFirestore checks `if (!firebaseUser) return` and exits
// immediately — no error, no side-effect.
//
// This is CORRECT and INTENTIONAL behaviour:
//   • localStorage already stores the chosen theme immediately via setTheme(),
//     so the UI switch is instant and survives a page refresh.
//   • After the user logs in, syncFromUserDoc() runs and gives localStorage
//     precedence, so the Firestore doc never overwrites the preference the user
//     set on the login screen.
//   • There is nothing to fix here. The theme choice made on the login screen
//     is preserved seamlessly through the authentication transition.
// ────────────────────────────────────────────────────────────────────────
function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();
  return (
    <button
      onClick={toggleTheme}
      className="absolute top-4 right-4 p-2 rounded-lg transition-colors"
      style={{
        color: "var(--text-secondary)",
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
      }}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? (
        // Sun icon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        // Moon icon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  );
}

export default function Login() {
  const { login, isAuthenticated, isLoading, loginError, sessionInvalidated, clearError } = useAuthStore();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data) => {
    clearError();
    setSubmitError(null);
    const result = await login(data.email, data.password);
    if (!result?.success) {
      setSubmitError(result?.error || loginError || "Login failed.");
    }
  };

  const displayError = submitError || loginError;

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ backgroundColor: "var(--bg-app)" }}
    >
      <ThemeToggle />

      {/* ── Card ────────────────────────────────────────────────────── */}
      <div
        className="w-full max-w-sm rounded-card shadow-card border flex flex-col items-center gap-6 px-7 py-8"
        style={{
          background:   "var(--bg-card)",
          borderColor:  "var(--border-default)",
        }}
        role="main"
      >
        {/* Logo + Name */}
        <div className="flex flex-col items-center gap-2 text-center">
          <SGALogo />
          <h1
            className="font-bold leading-tight"
            style={{
              fontSize: "20px",
              color: "var(--text-primary)",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Shree Ganesh Automobile
          </h1>
          <p
            className="text-xs font-medium tracking-wide uppercase"
            style={{ color: "var(--text-secondary)" }}
          >
            Business Management
          </p>
        </div>

        {/* Session-invalidated banner */}
        {sessionInvalidated && (
          <div
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
            style={{
              background: "var(--status-partial-bg)",
              color:      "var(--status-partial-text)",
              border:     "1px solid var(--status-partial-text)",
            }}
            role="alert"
          >
            <AlertCircle size={15} className="flex-shrink-0" />
            <span>You were logged out by an administrator.</span>
          </div>
        )}

        {/* Error banner */}
        {displayError && !sessionInvalidated && (
          <div
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
            style={{
              background: "var(--status-unpaid-bg)",
              color:      "var(--status-unpaid-text)",
              border:     "1px solid var(--status-unpaid-text)",
            }}
            role="alert"
          >
            <AlertCircle size={15} className="flex-shrink-0" />
            <span>{displayError}</span>
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="w-full flex flex-col gap-4"
          noValidate
        >
          {/* Email / Username field */}
          <Input
            label="Email"
            type="email"
            placeholder="your@email.com"
            required
            leftIcon={<User size={16} />}
            error={errors.email?.message}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            {...register("email")}
          />

          {/* Password field */}
          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
            required
            leftIcon={<Lock size={16} />}
            error={errors.password?.message}
            autoComplete="current-password"
            {...register("password")}
          />

          {/* Sign In button */}
          <Button
            type="submit"
            variant="primary"
            fullWidth
            isLoading={isSubmitting || isLoading}
            className="mt-2"
            style={{ marginTop: "8px" }}
          >
            {isSubmitting || isLoading ? "Signing in…" : "Sign In"}
          </Button>
        </form>

        {/* Forgot password note */}
        <p
          className="text-xs text-center"
          style={{ color: "var(--text-placeholder)" }}
        >
          Forgot your password?{" "}
          <span style={{ color: "var(--color-primary)", fontWeight: 500 }}>
            Contact SuperAdmin
          </span>
        </p>
      </div>

      {/* Footer note */}
      <p
        className="mt-6 text-xs text-center max-w-xs"
        style={{ color: "var(--text-placeholder)" }}
      >
        Private system — unauthorised access is prohibited.
        <br />
        Accounts are created by SuperAdmin only.
      </p>
    </div>
  );
}