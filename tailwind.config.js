/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ── Primary brand ───────────────────────────────────────────
        burgundy: {
          DEFAULT: "#661F1F",
          medium:  "#8B3A3A",
          light:   "#F5E6E6",
        },
        // ── Light mode surfaces ─────────────────────────────────────
        warmgray:  "#CDCBC9",
        offwhite:  "#F5F0EE",
        taupe:     "#E8E2DF",
        // ── Dark mode surfaces ──────────────────────────────────────
        darkbg:    "#1A1A1A",
        darkcard:  "#2A2A2A",
        darkelev:  "#3A3A3A",
        // ── Text ───────────────────────────────────────────────────
        nearblack: "#222222",
        midgray:   "#666666",
        // ── Status ─────────────────────────────────────────────────
        statusgreen: "#1A7A1A",
        statusamber: "#CC6600",
        statusred:   "#CC0000",
        statusblue:  "#0055CC",
      },
      fontFamily: {
        sans: ["'DM Sans'", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card:  "12px",
        btn:   "8px",
        badge: "9999px",
      },
      boxShadow: {
        card:        "0 2px 8px rgba(0,0,0,0.08)",
        "card-hover":"0 6px 24px rgba(102,31,31,0.12)",
        nav:         "0 -1px 12px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};

