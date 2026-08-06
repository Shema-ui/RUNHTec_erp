// Role-Based Access Control definitions for the RUNHTec Business Portal.
// Central source of truth for both the sidebar (which modules a role can
// see) and route guards (which modules a role can actually open) — one
// definition, used in two places, instead of two lists that can drift.
//
// Actual data-level enforcement (who can create/edit/delete what) lives in
// the PocketBase collection rules (see pb_migrations/1790000005_rbac_
// collection_rules.js). This file controls UI visibility only — it is not
// itself a security boundary, the backend rules are.

export const ROLES = {
  super_admin: {
    key: 'super_admin',
    label: 'Super Administrator',
    description: 'Full control over the portal, users, settings and all modules.',
  },
  sales: {
    key: 'sales',
    label: 'Sales',
    description: 'Manages leads, clients, RFQs and quotations.',
  },
  project_manager: {
    key: 'project_manager',
    label: 'Project Manager',
    description: 'Manages projects, tasks, maintenance and project documents.',
  },
  accountant: {
    key: 'accountant',
    label: 'Accountant',
    description: 'Manages invoices, payments and financial reports.',
  },
  technician: {
    key: 'technician',
    label: 'Technician',
    description: 'Handles assigned tasks, maintenance jobs and work updates.',
  },
};

// Module key -> roles allowed to see/open it. super_admin is implied for
// every module (checked separately in canAccessModule) so it doesn't need
// to be repeated in every array below.
export const MODULE_ACCESS = {
  dashboard: ['sales', 'project_manager', 'accountant', 'technician'],
  crm: ['sales'],
  clients: ['sales'],
  rfq: ['sales'],
  quotations: ['sales'],
  projects: ['project_manager', 'technician'],
  maintenance: ['project_manager', 'technician'],
  invoices: ['accountant'],
  payments: ['accountant'],
  reports: ['accountant'],
  employees: ['project_manager'],
  documents: ['project_manager', 'technician'],
  notifications: ['sales', 'project_manager', 'accountant', 'technician'],
  settings: [],
};

export function canAccessModule(user, moduleKey) {
  if (!user || !user.role) return false;
  if (user.role === 'super_admin') return true;
  const allowed = MODULE_ACCESS[moduleKey];
  return Array.isArray(allowed) && allowed.includes(user.role);
}

export function roleLabel(role) {
  return ROLES[role]?.label || role || 'Unknown';
}
