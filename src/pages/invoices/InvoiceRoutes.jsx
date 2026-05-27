// SGA — Last updated: Added /invoices/return/new route for CreateReturnInvoice
// ============================================================
// InvoiceRoutes.jsx — Phase 4 Route Integration
// Shree Ganesh Automobile
// ============================================================
// HOW TO INTEGRATE:
// In your main App.jsx (from Phase 1), import and add these
// routes inside your existing <Routes> block.
// Protected routes already wrap role checks via your Phase 1
// ProtectedRoute component.
// ============================================================

import { Routes, Route, Navigate } from "react-router-dom";
import InvoiceList from "./InvoiceList";
import CreateInvoice from "./CreateInvoice";
import CreateReturnInvoice from "./CreateReturnInvoice";
import InvoiceDetail from "./InvoiceDetail";
import PendingPayments from "./PendingPayments";

// ── Route definitions to ADD inside your <Routes> block ───
// Copy these <Route> elements into your App.jsx Routes block:
//
// <Route path="/invoices" element={
//   <ProtectedRoute allowedRoles={["superadmin", "owner", "employee"]}>
//     <InvoiceList />
//   </ProtectedRoute>
// } />
//
// <Route path="/invoices/create" element={
//   <ProtectedRoute allowedRoles={["superadmin", "owner", "employee"]}>
//     <CreateInvoice />
//   </ProtectedRoute>
// } />
//
// <Route path="/invoices/:id" element={
//   <ProtectedRoute allowedRoles={["superadmin", "owner", "employee"]}>
//     <InvoiceDetail />
//   </ProtectedRoute>
// } />
//
// <Route path="/invoices/pending-payments" element={
//   <ProtectedRoute allowedRoles={["superadmin", "owner"]}>
//     <PendingPayments />
//   </ProtectedRoute>
// } />

// ── Bottom Nav Tab 3 update (from Phase 1 BottomNav) ──────
// Your existing BottomNav "Invoices" tab should navigate to:
// path="/invoices"
// icon: <Receipt size={22} /> from lucide-react
// This tab is already present in your Phase 1 bottom nav.
// No changes needed to bottom nav — just ensure the path matches.

// ── This file is for documentation — export a convenience ─
// component that renders Phase 4 sub-routes standalone if needed
export default function InvoiceRoutes() {
  return (
    <Routes>
      <Route index element={<InvoiceList />} />
      <Route path="create" element={<CreateInvoice />} />
      <Route path="pending-payments" element={<PendingPayments />} />
      <Route path=":id" element={<InvoiceDetail />} />
      <Route path="*" element={<Navigate to="/invoices" replace />} />
    </Routes>
  );
}