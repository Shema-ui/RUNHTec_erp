// Role-Based Access Control definitions for the RUNHTec Business Portal.
// Central source of truth so future modules can plug in permissions here
// without touching UI components.

export const ROLES = {
  super_admin: {
    key: 'super_admin',
    label: 'Super Administrator',
    description: 'Full control over the portal, users, settings and integrations.',
  },
  admin: {
    key: 'admin',
    label: 'Administrator',
    description: 'Operational access to clients, projects, quotations and reports.',
  },
};

export const PERMISSIONS = {
  super_admin: [
    'users.create',
    'users.delete',
    'users.suspend',
    'users.reset_password',
    'users.assign_role',
    'modules.view_all',
    'activity.view',
    'company.manage',
    'branches.manage',
    'integrations.manage',
  ],
  admin: [
    'clients.manage',
    'employees.manage',
    'dashboard.view',
    'crm.access',
    'quotations.manage',
    'invoices.manage',
    'projects.manage',
    'technicians.assign',
    'reports.view',
  ],
};

export function can(user, permission) {
  if (!user || !user.role) return false;
  return (PERMISSIONS[user.role] || []).includes(permission);
}

export function roleLabel(role) {
  return ROLES[role]?.label || role || 'Unknown';
}
