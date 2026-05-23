// src/pages/quotations/QuotationsPage.jsx
// Phase 5 — Quotation Module
// Top-level router component for the /quotations path segment.
// Enforces Owner + SuperAdmin only access at the component level
// (route-level RBAC guard in App.jsx is the primary enforcement).

import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import QuotationList   from "./QuotationList";
import QuotationDetail from "./QuotationDetail";
import CreateQuotationForm from "./CreateQuotationForm";

export default function QuotationsPage() {
  const { userRole } = useAuth();

  // Belt-and-suspenders guard — the route guard in App.jsx already handles this,
  // but we double-check here in case component is ever rendered outside protected routes.
  const canAccess = userRole === "owner" || userRole === "superadmin";

  if (!canAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Routes>
      <Route index             element={<QuotationList />} />
      <Route path="new"        element={<CreateQuotationForm />} />
      <Route path=":id"        element={<QuotationDetail />} />
      <Route path="*"          element={<Navigate to="/quotations" replace />} />
    </Routes>
  );
}
