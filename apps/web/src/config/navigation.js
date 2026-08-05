import {
  LayoutDashboard,
  Contact,
  Building2,
  FileQuestion,
  FileText,
  ClipboardList,
  FolderKanban,
  Wrench,
  ReceiptText,
  CreditCard,
  Users,
  BarChart3,
  FolderArchive,
  Settings,
  ShieldCheck,
  ScrollText,
} from 'lucide-react';

// Primary operating modules. `to` is null for placeholders that are not yet
// wired to a working module (navigation-only per current scope).
export const MODULE_NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { key: 'crm', label: 'CRM', icon: Contact, to: '/crm' },
  { key: 'clients', label: 'Clients', icon: Building2, to: '/crm/clients' },
  { key: 'rfq', label: 'Request for Quotations', icon: FileQuestion, to: null },
  { key: 'quotations', label: 'Quotations', icon: FileText, to: null },
  { key: 'work_orders', label: 'Work Orders', icon: ClipboardList, to: null },
  { key: 'projects', label: 'Projects', icon: FolderKanban, to: null },
  { key: 'maintenance', label: 'Maintenance', icon: Wrench, to: null },
  { key: 'invoices', label: 'Invoices', icon: ReceiptText, to: '/invoices' },
  { key: 'payments', label: 'Payments', icon: CreditCard, to: null },
  { key: 'employees', label: 'Employees', icon: Users, to: null },
  { key: 'reports', label: 'Reports', icon: BarChart3, to: null },
  { key: 'documents', label: 'Documents', icon: FolderArchive, to: null },
  { key: 'settings', label: 'Settings', icon: Settings, to: '/settings' },
];

// Administration modules — restricted to the Super Administrator.
export const ADMIN_NAV = [
  { key: 'users', label: 'User Management', icon: ShieldCheck, to: '/users', roles: ['super_admin'] },
  { key: 'activity', label: 'Activity Logs', icon: ScrollText, to: '/activity', roles: ['super_admin'] },
];
