CREATE DATABASE IF NOT EXISTS atlas_monitor;
USE atlas_monitor;

-- Drop existing tables if they exist (for fresh setup)
DROP TABLE IF EXISTS metrics;
DROP TABLE IF EXISTS servers;

-- Enhanced servers table
CREATE TABLE servers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  server_name VARCHAR(255) NOT NULL,
  ip_address VARCHAR(50) NOT NULL,
  location VARCHAR(100) DEFAULT 'Unknown',
  os VARCHAR(50) NOT NULL,
  kernel VARCHAR(100),
  architecture VARCHAR(50),
  cpu_model VARCHAR(255),
  total_cores INT DEFAULT 0,
  total_threads INT DEFAULT 0,
  total_memory_gb FLOAT DEFAULT 0,
  total_disk_gb FLOAT DEFAULT 0,
  status ENUM('online', 'offline', 'maintenance') DEFAULT 'offline',
  registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_server (server_name, ip_address),
  INDEX idx_status (status),
  INDEX idx_last_seen (last_seen)
);

-- Enhanced metrics table
CREATE TABLE metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  server_id INT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cpu_usage FLOAT DEFAULT 0,
  memory_usage FLOAT DEFAULT 0,
  disk_usage FLOAT DEFAULT 0,
  network_rx_gb FLOAT DEFAULT 0,
  network_tx_gb FLOAT DEFAULT 0,
  uptime VARCHAR(50),
  health_status ENUM('healthy', 'warning', 'critical') DEFAULT 'healthy',
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  INDEX idx_server_timestamp (server_id, timestamp),
  INDEX idx_timestamp (timestamp),
  INDEX idx_health_status (health_status)
);

-- Create a view for dashboard summary
CREATE VIEW dashboard_summary AS
SELECT 
  COUNT(*) as total_servers,
  SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online_servers,
  SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline_servers,
  AVG(CASE WHEN m.cpu_usage IS NOT NULL THEN m.cpu_usage ELSE 0 END) as avg_cpu_usage
FROM servers s
LEFT JOIN (
  SELECT DISTINCT server_id, 
    FIRST_VALUE(cpu_usage) OVER (PARTITION BY server_id ORDER BY timestamp DESC) as cpu_usage
  FROM metrics 
  WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
) m ON s.id = m.server_id;

-- Insert sample data for testing (optional)
INSERT INTO servers (server_name, ip_address, location, os, kernel, architecture, cpu_model, total_cores, total_threads, total_memory_gb, total_disk_gb, status) VALUES
('Atlas-Web-01', '192.168.1.10', 'New York, US', 'Ubuntu 22.04', '5.15.0-72-generic', 'x86_64', 'Intel(R) Xeon(R) CPU E5-2699 v4', 8, 16, 32, 500, 'online'),
('Atlas-DB-01', '192.168.1.11', 'London, UK', 'CentOS 8', '4.18.0-348.el8.x86_64', 'x86_64', 'Intel(R) Xeon(R) CPU E5-2690 v3', 16, 32, 64, 1000, 'online'),
('Atlas-Cache-01', '192.168.1.12', 'Tokyo, JP', 'Ubuntu 20.04', '5.4.0-150-generic', 'x86_64', 'Intel(R) Xeon(R) CPU E5-2670 v2', 4, 8, 16, 250, 'online'),
('Atlas-API-01', '192.168.1.13', 'Singapore', 'Debian 11', '5.10.0-23-amd64', 'x86_64', 'Intel(R) Xeon(R) CPU E5-2680 v3', 8, 16, 32, 500, 'offline');

-- Manual cleanup queries (run these periodically)
-- To delete old metrics (older than 7 days):
-- DELETE FROM metrics WHERE timestamp < DATE_SUB(NOW(), INTERVAL 7 DAY);

-- To mark offline servers (not seen in 5 minutes):
-- UPDATE servers SET status = 'offline' WHERE last_seen < DATE_SUB(NOW(), INTERVAL 5 MINUTE);

-- To delete servers not seen in 30 days (optional):
-- DELETE FROM servers WHERE last_seen < DATE_SUB(NOW(), INTERVAL 30 DAY);