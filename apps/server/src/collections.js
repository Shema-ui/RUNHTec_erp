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
const PM_TECH_WRITE = (user) => any(user, ['project_manager', 'technician']);
const FINANCE = (user) => any(user, ['accountant']);

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
    // updateRule is null on this collection in PocketBase — activity log
    // entries are append-only, matching an audit-trail's intent.
    rules: { list: AUTHED, view: AUTHED, create: SALES_WRITE, update: () => false, delete: SALES_WRITE },
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
    rules: { list: AUTHED, view: AUTHED, create: SALES_WRITE, update: SALES_WRITE, delete: SALES_WRITE },
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
    fields: ['id', 'rfq', 'client', 'number', 'items', 'subtotal', 'tax_rate', 'tax_amount', 'discount_amount', 'total', 'currency', 'notes', 'terms_conditions', 'status', 'valid_until', 'signed_at', 'signed_by_name', 'bill_to_name', 'bill_to_company', 'bill_to_address', 'bill_to_email', 'bill_to_phone', 'created', 'updated'],
    relations: { rfq: 'rfqs', client: 'clients' },
    rules: { list: AUTHED, view: AUTHED, create: SALES_WRITE, update: SALES_WRITE, delete: SALES_WRITE },
    watchedFields: ['status', 'total'],
  },
  projects: {
    table: 'projects',
    fields: ['id', 'quotation', 'client', 'title', 'status', 'assigned_technicians', 'tasks', 'site_address', 'start_date', 'due_date', 'created', 'updated'],
    relations: { quotation: 'quotations', client: 'clients' },
    rules: {
      list: AUTHED,
      view: AUTHED,
      create: PM_WRITE,
      // Technicians may update only a project they're assigned to —
      // mirrors the assigned_technicians.id ?= @request.auth.id rule.
      update: (user, record) => PM_WRITE(user) || (user?.role === 'technician' && Array.isArray(record?.assigned_technicians) && record.assigned_technicians.includes(user.id)),
      delete: PM_WRITE,
    },
  },
  maintenance_contracts: {
    table: 'maintenance_contracts',
    fields: ['id', 'client', 'service_type', 'frequency', 'next_due_date', 'active', 'assigned_technician', 'created', 'updated'],
    relations: { client: 'clients', assigned_technician: 'users' },
    rules: {
      list: AUTHED,
      view: AUTHED,
      create: PM_WRITE,
      update: (user, record) => PM_WRITE(user) || (user?.role === 'technician' && record?.assigned_technician === user.id),
      delete: PM_WRITE,
    },
  },
  equipment: {
    table: 'equipment',
    fields: ['id', 'client', 'equipment_id', 'name', 'category', 'manufacturer', 'brand', 'model_number', 'serial_number', 'capacity', 'voltage', 'power_rating', 'installation_date', 'warranty_expiry', 'commissioning_date', 'asset_location', 'building', 'floor', 'room', 'gps_coordinates', 'condition', 'status', 'service_interval', 'next_service_date', 'assigned_technician', 'photos', 'remarks', 'created', 'updated'],
    relations: { client: 'clients' },
    rules: { list: AUTHED, view: AUTHED, create: PM_TECH_WRITE, update: PM_TECH_WRITE, delete: PM_WRITE },
  },
  employees: {
    table: 'employees',
    fields: ['id', 'user', 'role', 'phone', 'skills', 'active', 'created', 'updated'],
    relations: { user: 'users' },
    rules: { list: AUTHED, view: AUTHED, create: PM_WRITE, update: PM_WRITE, delete: PM_WRITE },
  },
  documents: {
    table: 'documents',
    fields: ['id', 'title', 'client', 'type', 'file', 'created'],
    relations: { client: 'clients' },
    fileFields: ['file'],
    rules: { list: AUTHED, view: AUTHED, create: PM_TECH_WRITE, update: PM_WRITE, delete: PM_WRITE },
  },
  invoices: {
    table: 'invoices',
    fields: ['id', 'invoice_number', 'client', 'bill_to_name', 'bill_to_company', 'bill_to_address', 'bill_to_email', 'bill_to_phone', 'invoice_date', 'due_date', 'payment_terms', 'items', 'subtotal', 'tax_rate', 'tax_amount', 'discount_amount', 'total', 'currency', 'notes', 'payment_instructions', 'terms_conditions', 'status', 'created_by', 'created_by_name', 'created', 'updated'],
    relations: { client: 'clients', created_by: 'users' },
    // Financial data — protected per the RBAC requirements: read AND write
    // restricted to accountant + super_admin, not just write.
    rules: { list: FINANCE, view: FINANCE, create: FINANCE, update: FINANCE, delete: FINANCE },
    watchedFields: ['status', 'total'],
  },
  payments: {
    table: 'payments',
    fields: ['id', 'client', 'reference', 'amount', 'currency', 'status', 'transaction_reference', 'created'],
    relations: { client: 'clients' },
    rules: { list: FINANCE, view: FINANCE, create: FINANCE, update: FINANCE, delete: FINANCE },
    watchedFields: ['status', 'amount'],
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
    fields: ['id', 'bank_name', 'account_name', 'account_number', 'branch_code', 'swift_code', 'currency', 'company_address', 'company_phone', 'company_email', 'company_website', 'company_name', 'company_tagline', 'company_registration_number', 'logo', 'signature', 'stamp', 'signature_name', 'signature_position', 'show_signature', 'show_stamp', 'invoice_footer_text', 'default_terms_conditions', 'default_payment_instructions', 'created', 'updated'],
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
    fields: ['id', 'email', 'name', 'job_title', 'phone', 'role', 'status', 'created', 'updated'],
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

module.exports = { collections };
