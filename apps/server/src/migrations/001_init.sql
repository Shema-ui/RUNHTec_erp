-- RUNHTec ERP schema (MySQL). Field names are pulled directly from the
-- PocketBase migrations this backend replaces (apps/pocketbase/pb_migrations),
-- not reconstructed from memory, so the existing frontend page components
-- (which read/write these exact field names) work with minimal changes.

CREATE TABLE IF NOT EXISTS files (
  id VARCHAR(20) PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  mimetype VARCHAR(100) NOT NULL,
  size INT NOT NULL,
  data LONGBLOB NOT NULL,
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(20) PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(200) DEFAULT '',
  job_title VARCHAR(120) DEFAULT '',
  phone VARCHAR(40) DEFAULT '',
  role ENUM('super_admin','sales','project_manager','accountant','technician') NOT NULL DEFAULT 'sales',
  status ENUM('active','suspended') NOT NULL DEFAULT 'active',
  reset_token_hash VARCHAR(255) DEFAULT NULL,
  reset_token_expires DATETIME DEFAULT NULL,
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS activity_logs (
  id VARCHAR(20) PRIMARY KEY,
  actor VARCHAR(20) DEFAULT '',
  actor_name VARCHAR(200) DEFAULT '',
  action VARCHAR(120) DEFAULT '',
  detail VARCHAR(500) DEFAULT '',
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS clients (
  id VARCHAR(20) PRIMARY KEY,
  client_id VARCHAR(20) DEFAULT '',
  company_name VARCHAR(200) NOT NULL DEFAULT '',
  trading_name VARCHAR(200) DEFAULT '',
  industry VARCHAR(100) DEFAULT '',
  registration_number VARCHAR(50) DEFAULT '',
  vat_number VARCHAR(50) DEFAULT '',
  website VARCHAR(200) DEFAULT '',
  logo VARCHAR(20) DEFAULT NULL,
  status ENUM('lead','active','inactive','suspended') NOT NULL DEFAULT 'lead',
  categories JSON DEFAULT NULL,
  services JSON DEFAULT NULL,
  potential_value DECIMAL(14,2) DEFAULT 0,
  country VARCHAR(100) DEFAULT '',
  province VARCHAR(100) DEFAULT '',
  district VARCHAR(100) DEFAULT '',
  city VARCHAR(100) DEFAULT '',
  sector VARCHAR(100) DEFAULT '',
  street VARCHAR(200) DEFAULT '',
  building_name VARCHAR(100) DEFAULT '',
  office_number_addr VARCHAR(50) DEFAULT '',
  gps_coordinates VARCHAR(100) DEFAULT '',
  account_manager VARCHAR(20) DEFAULT NULL,
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_clients_status (status),
  INDEX idx_clients_company_name (company_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS client_contacts (
  id VARCHAR(20) PRIMARY KEY,
  client VARCHAR(20) DEFAULT NULL,
  full_name VARCHAR(200) NOT NULL DEFAULT '',
  position VARCHAR(100) DEFAULT '',
  mobile VARCHAR(20) DEFAULT '',
  office VARCHAR(20) DEFAULT '',
  whatsapp VARCHAR(20) DEFAULT '',
  email VARCHAR(190) DEFAULT '',
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_contacts_client (client)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS client_activities (
  id VARCHAR(20) PRIMARY KEY,
  client VARCHAR(20) DEFAULT NULL,
  type ENUM('call','email','meeting','site_visit','rfq','quotation','work_order','project','maintenance','invoice','payment','note','attachment','other') NOT NULL DEFAULT 'other',
  description VARCHAR(1000) NOT NULL DEFAULT '',
  actor VARCHAR(20) DEFAULT NULL,
  actor_name VARCHAR(200) DEFAULT '',
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_activities_client (client)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS client_followups (
  id VARCHAR(20) PRIMARY KEY,
  client VARCHAR(20) DEFAULT NULL,
  type ENUM('call','meeting','site_visit','email','task') NOT NULL DEFAULT 'call',
  title VARCHAR(200) NOT NULL DEFAULT '',
  description VARCHAR(500) DEFAULT '',
  due_date DATE DEFAULT NULL,
  assigned_to VARCHAR(20) DEFAULT NULL,
  status ENUM('pending','completed','cancelled') NOT NULL DEFAULT 'pending',
  priority ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_followups_client (client),
  INDEX idx_followups_status (status),
  INDEX idx_followups_due_date (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS client_notes (
  id VARCHAR(20) PRIMARY KEY,
  client VARCHAR(20) DEFAULT NULL,
  title VARCHAR(200) DEFAULT '',
  body TEXT,
  category ENUM('general','technical','financial','legal','other') NOT NULL DEFAULT 'general',
  priority ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  author VARCHAR(20) DEFAULT NULL,
  author_name VARCHAR(200) DEFAULT '',
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_notes_client (client)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS client_documents (
  id VARCHAR(20) PRIMARY KEY,
  client VARCHAR(20) DEFAULT NULL,
  title VARCHAR(200) NOT NULL DEFAULT '',
  doc_type ENUM('rfq','boq','contract','drawing','photo','purchase_order','certificate','technical_report','site_report','other') NOT NULL DEFAULT 'other',
  file VARCHAR(20) DEFAULT NULL,
  uploaded_by VARCHAR(20) DEFAULT NULL,
  uploaded_by_name VARCHAR(200) DEFAULT '',
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_documents_client (client)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS equipment (
  id VARCHAR(20) PRIMARY KEY,
  client VARCHAR(20) DEFAULT NULL,
  equipment_id VARCHAR(30) DEFAULT '',
  name VARCHAR(200) NOT NULL DEFAULT '',
  category ENUM('hvac','electrical','solar','borehole','plumbing','fire','mechanical','generator','ict','civil','other') DEFAULT 'other',
  manufacturer VARCHAR(100) DEFAULT '',
  brand VARCHAR(100) DEFAULT '',
  model_number VARCHAR(100) DEFAULT '',
  serial_number VARCHAR(100) DEFAULT '',
  capacity VARCHAR(50) DEFAULT '',
  voltage VARCHAR(50) DEFAULT '',
  power_rating VARCHAR(50) DEFAULT '',
  installation_date DATE DEFAULT NULL,
  warranty_expiry DATE DEFAULT NULL,
  commissioning_date DATE DEFAULT NULL,
  asset_location VARCHAR(200) DEFAULT '',
  building VARCHAR(100) DEFAULT '',
  floor VARCHAR(50) DEFAULT '',
  room VARCHAR(100) DEFAULT '',
  gps_coordinates VARCHAR(100) DEFAULT '',
  `condition` ENUM('excellent','good','fair','poor','critical') DEFAULT 'good',
  status ENUM('operational','under_maintenance','faulty','decommissioned') DEFAULT 'operational',
  service_interval VARCHAR(50) DEFAULT '',
  next_service_date DATE DEFAULT NULL,
  assigned_technician VARCHAR(200) DEFAULT '',
  photos JSON DEFAULT NULL,
  remarks VARCHAR(1000) DEFAULT '',
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_equipment_client (client),
  INDEX idx_equipment_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sales_opportunities (
  id VARCHAR(20) PRIMARY KEY,
  client VARCHAR(20) DEFAULT NULL,
  title VARCHAR(200) NOT NULL DEFAULT '',
  stage ENUM('new_lead','contacted','meeting_scheduled','site_visit','proposal_prep','quotation_sent','negotiation','won','lost') NOT NULL DEFAULT 'new_lead',
  value DECIMAL(14,2) DEFAULT 0,
  description VARCHAR(1000) DEFAULT '',
  expected_close DATE DEFAULT NULL,
  assigned_to VARCHAR(20) DEFAULT NULL,
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_opportunities_stage (stage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rfqs (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(200) NOT NULL DEFAULT '',
  company VARCHAR(200) DEFAULT '',
  email VARCHAR(200) DEFAULT '',
  phone VARCHAR(80) DEFAULT '',
  service_type VARCHAR(200) DEFAULT '',
  urgency VARCHAR(80) DEFAULT '',
  budget VARCHAR(80) DEFAULT '',
  address VARCHAR(500) DEFAULT '',
  description VARCHAR(4000) DEFAULT '',
  attachments JSON DEFAULT NULL,
  status ENUM('new','reviewing','quoted','declined') NOT NULL DEFAULT 'new',
  source ENUM('website','manual') NOT NULL DEFAULT 'manual',
  client VARCHAR(20) DEFAULT NULL,
  request_type ENUM('quote_request','service_request','contact_enquiry') NOT NULL DEFAULT 'quote_request',
  request_status ENUM('new','reviewing','scheduled','in_progress','completed','closed') NOT NULL DEFAULT 'new',
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rfqs_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS quotations (
  id VARCHAR(20) PRIMARY KEY,
  rfq VARCHAR(20) DEFAULT NULL,
  client VARCHAR(20) DEFAULT NULL,
  number VARCHAR(50) NOT NULL,
  items JSON DEFAULT NULL,
  subtotal DECIMAL(14,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(14,2) DEFAULT 0,
  discount_amount DECIMAL(14,2) DEFAULT 0,
  total DECIMAL(14,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'ZAR',
  notes VARCHAR(4000) DEFAULT '',
  terms_conditions TEXT,
  status ENUM('draft','sent','accepted','declined','expired') NOT NULL DEFAULT 'draft',
  valid_until VARCHAR(20) DEFAULT '',
  signed_at VARCHAR(20) DEFAULT '',
  signed_by_name VARCHAR(200) DEFAULT '',
  bill_to_name VARCHAR(200) DEFAULT '',
  bill_to_company VARCHAR(200) DEFAULT '',
  bill_to_address VARCHAR(500) DEFAULT '',
  bill_to_email VARCHAR(200) DEFAULT '',
  bill_to_phone VARCHAR(50) DEFAULT '',
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_quotations_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(20) PRIMARY KEY,
  quotation VARCHAR(20) DEFAULT NULL,
  client VARCHAR(20) DEFAULT NULL,
  title VARCHAR(200) NOT NULL DEFAULT '',
  status ENUM('scheduled','in_progress','done','cancelled') NOT NULL DEFAULT 'scheduled',
  assigned_technicians JSON DEFAULT NULL,
  tasks JSON DEFAULT NULL,
  site_address VARCHAR(500) DEFAULT '',
  start_date VARCHAR(20) DEFAULT '',
  due_date VARCHAR(20) DEFAULT '',
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_projects_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS maintenance_contracts (
  id VARCHAR(20) PRIMARY KEY,
  client VARCHAR(20) DEFAULT NULL,
  service_type VARCHAR(200) DEFAULT '',
  frequency VARCHAR(80) DEFAULT '',
  next_due_date VARCHAR(20) DEFAULT '',
  active TINYINT(1) NOT NULL DEFAULT 1,
  assigned_technician VARCHAR(20) DEFAULT NULL,
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS employees (
  id VARCHAR(20) PRIMARY KEY,
  user VARCHAR(20) DEFAULT NULL,
  role VARCHAR(80) DEFAULT '',
  phone VARCHAR(80) DEFAULT '',
  skills JSON DEFAULT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(20) PRIMARY KEY,
  user VARCHAR(20) DEFAULT NULL,
  type VARCHAR(80) DEFAULT '',
  message VARCHAR(4000) DEFAULT '',
  `read` TINYINT(1) NOT NULL DEFAULT 0,
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_read (`read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(20) PRIMARY KEY,
  client VARCHAR(20) DEFAULT NULL,
  reference VARCHAR(120) DEFAULT '',
  amount DECIMAL(14,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'ZAR',
  status ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending',
  transaction_reference VARCHAR(200) DEFAULT '',
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(20) PRIMARY KEY,
  title VARCHAR(200) NOT NULL DEFAULT '',
  client VARCHAR(20) DEFAULT NULL,
  type VARCHAR(80) DEFAULT '',
  file VARCHAR(20) DEFAULT NULL,
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(20) PRIMARY KEY,
  invoice_number VARCHAR(50) NOT NULL,
  client VARCHAR(20) DEFAULT NULL,
  bill_to_name VARCHAR(200) DEFAULT '',
  bill_to_company VARCHAR(200) DEFAULT '',
  bill_to_address VARCHAR(500) DEFAULT '',
  bill_to_email VARCHAR(200) DEFAULT '',
  bill_to_phone VARCHAR(50) DEFAULT '',
  invoice_date VARCHAR(20) DEFAULT '',
  due_date VARCHAR(20) DEFAULT '',
  payment_terms VARCHAR(100) DEFAULT '',
  items JSON DEFAULT NULL,
  subtotal DECIMAL(14,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(14,2) DEFAULT 0,
  discount_amount DECIMAL(14,2) DEFAULT 0,
  total DECIMAL(14,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'ZAR',
  notes VARCHAR(2000) DEFAULT '',
  payment_instructions VARCHAR(2000) DEFAULT '',
  terms_conditions TEXT,
  status ENUM('draft','sent','paid','overdue','cancelled') NOT NULL DEFAULT 'draft',
  created_by VARCHAR(20) DEFAULT NULL,
  created_by_name VARCHAR(200) DEFAULT '',
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_invoice_number (invoice_number),
  INDEX idx_invoice_status (status),
  INDEX idx_invoice_client (client)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS company_settings (
  id VARCHAR(20) PRIMARY KEY,
  bank_name VARCHAR(200) DEFAULT '',
  account_name VARCHAR(200) DEFAULT '',
  account_number VARCHAR(100) DEFAULT '',
  branch_code VARCHAR(50) DEFAULT '',
  swift_code VARCHAR(50) DEFAULT '',
  currency VARCHAR(10) DEFAULT 'ZAR',
  company_address VARCHAR(500) DEFAULT '',
  company_phone VARCHAR(100) DEFAULT '',
  company_email VARCHAR(200) DEFAULT '',
  company_website VARCHAR(200) DEFAULT '',
  company_name VARCHAR(200) DEFAULT 'RUNHTec Contractors',
  company_tagline VARCHAR(200) DEFAULT '',
  company_registration_number VARCHAR(100) DEFAULT '',
  logo VARCHAR(20) DEFAULT NULL,
  signature VARCHAR(20) DEFAULT NULL,
  stamp VARCHAR(20) DEFAULT NULL,
  signature_name VARCHAR(200) DEFAULT '',
  signature_position VARCHAR(200) DEFAULT '',
  show_signature TINYINT(1) NOT NULL DEFAULT 1,
  show_stamp TINYINT(1) NOT NULL DEFAULT 1,
  invoice_footer_text VARCHAR(1000) DEFAULT 'Thank you for your business.',
  default_terms_conditions TEXT,
  default_payment_instructions TEXT,
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
