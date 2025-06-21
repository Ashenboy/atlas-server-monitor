# Atlas Server Monitor 📊

**Real-time infrastructure monitoring dashboard built with React, Node.js, and MySQL.**  
Atlas Server Monitor helps you track CPU, memory, disk usage, and network traffic across multiple servers with beautiful visualizations and intelligent alerting.

---
![image](https://github.com/user-attachments/assets/ed6505c4-3390-4d86-9936-5c172f2225d1)
![image](https://github.com/user-attachments/assets/691b9697-8a36-4566-b631-84e60c1e21b0)


## ✨ Features

### 🎯 Real-Time Monitoring
- Live server metrics with WebSocket updates
- CPU, Memory, Disk usage tracking with progress bars
- Network traffic monitoring (Upload/Download)
- Health status: Healthy / Warning / Critical
- Auto-refresh every 30 seconds

### 📊 Dashboard Overview
- Server status (Online/Offline with colored indicators)
- Summary cards: Total servers, online/offline counts, average CPU
- Critical alert counter
- Manual and auto-refresh options

### 🖥️ Server Details
- System info: OS, Kernel, Architecture, CPU model
- Color-coded resource health indicators
- Hardware specs: Cores, Threads, RAM, Disk
- Uptime tracking (days/hours)
- Historical data for trend analysis

### 🔔 Intelligent Alerting
- Automatic health scores from resource usage
- Color indicators (Green, Yellow, Red)
- Real-time notifications via WebSocket
- Thresholds: Warning >70%, Critical >90%

### 🛡️ Production Ready
- MySQL optimized with schema/indexes
- Error handling and reconnection logic
- Old data auto-cleanup
- Scalable for unlimited servers
- Cross-platform agents: Linux + Windows

---

## 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  React Frontend │◄──►│  Node.js API    │◄──►│  MySQL Database │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                       ▲
         │                       │
         │ WebSocket             │ HTTP/JSON
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│  Live Dashboard │    │  Python Agents  │
└─────────────────┘    └─────────────────┘
```

---

## 🚀 Quick Start

### 📦 Prerequisites
- Node.js 16+
- MySQL 5.7+
- Python 3.7+
- npm or yarn

### 1. Clone the Repository
```bash
git clone https://github.com/Ashenboy/atlas-server-monitor.git
cd atlas-server-monitor
```

### 2. Database Setup
```bash
mysql -u your_user -p < database.sql
```

### 3. Backend Setup
```bash
cd backend
npm install

cp .env.example .env  # Edit DB credentials and API port
npm start
```

### 4. Frontend Setup
```bash
cd frontend
npm install

nano src/App.js  # Set backend API URL
npm start             # For development
npm run build         # For production
```

### 5. Deploy Agents

#### 🪟 Windows
```powershell
pip install psutil requests

Invoke-WebRequest -Uri "https://raw.githubusercontent.com/Ashenboy/atlas-server-monitor/refs/heads/main/agent/agent_windows.py" -OutFile "agent.py"

# Edit SERVER_URL inside agent.py
python agent.py
```

##### Windows as Service (Optional)
```powershell
choco install nssm
nssm install AtlasMonitor
# Configure path to Python and agent.py
nssm start AtlasMonitor
```

#### 🐧 Linux/Ubuntu
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install python3 python3-pip python3-psutil python3-requests -y

sudo mkdir -p /opt/atlas-monitor && cd /opt/atlas-monitor
sudo wget -O agent.py "https://raw.githubusercontent.com/Ashenboy/atlas-server-monitor/refs/heads/main/agent/agent_ubuntu.py"
sudo chmod +x agent.py
sudo nano agent.py  # Set SERVER_URL
python3 agent.py
```

##### SystemD Setup
```bash
sudo nano /etc/systemd/system/atlas-monitor.service
```

Paste:
```ini
[Unit]
Description=Atlas Server Monitor Agent
After=network.target

[Service]
ExecStart=/usr/bin/python3 /opt/atlas-monitor/agent.py
Restart=always
WorkingDirectory=/opt/atlas-monitor
User=root
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now atlas-monitor
sudo systemctl status atlas-monitor
```

---

## 📊 API Documentation

### 🔐 Register Server
**POST** `/check_register`  
```json
{
  "server_name": "web-server-01",
  "ip_address": "192.168.1.100",
  "location": "US East",
  "os": "Ubuntu 22.04",
  "kernel": "5.15.0",
  "architecture": "x86_64",
  "cpu_model": "Intel Xeon",
  "total_cores": 8,
  "total_threads": 16,
  "total_memory_gb": 32.0,
  "total_disk_gb": 500.0
}
```

### 📥 Submit Metrics
**POST** `/metrics/{server_id}`  
```json
{
  "cpu_usage": 25.5,
  "memory_usage": 68.2,
  "disk_usage": 45.8,
  "network_rx_gb": 120.5,
  "network_tx_gb": 89.3,
  "uptime": "86400"
}
```

### 📈 Fetch Dashboard Data
**GET** `/dashboard`  
```json
[
  {
    "server": {
      "id": 1,
      "server_name": "web-server-01",
      "status": "online",
      "location": "US East"
    },
    "latest_metrics": {
      "cpu_usage": 25.5,
      "memory_usage": 68.2,
      "health_status": "healthy"
    }
  }
]
```

---

## ⭐ Support This Project

If you found **Atlas Server Monitor** helpful, consider giving it a ⭐ star on GitHub!

---

**Made with ❤️ by [Ashen BoY]**
