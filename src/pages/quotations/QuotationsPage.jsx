// src/pages/quotations/QuotationsPage.jsx
// Phase 5 — Quotation Module
// Top-level router component for the /quotations path segment.
// Enforces Owner + SuperAdmin only access at the component level
// (route-level RBAC guard in App.jsx is the primary enforcement).
//
// FIX (Phase 5 Bug): Previously used `{ userRole }` from useAuth(), but the
// hook returns `role` (not `userRole`). `userRole` was always `undefined`,
// making `canAccess` always `false`, silently redirecting every visit to
// `/dashboard` — which has no route and bounces to `/` via the catch-all.
// Fixed: destructure `isOwnerOrAbove` from useAuth() instead.
//
// FIX (Phase 5 Bug): Redirect target was `/dashboard` which does not exist
// as a route in App.jsx. The actual dashboard is at `/`. Fixed accordingly.

import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth }                 from "../../hooks/useAuth";
import QuotationList               from "./QuotationList";
import QuotationDetail             from "./QuotationDetail";
import CreateQuotationForm         from "./CreateQuotationForm";

export default function QuotationsPage() {
  // useAuth() returns { user, role, uid, displayName,
  //   isSuperAdmin, isOwner, isEmployee, isOwnerOrAbove, isEmployeeOrAbove }
  // There is NO `userRole` key — the previous code always got `undefined`.
  const { isOwnerOrAbove } = useAuth();

  // Belt-and-suspenders guard — the ProtectedRoute in App.jsx already handles
  // this, but we double-check here in case the component is ever rendered
  // outside protected routes.
  if (!isOwnerOrAbove) {
    // `/dashboard` has no route — the real dashboard lives at `/`.
    return <Navigate to="/" replace />;
  }

  return (
    <Routes>
      <Route index      element={<QuotationList />}        />
      <Route path="new" element={<CreateQuotationForm />}  />
      <Route path=":id" element={<QuotationDetail />}      />
      <Route path="*"   element={<Navigate to="/quotations" replace />} />
    </Routes>
  );
}