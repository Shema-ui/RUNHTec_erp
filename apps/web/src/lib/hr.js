// HR definitions. RUNHTec works with independent contractors engaged per
// project — not salaried employees. Every engagement is its own contract
// (project_assignments) with an agreed scope, fee and dates.

export const ENGAGEMENT_MODEL =
  'RUNHTec engages professionals as independent contractors on a per-project basis. ' +
  'Each project is a separate contract with an agreed scope of work, fee and dates. ' +
  'Contractors are not employees of RUNHTec Contractors Ltd: there is no salary, and engagement ' +
  'on one project does not guarantee further work.';

export const DEPARTMENTS = [
  { value: 'administration', label: 'Administration & Management', short: 'Administration' },
  { value: 'finance', label: 'Finance & Accounts', short: 'Finance' },
  { value: 'hr', label: 'Human Resources', short: 'HR' },
  { value: 'sales', label: 'Sales & Business Development', short: 'Sales' },
  { value: 'procurement', label: 'Procurement & Stores', short: 'Procurement' },
  { value: 'projects', label: 'Projects & Engineering', short: 'Projects' },
  { value: 'technical', label: 'Technical & Field Services', short: 'Technicians' },
  { value: 'inspection', label: 'Inspection, Quality & HSE', short: 'Inspection' },
  { value: 'ict', label: 'ICT & Systems', short: 'ICT' },
];

// Main skill / trade, aligned with RUNHTec's services.
export const TRADES = [
  { value: 'construction', label: 'Construction & Civil Works', dept: 'technical' },
  { value: 'mason', label: 'Masonry & Finishing', dept: 'technical' },
  { value: 'electrical', label: 'Electrical Installation', dept: 'technical' },
  { value: 'solar', label: 'Solar PV & Hybrid Systems', dept: 'technical' },
  { value: 'generator', label: 'Generators & Backup Power', dept: 'technical' },
  { value: 'hvac', label: 'HVAC, Air Conditioning & Chillers', dept: 'technical' },
  { value: 'refrigeration', label: 'Cold Rooms & Refrigeration', dept: 'technical' },
  { value: 'borehole', label: 'Borehole Drilling & Water', dept: 'technical' },
  { value: 'plumbing', label: 'Plumbing', dept: 'technical' },
  { value: 'cctv', label: 'CCTV & Security Systems', dept: 'technical' },
  { value: 'networking', label: 'Networking & Internet', dept: 'technical' },
  { value: 'welding', label: 'Welding & Metal Fabrication', dept: 'technical' },
  { value: 'carpentry', label: 'Carpentry & Joinery', dept: 'technical' },
  { value: 'painting', label: 'Painting & Decoration', dept: 'technical' },
  { value: 'driver', label: 'Driver / Machine Operator', dept: 'technical' },
  { value: 'labour', label: 'General Labour / Helper', dept: 'technical' },
  { value: 'site_engineer', label: 'Site Engineer / Supervisor', dept: 'projects' },
  { value: 'project_manager', label: 'Project Manager', dept: 'projects' },
  { value: 'quantity_surveyor', label: 'Quantity Surveyor', dept: 'projects' },
  { value: 'draughtsman', label: 'Designer / Draughtsman (CAD)', dept: 'projects' },
  { value: 'inspector', label: 'Inspector / QA-QC', dept: 'inspection' },
  { value: 'hse', label: 'Health, Safety & Environment Officer', dept: 'inspection' },
  { value: 'accountant', label: 'Accountant / Finance', dept: 'finance' },
  { value: 'sales', label: 'Sales / Business Development', dept: 'sales' },
  { value: 'procurement', label: 'Procurement / Storekeeper', dept: 'procurement' },
  { value: 'admin', label: 'Administration / Secretary', dept: 'administration' },
  { value: 'hr', label: 'Human Resources', dept: 'hr' },
  { value: 'ict', label: 'ICT / Systems Support', dept: 'ict' },
  { value: 'other', label: 'Other', dept: 'technical' },
];

export const RATE_UNITS = [
  { value: 'per_day', label: 'per day' },
  { value: 'per_hour', label: 'per hour' },
  { value: 'per_project', label: 'per project' },
  { value: 'per_month', label: 'per month' },
];

export const CONTRACTOR_STATUSES = [
  { value: 'available', label: 'Available', cls: 'bg-emerald-100 text-emerald-700' },
  { value: 'engaged', label: 'On a project', cls: 'bg-blue-100 text-blue-700' },
  { value: 'unavailable', label: 'Unavailable', cls: 'bg-amber-100 text-amber-700' },
  { value: 'inactive', label: 'Inactive', cls: 'bg-slate-100 text-slate-600' },
  { value: 'do_not_engage', label: 'Do not engage', cls: 'bg-rose-100 text-rose-700' },
];

export const APPLICATION_STATUSES = [
  { value: 'new', label: 'New', cls: 'bg-blue-100 text-blue-700' },
  { value: 'shortlisted', label: 'Shortlisted', cls: 'bg-violet-100 text-violet-700' },
  { value: 'interview', label: 'Interview / test', cls: 'bg-amber-100 text-amber-700' },
  { value: 'on_hold', label: 'On hold', cls: 'bg-slate-100 text-slate-600' },
  { value: 'approved', label: 'Approved', cls: 'bg-emerald-100 text-emerald-700' },
  { value: 'rejected', label: 'Not selected', cls: 'bg-rose-100 text-rose-700' },
];

export const ASSIGNMENT_STATUSES = [
  { value: 'offered', label: 'Offered', cls: 'bg-slate-100 text-slate-600' },
  { value: 'accepted', label: 'Accepted', cls: 'bg-blue-100 text-blue-700' },
  { value: 'in_progress', label: 'On site', cls: 'bg-amber-100 text-amber-700' },
  { value: 'completed', label: 'Completed', cls: 'bg-emerald-100 text-emerald-700' },
  { value: 'cancelled', label: 'Cancelled', cls: 'bg-rose-100 text-rose-700' },
];

export const PAYMENT_BASIS = [
  { value: 'fixed', label: 'Fixed fee for the project' },
  { value: 'daily', label: 'Daily rate' },
  { value: 'hourly', label: 'Hourly rate' },
  { value: 'milestone', label: 'Per milestone' },
];

export const CONTRACTOR_PAYMENT_STATUSES = [
  { value: 'unpaid', label: 'Unpaid', cls: 'bg-rose-100 text-rose-700' },
  { value: 'partially_paid', label: 'Partly paid', cls: 'bg-amber-100 text-amber-700' },
  { value: 'paid', label: 'Paid', cls: 'bg-emerald-100 text-emerald-700' },
];

const find = (list, v) => list.find((x) => x.value === v);
export const deptLabel = (v) => find(DEPARTMENTS, v)?.label || v || '—';
export const deptShort = (v) => find(DEPARTMENTS, v)?.short || v || '—';
export const tradeLabel = (v) => find(TRADES, v)?.label || v || '—';
export const rateUnitLabel = (v) => find(RATE_UNITS, v)?.label || '';
export const statusInfo = (list, v) => find(list, v) || { value: v, label: v || '—', cls: 'bg-slate-100 text-slate-600' };
