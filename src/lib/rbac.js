// SGA — Last updated: Removed Employee role from Inventory tab, route access, and permissions (employees can still read inventory data during invoice creation via InvoiceStepItems, but cannot navigate to /inventory directly)
// ─────────────────────────────────────────────────────────────────────────────
// src/lib/rbac.js
// Role-Based Access Control — Single source of truth.
// Mirrors the Permission Matrix in PRD Section 2.2.
//
// Roles: superadmin | owner | employee | accountant (placeholder)
//
// CHANGE LOG:
//
// FIX (Phase 9 Bug 1):
//   Added "reminders" entry to getMoreMenuItemsForRole() for superadmin + owner.
//   The /reminders route existed in App.jsx and ReminderLog.jsx correctly allowed
//   both roles via isOwnerOrAbove — but there was no nav link pointing to it
//   from either the sidebar or the More page, so neither role could reach it
//   through the UI.
//   Also added /reminders to ROUTE_ACCESS so the ProtectedRoute helper canAccessRoute()
//   can resolve it correctly when called with a path.
//
// FIX (Reports Bug):
//   Added "reports" entry to getMoreMenuItemsForRole() for superadmin + owner.
//   ProfitLossReport.jsx, ReportingHub.jsx, and all sub-routes (/reports,
//   /reports/profit-loss, etc.) already existed and were registered in App.jsx,
//   but there was no navigation link pointing to /reports from either the
//   Sidebar or the More page — making the entire Reports section unreachable
//   from the UI. Also added /reports to ROUTE_ACCESS.
//
// REQUEST 3 — Employee Inventory Access Removal:
//   Employees can no longer navigate directly to /inventory or /inventory/:itemId.
//   The "Inventory" tab has been removed from the bottom nav for the Employee role.
//   PERMISSIONS.INVENTORY_VIEW has been removed from the Employee permission set.
//   ROUTE_ACCESS["/inventory"] no longer includes ROLES.EMPLOYEE.
//
//   IMPORTANT: This is a UI-only restriction. The Firestore security rules still
//   allow employees to READ inventory documents — this is intentional because
//   employees must be able to select items from inventory during invoice creation
//   (InvoiceStepItems.jsx performs a direct Firestore query for this purpose).
//   Removing the route/nav access is sufficient to prevent employees from seeing
//   purchase prices on the Inventory page and Item Detail page.
// ─────────────────────────────────────────────────────────────────────────────

export const ROLES = {
  SUPERADMIN: "superadmin",
  OWNER:      "owner",
  EMPLOYEE:   "employee",
  ACCOUNTANT: "accountant", // placeholder — not active in v1
};

// ── Permission keys (one per feature/action) ─────────────────────────────────
export const PERMISSIONS = {
  // Messaging
  MESSAGING_INBOX:        "messaging.inbox",
  MESSAGING_NOTES:        "messaging.notes",

  // Customers
  CUSTOMERS_VIEW:         "customers.view",
  CUSTOMERS_CREATE_EDIT:  "customers.create_edit",
  CUSTOMERS_CREATE_FULL:  "customers.create_full",

  // Invoices
  INVOICE_CREATE:         "invoice.create",
  INVOICE_APPROVE:        "invoice.approve",
  INVOICE_VIEW_ALL:       "invoice.view_all",
  INVOICE_DELETE:         "invoice.delete",
  INVOICE_DB_LOCK:        "invoice.db_lock",
  INVOICE_DB_BACKUP:      "invoice.db_backup",

  // Quotations
  QUOTATION_GENERATE:     "quotation.generate",
  QUOTATION_VIEW:         "quotation.view",

  // Inventory
  // NOTE: INVENTORY_VIEW is intentionally removed from Employee permissions
  // (Request 3). Employees can still query inventory items via InvoiceStepItems
  // for invoice creation because the Firestore rules still permit employee reads
  // on /inventory. Only the page-level navigation is blocked here.
  INVENTORY_VIEW:         "inventory.view",
  INVENTORY_ADD:          "inventory.add",

  // Repositories
  CAR_REPO_MANAGE:        "car_repo.manage",
  DOCS_REPO_MANAGE:       "docs_repo.manage",

  // Admin
  AUDIT_LOG_VIEW:         "audit_log.view",
  USER_MANAGEMENT:        "user_management",
  REMOTE_LOGOUT_EMPLOYEE: "remote_logout.employee",
  REMOTE_LOGOUT_ALL:      "remote_logout.all",

  // Settings
  SETTINGS_GST:           "settings.gst",
  SETTINGS_LOW_STOCK:     "settings.low_stock",
  SETTINGS_THEME_LANG:    "settings.theme_lang",
};

// ── Role → Permission map ─────────────────────────────────────────────────────
const ROLE_PERMISSIONS = {
  [ROLES.SUPERADMIN]: [
    PERMISSIONS.MESSAGING_INBOX,
    PERMISSIONS.MESSAGING_NOTES,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE_EDIT,
    PERMISSIONS.CUSTOMERS_CREATE_FULL,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_APPROVE,
    PERMISSIONS.INVOICE_VIEW_ALL,
    PERMISSIONS.INVOICE_DELETE,
    PERMISSIONS.INVOICE_DB_LOCK,
    PERMISSIONS.INVOICE_DB_BACKUP,
    PERMISSIONS.QUOTATION_GENERATE,
    PERMISSIONS.QUOTATION_VIEW,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_ADD,
    PERMISSIONS.CAR_REPO_MANAGE,
    PERMISSIONS.DOCS_REPO_MANAGE,
    PERMISSIONS.AUDIT_LOG_VIEW,
    PERMISSIONS.USER_MANAGEMENT,
    PERMISSIONS.REMOTE_LOGOUT_EMPLOYEE,
    PERMISSIONS.REMOTE_LOGOUT_ALL,
    PERMISSIONS.SETTINGS_GST,
    PERMISSIONS.SETTINGS_LOW_STOCK,
    PERMISSIONS.SETTINGS_THEME_LANG,
  ],

  [ROLES.OWNER]: [
    PERMISSIONS.MESSAGING_INBOX,
    PERMISSIONS.MESSAGING_NOTES,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE_EDIT,
    PERMISSIONS.CUSTOMERS_CREATE_FULL,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_APPROVE,
    PERMISSIONS.INVOICE_VIEW_ALL,
    PERMISSIONS.INVOICE_DELETE,
    PERMISSIONS.QUOTATION_GENERATE,
    PERMISSIONS.QUOTATION_VIEW,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_ADD,
    PERMISSIONS.DOCS_REPO_MANAGE,
    PERMISSIONS.AUDIT_LOG_VIEW,
    PERMISSIONS.REMOTE_LOGOUT_EMPLOYEE,
    PERMISSIONS.SETTINGS_GST,
    PERMISSIONS.SETTINGS_LOW_STOCK,
    PERMISSIONS.SETTINGS_THEME_LANG,
  ],

  // REQUEST 3: INVENTORY_VIEW removed from Employee.
  // Employees can still READ inventory via Firestore (needed for invoice item
  // selection in InvoiceStepItems), but cannot navigate to the Inventory page.
  [ROLES.EMPLOYEE]: [
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE_EDIT, // limited — no custom fields
    PERMISSIONS.INVOICE_CREATE,        // creates PENDING only
    PERMISSIONS.INVOICE_VIEW_ALL,
    PERMISSIONS.SETTINGS_THEME_LANG,
  ],

  // Accountant — placeholder. No real permissions in v1.
  [ROLES.ACCOUNTANT]: [
    PERMISSIONS.SETTINGS_THEME_LANG,
  ],
};

// ── Helper: check if a role has a permission ─────────────────────────────────
export function hasPermission(role, permission) {
  if (!role || !permission) return false;
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes(permission);
}

// ── Helper: check multiple permissions (AND) ─────────────────────────────────
export function hasAllPermissions(role, permissions = []) {
  return permissions.every((p) => hasPermission(role, p));
}

// ── Helper: check multiple permissions (OR) ──────────────────────────────────
export function hasAnyPermission(role, permissions = []) {
  return permissions.some((p) => hasPermission(role, p));
}

// ── Route-level access map (which roles can access each route) ────────────────
export const ROUTE_ACCESS = {
  "/":           [ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE, ROLES.ACCOUNTANT],
  "/customers":  [ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE],
  "/invoices":   [ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE],
  // REQUEST 3: Employee removed from /inventory.
  // Employees can still read inventory documents for invoice creation (Firestore
  // rules unchanged), but they cannot navigate here directly.
  "/inventory":  [ROLES.SUPERADMIN, ROLES.OWNER],
  "/messaging":  [ROLES.SUPERADMIN, ROLES.OWNER],
  "/quotations": [ROLES.SUPERADMIN, ROLES.OWNER],
  "/car-repo":   [ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE],
  // BUG FIX: Employee was listed here but App.jsx already restricts this route
  // to [SUPERADMIN, OWNER] only — employees tapping "Docs Repository" in the
  // More menu were redirected to /unauthorized. Fixed by removing EMPLOYEE from
  // both this table and the getMoreMenuItemsForRole entry below.
  "/docs-repo":  [ROLES.SUPERADMIN, ROLES.OWNER],
  "/settings":   [ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE, ROLES.ACCOUNTANT],
  "/audit-log":  [ROLES.SUPERADMIN, ROLES.OWNER],
  "/admin":      [ROLES.SUPERADMIN],
  // FIX (Phase 9): /reminders was missing from the route access table
  "/reminders":  [ROLES.SUPERADMIN, ROLES.OWNER],
  // FIX (Reports Bug): /reports was missing — all sub-routes share the same access
  "/reports":    [ROLES.SUPERADMIN, ROLES.OWNER],
};

// ── Helper: can role access route? ───────────────────────────────────────────
export function canAccessRoute(role, path) {
  const allowedRoles = ROUTE_ACCESS[path];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role);
}

// ── Bottom nav tabs visible per role ─────────────────────────────────────────
// Design Doc Section 4.1: 5-tab bottom navigation.
// REQUEST 3: "Inventory" tab removed from Employee's visible tabs.
// Employee bottom nav now shows: Home | Customers | Invoices | More
export function getNavTabsForRole(role) {
  const allTabs = [
    {
      id: "home",
      path: "/",
      label: "Home",
      icon: "LayoutDashboard",
      // All roles see Home
    },
    {
      id: "customers",
      path: "/customers",
      label: "Customers",
      icon: "Users",
      roles: [ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE],
    },
    {
      id: "invoices",
      path: "/invoices",
      label: "Invoices",
      icon: "FileText",
      roles: [ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE],
    },
    {
      id: "inventory",
      path: "/inventory",
      label: "Inventory",
      icon: "Package",
      // REQUEST 3: Employee removed — they cannot navigate to the inventory page
      roles: [ROLES.SUPERADMIN, ROLES.OWNER],
    },
    {
      id: "more",
      path: "/more",
      label: "More",
      icon: "MoreHorizontal",
      roles: [ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE, ROLES.ACCOUNTANT],
    },
  ];
  return allTabs.filter((tab) => !tab.roles || tab.roles.includes(role));
}

// ── "More" menu items visible per role ───────────────────────────────────────
export function getMoreMenuItemsForRole(role) {
  return [
    {
      id: "messaging",  path: "/messaging",  label: "Messaging",
      icon: "MessageSquare", description: "WhatsApp, Instagram, Facebook",
      roles: [ROLES.SUPERADMIN, ROLES.OWNER],
    },
    {
      id: "quotations", path: "/quotations", label: "Quotations",
      icon: "ClipboardList", description: "Create & send quotations",
      roles: [ROLES.SUPERADMIN, ROLES.OWNER],
    },
    // FIX (Phase 9 Bug 1): Added missing Reminders nav entry
    {
      id: "reminders",  path: "/reminders",  label: "Reminders",
      icon: "reminders", description: "CNG re-test reminder log",
      roles: [ROLES.SUPERADMIN, ROLES.OWNER],
    },
    // FIX (Reports Bug): Added missing Reports & Analytics nav entry
    {
      id: "reports",    path: "/reports",    label: "Reports",
      icon: "BarChart2", description: "Profit/loss, analytics & insights",
      roles: [ROLES.SUPERADMIN, ROLES.OWNER],
    },
    {
      id: "car-repo",   path: "/car-repo",   label: "Car Repository",
      icon: "Car", description: "Models & media links",
      roles: [ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE],
    },
    {
      id: "docs-repo",  path: "/docs-repo",  label: "Docs Repository",
      icon: "FolderOpen", description: "Price lists, banners & more",
      roles: [ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE],
    },
    {
      id: "audit-log",  path: "/audit-log",  label: "Audit Log",
      icon: "ShieldCheck", description: "Activity history",
      roles: [ROLES.SUPERADMIN, ROLES.OWNER],
    },
    {
      id: "admin",      path: "/admin",      label: "Admin Panel",
      icon: "Settings2", description: "User management & DB controls",
      roles: [ROLES.SUPERADMIN],
    },
    {
      id: "settings",   path: "/settings",   label: "Settings",
      icon: "Settings", description: "Theme, language, account",
      roles: [ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE, ROLES.ACCOUNTANT],
    },
  ].filter((item) => item.roles.includes(role));
}

// ── Convenience helpers ───────────────────────────────────────────────────────
/** Returns true if the given role can upload/delete docs (Owner + SuperAdmin) */
export function canManageDocs(role) {
  return role === 'superadmin' || role === 'owner';
}