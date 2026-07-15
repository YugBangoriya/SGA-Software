// SGA — Last updated: Added /quotations/:id/edit route for EditQuotationForm (Owner/SuperAdmin only).
// Prior: Added /quotations/manage route for ManageQuotations.
// src/pages/quotations/QuotationsPage.jsx

import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth }          from "../../hooks/useAuth";
import QuotationList        from "./QuotationList";
import QuotationDetail      from "./QuotationDetail";
import CreateQuotationForm  from "./CreateQuotationForm";
import ManageQuotations     from "./ManageQuotations";
import EditQuotationForm    from "./EditQuotationForm";

export default function QuotationsPage() {
  const { isOwnerOrAbove } = useAuth();

  if (!isOwnerOrAbove) {
    return <Navigate to="/" replace />;
  }

  return (
    <Routes>
      <Route index          element={<QuotationList />}           />
      <Route path="new"     element={<CreateQuotationForm />}     />
      <Route path="manage"  element={<ManageQuotations />}        />
      <Route path=":id/edit" element={<EditQuotationForm />}      />
      <Route path=":id"     element={<QuotationDetail />}         />
      <Route path="*"       element={<Navigate to="/quotations" replace />} />
    </Routes>
  );
}