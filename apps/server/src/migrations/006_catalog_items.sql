-- Price list: everything RUNHTec sells (equipment, materials, services) and
-- the price we offer it at. Used to fill quotation and invoice lines.
CREATE TABLE IF NOT EXISTS catalog_items (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  code VARCHAR(60) DEFAULT '',
  category VARCHAR(40) DEFAULT 'other',
  unit VARCHAR(30) DEFAULT 'pcs',
  description VARCHAR(1000) DEFAULT '',
  brand VARCHAR(120) DEFAULT '',
  selling_price DECIMAL(14,2) DEFAULT 0,
  buying_price DECIMAL(14,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'RWF',
  supplier VARCHAR(200) DEFAULT '',
  active TINYINT(1) NOT NULL DEFAULT 1,
  notes VARCHAR(1000) DEFAULT '',
  updated_by_name VARCHAR(200) DEFAULT '',
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_catalog_category (category),
  INDEX idx_catalog_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
