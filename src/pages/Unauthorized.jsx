// src/pages/Unauthorized.jsx
import { useNavigate } from "react-router-dom";
import { ShieldOff }   from "lucide-react";
import Button          from "@/components/ui/Button";

export default function Unauthorized() {
  const navigate = useNavigate();
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
      style={{ background: "var(--bg-app)" }}
    >
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
        style={{ background: "var(--status-unpaid-bg)", color: "var(--status-unpaid-text)" }}
      >
        <ShieldOff size={36} />
      </div>
      <h1 className="font-bold mb-2" style={{ fontSize: "22px", color: "var(--text-primary)" }}>
        Access Denied
      </h1>
      <p className="mb-6 max-w-xs" style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
        You don't have permission to view this page.
        Contact your Owner or SuperAdmin if you need access.
      </p>
      <Button onClick={() => navigate(-1)} variant="secondary">
        Go Back
      </Button>
    </div>
  );
}
