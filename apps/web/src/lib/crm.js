export const CLIENT_STATUSES = [
  { value: 'lead', label: 'Lead', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'active', label: 'Active', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'inactive', label: 'Inactive', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  { value: 'suspended', label: 'Suspended', cls: 'bg-red-100 text-red-600 border-red-200' },
];

export const PIPELINE_STAGES = [
  { value: 'new_lead', label: 'New Lead', color: '#64748b' },
  { value: 'contacted', label: 'Contacted', color: '#6366f1' },
  { value: 'meeting_scheduled', label: 'Meeting Scheduled', color: '#8b5cf6' },
  { value: 'site_visit', label: 'Site Visit', color: '#f59e0b' },
  { value: 'proposal_prep', label: 'Proposal Preparation', color: '#f97316' },
  { value: 'quotation_sent', label: 'Quotation Sent', color: '#3b82f6' },
  { value: 'negotiation', label: 'Negotiation', color: '#ec4899' },
  { value: 'won', label: 'Won', color: '#10b981' },
  { value: 'lost', label: 'Lost', color: '#ef4444' },
];

export const CLIENT_CATEGORIES = [
  { value: 'government', label: 'Government' },
  { value: 'ngo', label: 'NGO' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'residential', label: 'Residential' },
  { value: 'educational', label: 'Educational' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'mining', label: 'Mining' },
  { value: 'other', label: 'Other' },
];

export const CLIENT_SERVICES = [
  { value: 'electrical', label: 'Electrical Installations' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'solar', label: 'Solar Systems' },
  { value: 'borehole', label: 'Borehole Drilling' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'fire_protection', label: 'Fire Protection' },
  { value: 'mechanical', label: 'Mechanical Works' },
  { value: 'civil', label: 'Civil Works' },
  { value: 'preventive_maintenance', label: 'Preventive Maintenance' },
  { value: 'corrective_maintenance', label: 'Corrective Maintenance' },
  { value: 'construction', label: 'Construction' },
  { value: 'ict', label: 'ICT Infrastructure' },
  { value: 'energy_audits', label: 'Energy Audits' },
  { value: 'generator', label: 'Generator Installations' },
  { value: 'other', label: 'Other' },
];

export const ACTIVITY_TYPES = [
  { value: 'call', label: 'Call', icon: 'Phone' },
  { value: 'email', label: 'Email', icon: 'Mail' },
  { value: 'meeting', label: 'Meeting', icon: 'Users' },
  { value: 'site_visit', label: 'Site Visit', icon: 'MapPin' },
  { value: 'rfq', label: 'RFQ', icon: 'FileQuestion' },
  { value: 'quotation', label: 'Quotation', icon: 'FileText' },
  { value: 'work_order', label: 'Work Order', icon: 'ClipboardList' },
  { value: 'project', label: 'Project', icon: 'FolderKanban' },
  { value: 'maintenance', label: 'Maintenance', icon: 'Wrench' },
  { value: 'invoice', label: 'Invoice', icon: 'ReceiptText' },
  { value: 'payment', label: 'Payment', icon: 'CreditCard' },
  { value: 'note', label: 'Note', icon: 'StickyNote' },
  { value: 'attachment', label: 'Attachment', icon: 'Paperclip' },
  { value: 'other', label: 'Other', icon: 'Circle' },
];

export const FOLLOWUP_TYPES = [
  { value: 'call', label: 'Phone Call' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'site_visit', label: 'Site Visit' },
  { value: 'email', label: 'Email' },
  { value: 'task', label: 'Reminder Task' },
];

export const EQUIPMENT_CATEGORIES = [
  { value: 'hvac', label: 'HVAC' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'solar', label: 'Solar' },
  { value: 'borehole', label: 'Borehole' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'fire', label: 'Fire Protection' },
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'generator', label: 'Generator' },
  { value: 'ict', label: 'ICT' },
  { value: 'civil', label: 'Civil' },
  { value: 'other', label: 'Other' },
];

export const EQUIPMENT_CONDITIONS = [
  { value: 'excellent', label: 'Excellent', cls: 'text-emerald-600' },
  { value: 'good', label: 'Good', cls: 'text-blue-600' },
  { value: 'fair', label: 'Fair', cls: 'text-amber-600' },
  { value: 'poor', label: 'Poor', cls: 'text-orange-600' },
  { value: 'critical', label: 'Critical', cls: 'text-red-600' },
];

export const EQUIPMENT_STATUSES = [
  { value: 'operational', label: 'Operational', cls: 'bg-emerald-100 text-emerald-700' },
  { value: 'under_maintenance', label: 'Under Maintenance', cls: 'bg-amber-100 text-amber-700' },
  { value: 'faulty', label: 'Faulty', cls: 'bg-red-100 text-red-600' },
  { value: 'decommissioned', label: 'Decommissioned', cls: 'bg-slate-100 text-slate-500' },
];

export const DOC_TYPES = [
  { value: 'rfq', label: 'RFQ' },
  { value: 'boq', label: 'BOQ' },
  { value: 'contract', label: 'Contract' },
  { value: 'drawing', label: 'Drawing' },
  { value: 'photo', label: 'Photo' },
  { value: 'purchase_order', label: 'Purchase Order' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'technical_report', label: 'Technical Report' },
  { value: 'site_report', label: 'Site Report' },
  { value: 'other', label: 'Other' },
];

export function clientStatusInfo(status) {
  return CLIENT_STATUSES.find(s => s.value === status) || CLIENT_STATUSES[2];
}

export function pipelineStageInfo(stage) {
  return PIPELINE_STAGES.find(s => s.value === stage) || PIPELINE_STAGES[0];
}

export function formatCurrency(value) {
  if (!value && value !== 0) return '—';
  return `R ${Number(value).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}
