-- Daily progress photos taken on site, per project.
CREATE TABLE IF NOT EXISTS project_photos (
  id VARCHAR(20) PRIMARY KEY,
  project VARCHAR(20) NOT NULL,
  photo VARCHAR(40) DEFAULT NULL,
  taken_on VARCHAR(20) DEFAULT '',
  caption VARCHAR(1000) DEFAULT '',
  uploaded_by VARCHAR(20) DEFAULT NULL,
  uploaded_by_name VARCHAR(200) DEFAULT '',
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_photos_project (project)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
