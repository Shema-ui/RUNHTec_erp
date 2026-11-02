-- Internal job costing: every shilling spent on a project (labour days,
-- materials, transport, ...). Never shown to clients.
CREATE TABLE IF NOT EXISTS project_costs (
  id VARCHAR(20) PRIMARY KEY,
  project VARCHAR(20) DEFAULT NULL,
  cost_date VARCHAR(20) DEFAULT '',
  category VARCHAR(30) NOT NULL DEFAULT 'other',
  description VARCHAR(500) DEFAULT '',
  contractor VARCHAR(20) DEFAULT NULL,
  worker_name VARCHAR(200) DEFAULT '',
  worker_role VARCHAR(30) DEFAULT '',
  quantity DECIMAL(10,2) DEFAULT 1,
  unit_cost DECIMAL(14,2) DEFAULT 0,
  amount DECIMAL(14,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'RWF',
  paid TINYINT(1) NOT NULL DEFAULT 0,
  notes VARCHAR(1000) DEFAULT '',
  recorded_by_name VARCHAR(200) DEFAULT '',
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pcost_project (project),
  INDEX idx_pcost_contractor (contractor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
