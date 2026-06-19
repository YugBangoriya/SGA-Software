// SGA — Last updated: Added /quotations/manage route pointing to new ManageQuotations page
// (price table management for BS4/BS6-4INJ/BS6-8INJ quotation categories).
// src/pages/quotations/QuotationsPage.jsx
// Phase 5 — Quotation Module

import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth }          from "../../hooks/useAuth";
import QuotationList        from "./QuotationList";
import QuotationDetail      from "./QuotationDetail";
import CreateQuotationForm  from "./CreateQuotationForm";
import ManageQuotations     from "./ManageQuotations";

export default function QuotationsPage() {
  const { isOwnerOrAbove } = useAuth();

  if (!isOwnerOrAbove) {
    return <Navigate to="/" replace />;
  }

  return (
    <Routes>
      <Route index        element={<QuotationList />}           />
      <Route path="new"   element={<CreateQuotationForm />}     />
      <Route path="manage" element={<ManageQuotations />}       />
      <Route path=":id"   element={<QuotationDetail />}         />
      <Route path="*"     element={<Navigate to="/quotations" replace />} />
    </Routes>
  );
}