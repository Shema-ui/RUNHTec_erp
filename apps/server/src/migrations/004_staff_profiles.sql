-- Each staff member's own profile (filled in by them on first login).
CREATE TABLE IF NOT EXISTS staff_profiles (
  id VARCHAR(20) PRIMARY KEY,
  user VARCHAR(20) NOT NULL,
  full_name VARCHAR(200) DEFAULT '',
  phone VARCHAR(40) DEFAULT '',
  whatsapp VARCHAR(40) DEFAULT '',
  momo_number VARCHAR(40) DEFAULT '',
  date_of_birth VARCHAR(20) DEFAULT '',
  gender VARCHAR(20) DEFAULT '',
  national_id_number VARCHAR(40) DEFAULT '',
  district VARCHAR(100) DEFAULT '',
  address VARCHAR(300) DEFAULT '',
  emergency_contact_name VARCHAR(200) DEFAULT '',
  emergency_contact_relation VARCHAR(60) DEFAULT '',
  emergency_contact_phone VARCHAR(40) DEFAULT '',
  education_level VARCHAR(60) DEFAULT '',
  institution VARCHAR(200) DEFAULT '',
  field_of_study VARCHAR(200) DEFAULT '',
  skills VARCHAR(1000) DEFAULT '',
  photo VARCHAR(40) DEFAULT NULL,
  id_document VARCHAR(40) DEFAULT NULL,
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_staff_profile_user (user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Transcripts, certificates, CV… one row per file.
CREATE TABLE IF NOT EXISTS staff_documents (
  id VARCHAR(20) PRIMARY KEY,
  user VARCHAR(20) NOT NULL,
  kind VARCHAR(30) NOT NULL DEFAULT 'certificate',
  title VARCHAR(200) DEFAULT '',
  file VARCHAR(40) DEFAULT NULL,
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_staff_docs_user (user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
