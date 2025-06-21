const express = require('express');
const cors = require('cors');
const db = require('./db');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    origin: '*',
    methods: ['GET', 'POST']
  } 
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Enhanced server registration with better error handling
app.post('/check_register', async (req, res) => {
  try {
    const data = req.body;
    
    // Validate required fields
    const requiredFields = ['server_name', 'ip_address', 'os'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }

    const [rows] = await db.execute(
      `SELECT id FROM servers WHERE server_name = ? AND ip_address = ?`,
      [data.server_name, data.ip_address]
    );

    if (rows.length > 0) {
      // Update existing server info
      await db.execute(
        `UPDATE servers SET 
         location = ?, os = ?, kernel = ?, architecture = ?, cpu_model = ?, 
         total_cores = ?, total_threads = ?, total_memory_gb = ?, total_disk_gb = ?,
         last_seen = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          data.location || 'Unknown',
          data.os,
          data.kernel || '',
          data.architecture || '',
          data.cpu_model || '',
          data.total_cores || 0,
          data.total_threads || 0,
          data.total_memory_gb || 0,
          data.total_disk_gb || 0,
          rows[0].id
        ]
      );
      
      res.json({ id: rows[0].id, status: 'updated' });
    } else {
      // Insert new server
      const [result] = await db.execute(
        `INSERT INTO servers (
          server_name, ip_address, location, os, kernel, architecture, 
          cpu_model, total_cores, total_threads, total_memory_gb, total_disk_gb,
          status, last_seen
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'online', CURRENT_TIMESTAMP)`,
        [
          data.server_name,
          data.ip_address,
          data.location || 'Unknown',
          data.os,
          data.kernel || '',
          data.architecture || '',
          data.cpu_model || '',
          data.total_cores || 0,
          data.total_threads || 0,
          data.total_memory_gb || 0,
          data.total_disk_gb || 0
        ]
      );
      
      res.json({ id: result.insertId, status: 'registered' });
    }
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server registration failed' });
  }
});

// Enhanced metrics endpoint with health status calculation
app.post('/metrics/:server_id', async (req, res) => {
  try {
    const { server_id } = req.params;
    const data = req.body;

    console.log(`Received metrics from server ${server_id}:`, data);

    // Calculate health status
    const cpu = parseFloat(data.cpu_usage) || 0;
    const memory = parseFloat(data.memory_usage) || 0;
    const disk = parseFloat(data.disk_usage) || 0;
    
    let health_status = 'healthy';
    if (cpu > 90 || memory > 90 || disk > 95) {
      health_status = 'critical';
    } else if (cpu > 70 || memory > 70 || disk > 80) {
      health_status = 'warning';
    }

    // Insert metrics
    await db.execute(
      `INSERT INTO metrics (
        server_id, cpu_usage, memory_usage, disk_usage, 
        network_rx_gb, network_tx_gb, uptime, health_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        server_id,
        cpu,
        memory,
        disk,
        parseFloat(data.network_rx_gb) || 0,
        parseFloat(data.network_tx_gb) || 0,
        data.uptime || '0',
        health_status
      ]
    );

    // Update server status and last_seen - this is crucial!
    const updateResult = await db.execute(
      `UPDATE servers SET status = 'online', last_seen = NOW() WHERE id = ?`,
      [server_id]
    );

    console.log(`Updated server ${server_id} status to online, affected rows:`, updateResult[0].affectedRows);

    // Emit real-time update
    io.emit('metrics_update', { 
      server_id: parseInt(server_id), 
      data: { ...data, health_status }
    });
    
    res.json({ success: true, health_status, server_updated: updateResult[0].affectedRows > 0 });
  } catch (err) {
    console.error('Metrics error:', err);
    res.status(500).json({ error: 'Failed to save metrics' });
  }
});

// Enhanced dashboard endpoint with better data structure
app.get('/dashboard', async (req, res) => {
  try {
    // Mark servers as offline if not seen in last 2 minutes (more reasonable timeout)
    await db.execute(
      `UPDATE servers SET status = 'offline' 
       WHERE last_seen < DATE_SUB(NOW(), INTERVAL 2 MINUTE)`
    );

    const [servers] = await db.query(`
      SELECT s.*, 
        TIMESTAMPDIFF(SECOND, s.last_seen, NOW()) as seconds_since_last_seen
      FROM servers s 
      ORDER BY s.server_name
    `);

    const result = [];

    for (const server of servers) {
      // Get latest metrics (within last 2 minutes)
      const [metrics] = await db.query(
        `SELECT *, TIMESTAMPDIFF(SECOND, timestamp, NOW()) as age_seconds
         FROM metrics 
         WHERE server_id = ? 
         AND timestamp >= DATE_SUB(NOW(), INTERVAL 2 MINUTE)
         ORDER BY timestamp DESC 
         LIMIT 1`,
        [server.id]
      );

      // Determine actual status based on recent metrics and last_seen
      let actualStatus = 'offline';
      if (metrics.length > 0 && server.seconds_since_last_seen <= 120) {
        actualStatus = 'online';
      }

      result.push({
        server: {
          ...server,
          status: actualStatus
        },
        latest_metrics: metrics[0] || null
      });
    }

    res.json(result);
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Get individual server details
app.get('/server/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [servers] = await db.query('SELECT * FROM servers WHERE id = ?', [id]);
    if (servers.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const [metrics] = await db.query(
      'SELECT * FROM metrics WHERE server_id = ? ORDER BY timestamp DESC LIMIT 1',
      [id]
    );

    const [historicalMetrics] = await db.query(
      `SELECT cpu_usage, memory_usage, disk_usage, timestamp
       FROM metrics 
       WHERE server_id = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
       ORDER BY timestamp DESC`,
      [id]
    );

    res.json({
      server: servers[0],
      latest_metrics: metrics[0] || null,
      historical_metrics: historicalMetrics
    });
  } catch (err) {
    console.error('Server details error:', err);
    res.status(500).json({ error: 'Failed to fetch server details' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Serve React app for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`🚀 Atlas Server Monitor Backend running on port ${PORT}`);
  console.log(`📊 Dashboard available at: http://localhost:${PORT}`);
});