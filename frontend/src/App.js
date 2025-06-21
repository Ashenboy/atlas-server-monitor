import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const API_URL = "http://localhost:4000"; // Update with your backend API URL

// Icons as React components (simple SVG icons)
const Icons = {
  CPU: () => (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v1a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 8a1 1 0 011-1h12a1 1 0 011 1v1a1 1 0 01-1 1H4a1 1 0 01-1-1V8zM4 11a1 1 0 00-1 1v1a1 1 0 001 1h12a1 1 0 001-1v-1a1 1 0 00-1-1H4z" clipRule="evenodd" />
    </svg>
  ),
  Memory: () => (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M5 2a1 1 0 000 2h10a1 1 0 100-2H5zM3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm4 1a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
    </svg>
  ),
  Disk: () => (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 011 1v1a1 1 0 01-1 1H4a1 1 0 01-1-1v-1zM3.293 13.707A1 1 0 014 13h12a1 1 0 01.707.293l1 1A1 1 0 0117 15v1a1 1 0 01-1 1H4a1 1 0 01-1-1v-1a1 1 0 01.293-.707l1-1z" clipRule="evenodd" />
    </svg>
  ),
  Network: () => (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
    </svg>
  ),
  Refresh: () => (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
    </svg>
  )
};

// Header Component
const Header = ({ servers, onRefresh, lastUpdated }) => {
  const total = servers.length;
  const online = servers.filter(s => s.server.status === 'online').length;
  const offline = total - online;
  const critical = servers.filter(s => {
    const m = s.latest_metrics;
    return m && m.health_status === 'critical';
  }).length;

  const avgCpu = servers.length > 0 
    ? Math.round(servers.reduce((acc, s) => 
        acc + (s.latest_metrics?.cpu_usage || 0), 0) / servers.length)
    : 0;

  return (
    <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-lg p-6 mb-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Atlas Server Monitor</h1>
          <p className="text-gray-600">Real-time infrastructure monitoring</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500 mb-2">
            Last Updated: {lastUpdated}
          </div>
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Icons.Refresh />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="text-right">
          <div className="text-sm text-gray-500">Total Servers</div>
          <div className="text-2xl font-bold text-gray-800">{total}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <SummaryCard 
          icon={<Icons.Disk />}
          title="Online Servers" 
          value={online} 
          bgColor="bg-green-50" 
          iconColor="text-green-600"
          textColor="text-green-800"
        />
        <SummaryCard 
          icon={<Icons.Memory />}
          title="Offline Servers" 
          value={offline} 
          bgColor="bg-red-50" 
          iconColor="text-red-600"
          textColor="text-red-800"
        />
        <SummaryCard 
          icon={<Icons.CPU />}
          title="Avg CPU Usage" 
          value={`${avgCpu}%`} 
          bgColor="bg-blue-50" 
          iconColor="text-blue-600"
          textColor="text-blue-800"
        />
        <SummaryCard 
          icon={<Icons.Network />}
          title="Critical Alerts" 
          value={critical} 
          bgColor="bg-orange-50" 
          iconColor="text-orange-600"
          textColor="text-orange-800"
        />
      </div>
    </div>
  );
};

const SummaryCard = ({ icon, title, value, bgColor, iconColor, textColor }) => (
  <div className={`${bgColor} rounded-lg p-4 border border-gray-200`}>
    <div className="flex items-center gap-3">
      <div className={`${iconColor} p-2 rounded-lg bg-white`}>
        {icon}
      </div>
      <div>
        <div className={`text-2xl font-bold ${textColor}`}>{value}</div>
        <div className="text-sm text-gray-600">{title}</div>
      </div>
    </div>
  </div>
);

// Individual Server Monitor Component
const ServerMonitor = ({ server, metrics }) => {
  const formatUptime = (uptimeSeconds) => {
    if (!uptimeSeconds) return 'Unknown';
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    return `${days}d ${hours}h`;
  };

  const getHealthColor = (status) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'text-green-600 bg-green-50';
      case 'offline': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const isOnline = server.status === 'online' && metrics;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-3 h-3 rounded-full ${server.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <h3 className="font-semibold text-gray-800">{server.server_name}</h3>
              <span className={`text-xs px-2 py-1 rounded-full uppercase font-medium ${getStatusColor(server.status)}`}>
                {server.status}
              </span>
            </div>
            <div className="text-sm text-gray-500">{server.location}</div>
          </div>
          {isOnline && (
            <div className="text-right">
              <div className="text-xs text-gray-500">Network Traffic</div>
              <div className="text-sm font-medium text-blue-600">ACTIVE</div>
            </div>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="p-4">
        {isOnline ? (
          <>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <MetricCard 
                icon={<Icons.CPU />}
                label="CPU Usage"
                value={`${Math.round(metrics.cpu_usage)}%`}
                percentage={metrics.cpu_usage}
                color="blue"
              />
              <MetricCard 
                icon={<Icons.Memory />}
                label="Memory Usage"
                value={`${Math.round(metrics.memory_usage)}%`}
                percentage={metrics.memory_usage}
                color="purple"
              />
              <MetricCard 
                icon={<Icons.Disk />}
                label="Disk Usage"
                value={`${Math.round(metrics.disk_usage)}%`}
                percentage={metrics.disk_usage}
                color="green"
              />
              <MetricCard 
                icon={<Icons.Network />}
                label="Network Traffic"
                value="ACTIVE"
                isActive={true}
                color="orange"
              />
            </div>

            {/* Network Stats */}
            <div className="mb-4 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-blue-600">↓ Total data received</span>
                <span className="font-medium">{metrics.network_rx_gb} GB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-600">↑ Total data sent</span>
                <span className="font-medium">{metrics.network_tx_gb} GB</span>
              </div>
            </div>

            {/* System Information & Resource Health */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              <div>
                <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                  System Information
                </h4>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Operating System</span>
                    <span className="font-medium">{server.os}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Kernel</span>
                    <span className="font-medium">{server.kernel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Architecture</span>
                    <span className="font-medium">{server.architecture}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">CPU Model</span>
                    <span className="font-medium">{server.cpu_model}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                  Resource Health
                </h4>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">CPU Health</span>
                    <span className="font-medium text-green-600">Excellent</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Memory Health</span>
                    <span className="font-medium text-green-600">Optimal</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Disk Health</span>
                    <span className="font-medium text-green-600">Healthy</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Overall Status</span>
                    <span className={`font-medium ${getHealthColor(metrics.health_status)}`}>
                      {metrics.health_status?.charAt(0).toUpperCase() + metrics.health_status?.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Hardware Info */}
            <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-600">
              <div className="flex justify-between items-center">
                <div>{server.total_cores} cores / {server.total_threads} threads</div>
                <div>Uptime: {formatUptime(metrics.uptime)}</div>
              </div>
              <div className="flex justify-between items-center mt-1">
                <div>{server.total_memory_gb} GB RAM</div>
                <div>Updated: {new Date(metrics.timestamp).toLocaleTimeString()}</div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="text-red-500 text-4xl mb-2">⚠</div>
            <div className="text-lg font-semibold text-red-600 mb-1">OFFLINE</div>
            <div className="text-sm text-gray-500">
              Server is not responding
            </div>
            <div className="text-xs text-gray-400 mt-2">
              Last seen: {server.last_seen ? new Date(server.last_seen).toLocaleString() : 'Never'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const MetricCard = ({ icon, label, value, percentage, color, isActive }) => {
  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-50 text-blue-600',
      purple: 'bg-purple-50 text-purple-600',
      green: 'bg-green-50 text-green-600',
      orange: 'bg-orange-50 text-orange-600'
    };
    return colors[color] || colors.blue;
  };

  const getProgressColor = (percentage) => {
    if (percentage > 90) return 'bg-red-500';
    if (percentage > 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="text-center">
      <div className={`w-12 h-12 rounded-lg ${getColorClasses(color)} flex items-center justify-center mx-auto mb-2`}>
        {icon}
      </div>
      <div className="text-lg font-bold text-gray-800">{value}</div>
      <div className="text-xs text-gray-500 mb-2">{label}</div>
      {!isActive && percentage !== undefined && (
        <div className="w-full bg-gray-200 h-1 rounded-full">
          <div 
            className={`h-1 rounded-full ${getProgressColor(percentage)}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          ></div>
        </div>
      )}
    </div>
  );
};

// Main App Component
function App() {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await axios.get(`${API_URL}/dashboard`);
      setServers(response.data);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    
    // Setup WebSocket connection
    const socket = io(API_URL);
    
    socket.on('connect', () => {
      console.log('Connected to Atlas Monitor');
    });
    
    socket.on('metrics_update', (data) => {
      console.log('Received metrics update:', data);
      fetchData(); // Refresh all data when any server updates
    });
    
    socket.on('disconnect', () => {
      console.log('Disconnected from Atlas Monitor');
    });

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-lg font-semibold text-gray-700">Loading Atlas Server Monitor...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg">
          <div className="text-red-500 text-4xl mb-4">⚠</div>
          <div className="text-lg font-semibold text-red-600 mb-2">Connection Error</div>
          <div className="text-gray-600 mb-4">{error}</div>
          <button 
            onClick={fetchData}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Header 
          servers={servers} 
          onRefresh={fetchData}
          lastUpdated={lastUpdated}
        />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-6">
          {servers.map((item, idx) => (
            <ServerMonitor
              key={`${item.server.id}-${idx}`}
              server={item.server}
              metrics={item.latest_metrics}
            />
          ))}
        </div>

        {servers.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📊</div>
            <div className="text-xl font-semibold text-gray-600 mb-2">No Servers Detected</div>
            <div className="text-gray-500">
              Install and run the Atlas monitoring agent on your servers to see them here.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;