import React        from "react";
import ReactDOM     from "react-dom/client";
import "@/styles/globals.css";
import "@/lib/i18n";
import App          from "./App";
import useThemeStore from "@/store/themeStore";

// Apply saved theme to <html> before first paint — prevents flash
useThemeStore.getState().initTheme();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
