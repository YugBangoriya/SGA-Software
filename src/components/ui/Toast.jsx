// src/components/ui/Toast.jsx
import { useEffect, useState } from "react";
import { CheckCircle, XCircle, AlertCircle, X } from "lucide-react";

const ICONS = {
  success: <CheckCircle size={18} />,
  error:   <XCircle    size={18} />,
  info:    <AlertCircle size={18} />,
};

const COLORS = {
  success: { bg: "var(--status-paid-bg)",    text: "var(--status-paid-text)",    border: "var(--status-paid-text)" },
  error:   { bg: "var(--status-unpaid-bg)",  text: "var(--status-unpaid-text)",  border: "var(--status-unpaid-text)" },
  info:    { bg: "var(--status-emi-bg)",     text: "var(--status-emi-text)",     border: "var(--status-emi-text)" },
};

export function Toast({ message, type = "info", onClose, duration = 3500 }) {
  const [visible, setVisible] = useState(true);
  const c = COLORS[type] || COLORS.info;

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, duration);
    return () => clearTimeout(t);
  }, [duration, onClose]);

  return (
    <div
      role="alert"
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg max-w-sm text-sm font-medium
        transition-all duration-300 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
      style={{ background: c.bg, color: c.text, borderColor: c.border }}
    >
      <span className="flex-shrink-0">{ICONS[type]}</span>
      <span className="flex-1">{message}</span>
      <button
        onClick={() => { setVisible(false); setTimeout(onClose, 300); }}
        className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── Toast container + simple hook ─────────────────────────────────────────────
import { create } from "zustand";

const useToastStore = create((set) => ({
  toasts: [],
  show: (message, type = "info") => {
    const id = Date.now();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function ToastContainer() {
  const { toasts, remove } = useToastStore();
  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col gap-2 pointer-events-none md:bottom-6">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto toast-enter">
          <Toast
            message={t.message}
            type={t.type}
            onClose={() => remove(t.id)}
          />
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  return {
    success: (msg) => useToastStore.getState().show(msg, "success"),
    error:   (msg) => useToastStore.getState().show(msg, "error"),
    info:    (msg) => useToastStore.getState().show(msg, "info"),
  };
}

export default useToastStore;
