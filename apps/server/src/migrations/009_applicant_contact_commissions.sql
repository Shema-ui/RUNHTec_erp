CREATE TABLE IF NOT EXISTS application_events (
  id VARCHAR(20) PRIMARY KEY,
  application VARCHAR(20) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  subject VARCHAR(255) DEFAULT '',
  body TEXT,
  to_address VARCHAR(190) DEFAULT '',
  status VARCHAR(20) DEFAULT 'sent',
  place VARCHAR(255) DEFAULT '',
  scheduled_for DATETIME NULL,
  reminder_sent TINYINT(1) NOT NULL DEFAULT 0,
  created_by_name VARCHAR(200) DEFAULT '',
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_events_application (application),
  INDEX idx_events_reminder (kind, reminder_sent, scheduled_for)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS commissions (
  id VARCHAR(20) PRIMARY KEY,
  staff_user VARCHAR(20) NOT NULL,
  project VARCHAR(20) NOT NULL,
  client VARCHAR(20) DEFAULT NULL,
  referral VARCHAR(20) DEFAULT NULL,
  paid_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  cost_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  profit DECIMAL(14,2) NOT NULL DEFAULT 0,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  owed_at DATETIME NULL,
  paid_at DATETIME NULL,
  paid_by_name VARCHAR(200) DEFAULT '',
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_commission (project, staff_user),
  INDEX idx_commissions_staff (staff_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
