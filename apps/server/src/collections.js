// Central collection registry: table name, fields (matching the real
// PocketBase schema this replaces, pulled directly from
// apps/pocketbase/pb_migrations rather than reconstructed from memory),
// relations (drives `expand`), file fields, and RBAC rules ported from
// apps/pocketbase/pb_migrations/1790000005_rbac_collection_rules.js.
//
// rules.list returning false filters a row out of results (matches
// PocketBase's listRule-as-WHERE-filter behavior — 200 with fewer items,
// not a 403). rules.view/create/update/delete returning false raises a
// 404/403 in the route handler.

const any = (user, roles) => Boolean(user) && (user.role === 'super_admin' || roles.includes(user.role));

const AUTHED = () => true;
const SALES_WRITE = (user) => any(user, ['sales']);
const PM_WRITE = (user) => any(user, ['project_manager']);
const PM_TECH_WRITE = (user) => any(user, ['project_manager', 'technician', 'lead_technician']);
const isLead = (user) => user?.role === 'lead_technician';
const isTech = (user) => ['technician', 'lead_technician'].includes(user?.role);
const FINANCE = (user) => any(user, ['accountant']);
const HR = (user) => any(user, ['hr']);
const HR_PM = (user) => any(user, ['hr', 'project_manager']);
const PEOPLE_READ = (user) => any(user, ['hr', 'project_manager', 'accountant']);
// Who may see buying prices, job costs and profit. Technicians and HR never do.
const COST_VIEW = (user) => any(user, ['sales', 'accountant', 'project_manager']);
const COST_WRITE = (user) => any(user, ['accountant', 'project_manager']);
// Document uploads are a right the Super Admin grants per user (User Management).
const CAN_UPLOAD = (user) => Boolean(user) && (user.role === 'super_admin' || Number(user.can_upload_documents) === 1);
// Staff profiles: everyone sees and edits their own; Super Admin and HR see all.
const PEOPLE_ADMIN = (user) => any(user, ['hr']);
const OWN_OR_ADMIN = (user, record) => PEOPLE_ADMIN(user) || (Boolean(user) && record?.user === user.id);

const collections = {
  clients: {
    table: 'clients',
    fields: ['id', 'client_id', 'company_name', 'trading_name', 'industry', 'registration_number', 'vat_number', 'website', 'logo', 'status', 'categories', 'services', 'potential_value', 'country', 'province', 'district', 'city', 'sector', 'street', 'building_name', 'office_number_addr', 'gps_coordinates', 'account_manager', 'created', 'updated'],
    relations: { account_manager: 'users' },
    fileFields: ['logo'],
    rules: { list: AUTHED, view: AUTHED, create: SALES_WRITE, update: SALES_WRITE, delete: SALES_WRITE },
  },
  client_contacts: {
    table: 'client_contacts',
    fields: ['id', 'client', 'full_name', 'position', 'mobile', 'office', 'whatsapp', 'email', 'is_primary', 'created', 'updated'],
    relations: { client: 'clients' },
    rules: { list: AUTHED, view: AUTHED, create: SALES_WRITE, update: SALES_WRITE, delete: SALES_WRITE },
  },
  client_activities: {
    table: 'client_activities',
    fields: ['id', 'client', 'type', 'description', 'actor', 'actor_name', 'created'],
    relations: { client: 'clients', actor: 'users' },
    // Calls, meetings and site visits logged by staff — editable so typos
    // can be fixed. The system-wide Activity Log (activity_logs) stays locked.
    rules: { list: AUTHED, view: AUTHED, create: SALES_WRITE, update: SALES_WRITE, delete: SALES_WRITE },
  },
  client_followups: {
    table: 'client_followups',
    fields: ['id', 'client', 'type', 'title', 'description', 'due_date', 'assigned_to', 'status', 'priority', 'created', 'updated'],
    relations: { client: 'clients', assigned_to: 'users' },
    rules: { list: AUTHED, view: AUTHED, create: SALES_WRITE, update: SALES_WRITE, delete: SALES_WRITE },
  },
  client_notes: {
    table: 'client_notes',
    fields: ['id', 'client', 'title', 'body', 'category', 'priority', 'author', 'author_name', 'created', 'updated'],
    relations: { client: 'clients', author: 'users' },
    rules: { list: AUTHED, view: AUTHED, create: SALES_WRITE, update: SALES_WRITE, delete: SALES_WRITE },
  },
  client_documents: {
    table: 'client_documents',
    fields: ['id', 'client', 'title', 'doc_type', 'file', 'uploaded_by', 'uploaded_by_name', 'created', 'updated'],
    relations: { client: 'clients', uploaded_by: 'users' },
    fileFields: ['file'],
    rules: { list: AUTHED, view: AUTHED, create: CAN_UPLOAD, update: CAN_UPLOAD, delete: (u) => CAN_UPLOAD(u) && SALES_WRITE(u) },
  },
  sales_opportunities: {
    table: 'sales_opportunities',
    fields: ['id', 'client', 'title', 'stage', 'value', 'description', 'expected_close', 'assigned_to', 'created', 'updated'],
    relations: { client: 'clients', assigned_to: 'users' },
    rules: { list: AUTHED, view: AUTHED, create: SALES_WRITE, update: SALES_WRITE, delete: SALES_WRITE },
  },
  rfqs: {
    table: 'rfqs',
    fields: ['id', 'name', 'company', 'email', 'phone', 'service_type', 'urgency', 'budget', 'address', 'description', 'attachments', 'status', 'source', 'client', 'request_type', 'request_status', 'created', 'updated'],
    relations: { client: 'clients' },
    fileFields: [], // `attachments` is a multi-file JSON array of file ids, handled separately from single fileFields
    rules: { list: AUTHED, view: AUTHED, create: SALES_WRITE, update: SALES_WRITE, delete: SALES_WRITE },
    watchedFields: ['status', 'request_status'],
  },
  quotations: {
    table: 'quotations',
    fields: ['id', 'rfq', 'client', 'number', 'items', 'subtotal', 'tax_rate', 'tax_amount', 'discount_amount', 'total', 'currency', 'notes', 'terms_conditions', 'status', 'valid_until', 'signed_at', 'signed_by_name', 'bill_to_name', 'bill_to_company', 'bill_to_address', 'bill_to_email', 'bill_to_phone', 'costing', 'source_invoice', 'created', 'updated'],
    relations: { rfq: 'rfqs', client: 'clients' },
    rules: { list: AUTHED, view: AUTHED, create: SALES_WRITE, update: SALES_WRITE, delete: SALES_WRITE },
    watchedFields: ['status', 'total'],
  },
  projects: {
    table: 'projects',
    fields: ['id', 'quotation', 'client', 'title', 'status', 'assigned_technicians', 'tasks', 'site_address', 'start_date', 'due_date', 'description', 'project_manager', 'service_category', 'value', 'currency', 'progress', 'priority', 'completed_date', 'notes', 'cost_budget', 'lead_technician', 'created', 'updated'],
    relations: { quotation: 'quotations', client: 'clients', project_manager: 'users', lead_technician: 'users' },
    rules: {
      list: AUTHED,
      view: AUTHED,
      // Sales can hand an accepted quotation over as a new project.
      create: (user) => any(user, ['project_manager', 'sales']),
      // Technicians may update only a project they're assigned to —
      // mirrors the assigned_technicians.id ?= @request.auth.id rule.
      // The project's lead technician can update tasks, progress and status (see LEAD_PROJECT_FIELDS).
      update: (user, record) => PM_WRITE(user)
        || (isTech(user) && Array.isArray(record?.assigned_technicians) && record.assigned_technicians.includes(user.id))
        || (isLead(user) && record?.lead_technician === user.id),
      delete: PM_WRITE,
    },
  },
  maintenance_contracts: {
    table: 'maintenance_contracts',
    fields: ['id', 'client', 'service_type', 'frequency', 'next_due_date', 'active', 'assigned_technician', 'contract_value', 'currency', 'start_date', 'end_date', 'contractor', 'site', 'notes', 'created', 'updated'],
    relations: { client: 'clients', assigned_technician: 'users', contractor: 'contractors' },
    rules: {
      list: AUTHED,
      view: AUTHED,
      create: PM_WRITE,
      update: (user, record) => PM_WRITE(user) || (isTech(user) && record?.assigned_technician === user.id),
      delete: PM_WRITE,
    },
  },
  equipment: {
    table: 'equipment',
    fields: ['id', 'client', 'equipment_id', 'name', 'category', 'manufacturer', 'brand', 'model_number', 'serial_number', 'capacity', 'voltage', 'power_rating', 'installation_date', 'warranty_expiry', 'commissioning_date', 'asset_location', 'building', 'floor', 'room', 'gps_coordinates', 'condition', 'status', 'service_interval', 'next_service_date', 'assigned_technician', 'photos', 'remarks', 'created', 'updated'],
    relations: { client: 'clients' },
    rules: { list: AUTHED, view: AUTHED, create: PM_TECH_WRITE, update: PM_TECH_WRITE, delete: PM_WRITE },
  },
  // HR: independent contractors engaged per project (not employees).
  contractors: {
    table: 'contractors',
    fields: ['id', 'code', 'full_name', 'email', 'phone', 'whatsapp', 'department', 'trade', 'skills', 'experience_years', 'qualifications', 'certifications', 'country', 'city', 'rate_amount', 'rate_unit', 'currency', 'has_tools', 'has_transport', 'status', 'verified', 'rating', 'cv', 'id_document', 'certificate_file', 'emergency_contact', 'payment_details', 'notes', 'source', 'application', 'user', 'created', 'updated'],
    relations: { user: 'users', application: 'job_applications' },
    fileFields: ['cv', 'id_document', 'certificate_file'],
    rules: { list: PEOPLE_READ, view: PEOPLE_READ, create: HR_PM, update: HR_PM, delete: HR },
    watchedFields: ['status', 'verified', 'rate_amount'],
  },
  // Applications arrive from the public website form (routes/careers.js).
  job_applications: {
    table: 'job_applications',
    fields: ['id', 'ref', 'full_name', 'email', 'phone', 'whatsapp', 'country', 'city', 'department', 'trade', 'other_skills', 'experience_years', 'qualifications', 'certifications', 'previous_projects', 'availability', 'expected_rate', 'rate_unit', 'has_tools', 'has_transport', 'cv', 'certificate_file', 'status', 'score', 'review_notes', 'reviewed_by', 'contractor', 'created', 'updated'],
    relations: { reviewed_by: 'users', contractor: 'contractors' },
    rules: { list: HR_PM, view: HR_PM, create: HR, update: HR_PM, delete: HR },
    watchedFields: ['status'],
  },
  // One contract per contractor per project: scope, fee, dates, payment.
  project_assignments: {
    table: 'project_assignments',
    fields: ['id', 'project', 'contractor', 'role_on_project', 'scope_of_work', 'payment_basis', 'agreed_amount', 'currency', 'start_date', 'end_date', 'status', 'contract_signed', 'payment_status', 'amount_paid', 'performance_rating', 'notes', 'created', 'updated'],
    relations: { project: 'projects', contractor: 'contractors' },
    // Lead technicians see the crew engaged on projects so they can log their days.
    rules: { list: (u) => PEOPLE_READ(u) || isLead(u), view: (u) => PEOPLE_READ(u) || isLead(u), create: HR_PM, update: PEOPLE_READ, delete: HR_PM },
    watchedFields: ['status', 'agreed_amount', 'payment_status', 'amount_paid'],
  },
  employees: {
    table: 'employees',
    fields: ['id', 'user', 'role', 'phone', 'skills', 'active', 'created', 'updated'],
    relations: { user: 'users' },
    rules: { list: AUTHED, view: AUTHED, create: PM_WRITE, update: PM_WRITE, delete: PM_WRITE },
  },
  documents: {
    table: 'documents',
    fields: ['id', 'title', 'client', 'project', 'type', 'file', 'notes', 'uploaded_by_name', 'created'],
    relations: { client: 'clients', project: 'projects' },
    fileFields: ['file'],
    rules: { list: AUTHED, view: AUTHED, create: CAN_UPLOAD, update: CAN_UPLOAD, delete: (u) => CAN_UPLOAD(u) && PM_WRITE(u) },
  },
  staff_profiles: {
    table: 'staff_profiles',
    fields: ['id', 'user', 'full_name', 'phone', 'whatsapp', 'momo_number', 'date_of_birth', 'gender', 'national_id_number', 'district', 'address', 'emergency_contact_name', 'emergency_contact_relation', 'emergency_contact_phone', 'education_level', 'institution', 'field_of_study', 'skills', 'photo', 'id_document', 'created', 'updated'],
    relations: { user: 'users' },
    fileFields: ['photo', 'id_document'],
    ownerField: 'user',
    ownerAdmin: PEOPLE_ADMIN,
    rules: { list: OWN_OR_ADMIN, view: OWN_OR_ADMIN, create: AUTHED, update: OWN_OR_ADMIN, delete: PEOPLE_ADMIN },
  },
  staff_documents: {
    table: 'staff_documents',
    fields: ['id', 'user', 'kind', 'title', 'file', 'created', 'updated'],
    relations: { user: 'users' },
    fileFields: ['file'],
    ownerField: 'user',
    ownerAdmin: PEOPLE_ADMIN,
    rules: { list: OWN_OR_ADMIN, view: OWN_OR_ADMIN, create: AUTHED, update: OWN_OR_ADMIN, delete: OWN_OR_ADMIN },
  },
  invoices: {
    table: 'invoices',
    fields: ['id', 'invoice_number', 'client', 'quotation', 'project', 'bill_to_name', 'bill_to_company', 'bill_to_address', 'bill_to_email', 'bill_to_phone', 'invoice_date', 'due_date', 'payment_terms', 'items', 'subtotal', 'tax_rate', 'tax_amount', 'discount_amount', 'total', 'currency', 'notes', 'payment_instructions', 'terms_conditions', 'status', 'created_by', 'created_by_name', 'costing', 'created', 'updated'],
    relations: { client: 'clients', created_by: 'users', quotation: 'quotations', project: 'projects' },
    // Financial data — protected per the RBAC requirements: read AND write
    // restricted to accountant + super_admin, not just write.
    rules: { list: FINANCE, view: FINANCE, create: FINANCE, update: FINANCE, delete: FINANCE },
    watchedFields: ['status', 'total'],
  },
  payments: {
    table: 'payments',
    fields: ['id', 'client', 'invoice', 'reference', 'amount', 'currency', 'status', 'transaction_reference', 'method', 'paid_date', 'notes', 'recorded_by_name', 'created'],
    relations: { client: 'clients', invoice: 'invoices' },
    rules: { list: FINANCE, view: FINANCE, create: FINANCE, update: FINANCE, delete: FINANCE },
    watchedFields: ['status', 'amount'],
  },
  // Internal job costs (labour days, materials, transport…). Staff only.
  project_costs: {
    table: 'project_costs',
    fields: ['id', 'project', 'cost_date', 'category', 'description', 'contractor', 'worker_name', 'worker_role', 'quantity', 'unit_cost', 'amount', 'currency', 'paid', 'notes', 'recorded_by', 'recorded_by_name', 'created', 'updated'],
    relations: { project: 'projects', contractor: 'contractors' },
    // A lead technician logs days/expenses on projects they lead (checked when saving)
    // and sees and corrects only the entries they made themselves.
    rules: {
      list: (u, r) => COST_VIEW(u) || (isLead(u) && r?.recorded_by === u.id),
      view: (u, r) => COST_VIEW(u) || (isLead(u) && r?.recorded_by === u.id),
      create: (u) => COST_WRITE(u) || isLead(u),
      update: (u, r) => COST_WRITE(u) || (isLead(u) && r?.recorded_by === u.id && !Number(r?.paid)),
      delete: (u, r) => COST_WRITE(u) || (isLead(u) && r?.recorded_by === u.id && !Number(r?.paid)),
    },
  },
  notifications: {
    table: 'notifications',
    fields: ['id', 'user', 'type', 'message', 'read', 'created'],
    relations: { user: 'users' },
    rules: {
      // Scoped to the owner, matching PocketBase's `user = @request.auth.id` rule.
      list: (user, record) => user?.role === 'super_admin' || record?.user === user?.id,
      view: (user, record) => user?.role === 'super_admin' || record?.user === user?.id,
      create: AUTHED,
      update: (user, record) => user?.role === 'super_admin' || record?.user === user?.id,
      delete: (user) => user?.role === 'super_admin',
    },
  },
  company_settings: {
    table: 'company_settings',
    fields: ['id', 'bank_name', 'account_name', 'account_number', 'branch_code', 'swift_code', 'currency', 'company_address', 'company_phone', 'company_email', 'company_website', 'company_name', 'company_tagline', 'company_registration_number', 'logo', 'signature', 'stamp', 'signature_name', 'signature_position', 'show_signature', 'show_stamp', 'invoice_footer_text', 'default_terms_conditions', 'default_payment_instructions', 'labour_rates', 'default_contingency', 'created', 'updated'],
    relations: {},
    fileFields: ['logo', 'signature', 'stamp'],
    rules: { list: AUTHED, view: AUTHED, create: (u) => u?.role === 'super_admin', update: (u) => u?.role === 'super_admin', delete: () => false },
    watchedFields: ['bank_name', 'account_number', 'show_signature', 'show_stamp'],
  },
  activity_logs: {
    table: 'activity_logs',
    fields: ['id', 'actor', 'actor_name', 'action', 'detail', 'created'],
    relations: { actor: 'users' },
    rules: { list: (u) => u?.role === 'super_admin', view: (u) => u?.role === 'super_admin', create: AUTHED, update: () => false, delete: () => false },
  },
  users: {
    table: 'users',
    fields: ['id', 'email', 'name', 'job_title', 'department', 'phone', 'role', 'status', 'profile_completed', 'can_upload_documents', 'created', 'updated'],
    relations: {},
    rules: {
      list: AUTHED,
      view: AUTHED,
      create: (u) => u?.role === 'super_admin',
      update: (u) => u?.role === 'super_admin',
      delete: (u, record) => u?.role === 'super_admin' && record?.role !== 'super_admin',
    },
    watchedFields: ['role', 'status', 'email'],
  },
};

module.exports = {
  COST_VIEW, collections };
