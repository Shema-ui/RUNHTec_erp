export const PROJECT_STATUSES = [
  { value: 'planning', label: 'Planning', cls: 'bg-slate-100 text-slate-600' },
  { value: 'scheduled', label: 'Scheduled', cls: 'bg-blue-100 text-blue-700' },
  { value: 'in_progress', label: 'In progress', cls: 'bg-amber-100 text-amber-700' },
  { value: 'on_hold', label: 'On hold', cls: 'bg-violet-100 text-violet-700' },
  { value: 'done', label: 'Completed', cls: 'bg-emerald-100 text-emerald-700' },
  { value: 'cancelled', label: 'Cancelled', cls: 'bg-rose-100 text-rose-700' },
];

export const PRIORITIES = [
  { value: 'low', label: 'Low', cls: 'text-slate-500' },
  { value: 'medium', label: 'Medium', cls: 'text-blue-600' },
  { value: 'high', label: 'High', cls: 'text-amber-600' },
  { value: 'urgent', label: 'Urgent', cls: 'text-rose-600' },
];

// RUNHTec's service lines (same as the public website)
export const SERVICE_CATEGORIES = [
  { value: 'construction', label: 'Construction & Civil Works' },
  { value: 'electrical', label: 'Electrical Installations' },
  { value: 'solar', label: 'Solar PV & Hybrid Systems' },
  { value: 'generator', label: 'Standby Generators & Backup Power' },
  { value: 'hvac', label: 'HVAC, Air Conditioning & Chillers' },
  { value: 'refrigeration', label: 'Cold Rooms & Refrigeration' },
  { value: 'borehole', label: 'Borehole Drilling & Water' },
  { value: 'cctv', label: 'CCTV & Security Systems' },
  { value: 'networking', label: 'Networking & Internet' },
  { value: 'maintenance', label: 'Maintenance Contract Work' },
  { value: 'other', label: 'Other' },
];

const find = (list, v) => list.find((x) => x.value === v);
export const projectStatusInfo = (v) => find(PROJECT_STATUSES, v) || PROJECT_STATUSES[1];
export const priorityInfo = (v) => find(PRIORITIES, v) || PRIORITIES[1];
export const serviceLabel = (v) => find(SERVICE_CATEGORIES, v)?.label || v || '';
