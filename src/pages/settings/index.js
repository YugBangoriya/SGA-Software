// src/pages/Settings/index.js
// Barrel exports for the entire Settings module.
// Import from here throughout the app instead of deep paths.

// Main page
export { default as SettingsPage } from "./SettingsPage";

// SuperAdmin
export { default as UserManagement } from "./UserManagement";
export { default as InvoiceDBControls } from "./InvoiceDBControls";
export { default as CustomFieldsManager } from "./CustomFieldsManager";

// Owner
export { default as BusinessInfo } from "./BusinessInfo";
export { GSTSettings, LowStockDefault, TermsAndConditions } from "./GSTAndTerms";
export { default as DropdownManager } from "./DropdownManager";
export { default as FollowUpTemplates } from "./FollowUpTemplates";

// User
export { ThemeToggle, LanguageToggle, ChangePassword } from "./UserPreferences";

// Shared UI primitives (re-exported so other modules can use them if needed)
export { SectionCard, FieldRow, Input, Textarea, Select, Button, SaveRow, ConfirmDialog, Badge, Skeleton } from "./SettingsUI";
