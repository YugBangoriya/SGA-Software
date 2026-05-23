// ─────────────────────────────────────────────────────────────────────────────
// src/lib/rbac.js
// Role-Based Access Control — Single source of truth.
// Mirrors the Permission Matrix in PRD Section 2.2.
//
// Roles: superadmin | owner | employee | accountant (placeholder)
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

  [ROLES.EMPLOYEE]: [
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE_EDIT, // limited — no custom fields
    PERMISSIONS.INVOICE_CREATE,         // creates PENDING only
    PERMISSIONS.INVOICE_VIEW_ALL,
    PERMISSIONS.INVENTORY_VIEW,
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
  "/inventory":  [ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE],
  "/messaging":  [ROLES.SUPERADMIN, ROLES.OWNER],
  "/quotations": [ROLES.SUPERADMIN, ROLES.OWNER],
  "/car-repo":   [ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE],
  "/docs-repo":  [ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE],
  "/settings":   [ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE, ROLES.ACCOUNTANT],
  "/audit-log":  [ROLES.SUPERADMIN, ROLES.OWNER],
  "/admin":      [ROLES.SUPERADMIN],
};

// ── Helper: can role access route? ───────────────────────────────────────────
export function canAccessRoute(role, path) {
  const allowedRoles = ROUTE_ACCESS[path];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role);
}

// ── Bottom nav tabs visible per role ─────────────────────────────────────────
// Design Doc Section 4.1: 5-tab bottom navigation
export function getNavTabsForRole(role) {
  const allTabs = [
    { id: "home",      path: "/",          label: "Home",      icon: "LayoutDashboard" },
    { id: "customers", path: "/customers", label: "Customers", icon: "Users",
      roles: [ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE] },
    { id: "invoices",  path: "/invoices",  label: "Invoices",  icon: "FileText",
      roles: [ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE] },
    { id: "inventory", path: "/inventory", label: "Inventory", icon: "Package",
      roles: [ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE] },
    { id: "more",      path: "/more",      label: "More",      icon: "MoreHorizontal",
      roles: [ROLES.SUPERADMIN, ROLES.OWNER, ROLES.EMPLOYEE, ROLES.ACCOUNTANT] },
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