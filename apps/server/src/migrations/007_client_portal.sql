-- Conversation between a client (portal) and the RUNHTec team.
CREATE TABLE IF NOT EXISTS client_messages (
  id VARCHAR(20) PRIMARY KEY,
  client VARCHAR(20) NOT NULL,
  project VARCHAR(20) DEFAULT NULL,
  sender VARCHAR(20) DEFAULT NULL,
  sender_name VARCHAR(200) DEFAULT '',
  sender_role VARCHAR(20) NOT NULL DEFAULT 'staff',
  kind VARCHAR(20) NOT NULL DEFAULT 'message',
  topic VARCHAR(60) DEFAULT '',
  body VARCHAR(4000) DEFAULT '',
  read_by_client TINYINT(1) NOT NULL DEFAULT 0,
  read_by_staff TINYINT(1) NOT NULL DEFAULT 0,
  created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cmsg_client (client),
  INDEX idx_cmsg_project (project)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
