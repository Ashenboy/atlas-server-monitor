# Configuration
SERVER_URL = 'http://localhost:4000' # Change to your server Backend URL
METRICS_INTERVAL = 10  # seconds
MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds

import psutil
import platform
import requests
import time
import socket
import sys
import logging
import subprocess
import os
from datetime import datetime

# Fix Windows console encoding issues
if sys.platform == 'win32':
    # Set console to UTF-8
    try:
        import codecs
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer)
        sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer)
    except:
        pass

# Setup logging (Windows-compatible)
class SafeFormatter(logging.Formatter):
    """Safe formatter that handles encoding issues"""
    def format(self, record):
        try:
            return super().format(record)
        except UnicodeEncodeError:
            # Fallback to ASCII-safe formatting
            record.msg = str(record.msg).encode('ascii', 'ignore').decode('ascii')
            return super().format(record)

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Console handler
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(SafeFormatter('%(asctime)s - %(levelname)s - %(message)s'))

# File handler
try:
    file_handler = logging.FileHandler('atlas_agent.log', encoding='utf-8')
    file_handler.setFormatter(SafeFormatter('%(asctime)s - %(levelname)s - %(message)s'))
    logger.addHandler(file_handler)
except:
    # Fallback if file creation fails
    pass

logger.addHandler(console_handler)

class AtlasAgent:
    def __init__(self):
        self.server_id = None
        self.server_info = None
        self.session = requests.Session()
        self.session.timeout = 10
        
    def get_server_info(self):
        """Collect comprehensive server information"""
        try:
            # Get CPU information
            cpu_info = self.get_cpu_info()
            
            # Get memory information
            memory = psutil.virtual_memory()
            
            # Get disk information  
            disk = psutil.disk_usage('C:' if sys.platform == 'win32' else '/')
            
            # Get network interface
            hostname = socket.gethostname()
            try:
                ip_address = socket.gethostbyname(hostname)
                # Try to get a more accurate IP if possible
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.connect(("8.8.8.8", 80))
                ip_address = s.getsockname()[0]
                s.close()
            except:
                ip_address = '127.0.0.1'
            
            server_info = {
                "server_name": hostname,
                "ip_address": ip_address,
                "location": self.get_location(),
                "os": f"{platform.system()} {platform.release()}",
                "kernel": platform.version(),
                "architecture": platform.machine(),
                "cpu_model": cpu_info.get('model', platform.processor()),
                "total_cores": psutil.cpu_count(logical=False) or 1,
                "total_threads": psutil.cpu_count(logical=True) or 1,
                "total_memory_gb": round(memory.total / (1024**3), 2),
                "total_disk_gb": round(disk.total / (1024**3), 2)
            }
            
            logger.info(f"Server info collected: {server_info['server_name']} ({server_info['ip_address']})")
            return server_info
            
        except Exception as e:
            logger.error(f"Error collecting server info: {e}")
            # Return minimal info
            return {
                "server_name": socket.gethostname(),
                "ip_address": "127.0.0.1",
                "location": "Unknown",
                "os": platform.system(),
                "kernel": platform.release(),
                "architecture": platform.machine(),
                "cpu_model": "Unknown",
                "total_cores": 1,
                "total_threads": 1,
                "total_memory_gb": 1.0,
                "total_disk_gb": 1.0
            }

    def get_cpu_info(self):
        """Get detailed CPU information"""
        cpu_info = {"model": "Unknown"}
        
        try:
            if platform.system() == "Windows":
                # Use wmic command for Windows
                try:
                    result = subprocess.run(['wmic', 'cpu', 'get', 'name'], 
                                          capture_output=True, text=True, shell=True)
                    if result.returncode == 0:
                        lines = result.stdout.strip().split('\n')
                        if len(lines) > 1:
                            cpu_info['model'] = lines[1].strip()
                except Exception as e:
                    logger.debug(f"Could not get CPU info via wmic: {e}")
                    
            elif platform.system() == "Linux":
                # Try to read from /proc/cpuinfo
                with open('/proc/cpuinfo', 'r') as f:
                    for line in f:
                        if 'model name' in line:
                            cpu_info['model'] = line.split(':')[1].strip()
                            break
            elif platform.system() == "Darwin":  # macOS
                result = subprocess.run(['sysctl', '-n', 'machdep.cpu.brand_string'], 
                                      capture_output=True, text=True)
                if result.returncode == 0:
                    cpu_info['model'] = result.stdout.strip()
        except Exception as e:
            logger.debug(f"Could not get detailed CPU info: {e}")
            
        return cpu_info

    def get_location(self):
        """Try to determine server location"""
        try:
            # You can customize this based on your infrastructure
            # For now, we'll use a simple mapping or environment variable
            location = os.environ.get('ATLAS_LOCATION')
            if location:
                return location
                
            # Try to determine from hostname patterns
            hostname = socket.gethostname().lower()
            if 'web' in hostname:
                return "Web Server Farm"
            elif 'db' in hostname:
                return "Database Cluster"
            elif 'cache' in hostname:
                return "Cache Layer"
            elif 'api' in hostname:
                return "API Gateway"
            else:
                return "Datacenter-01"
        except:
            return "Unknown"

    def check_or_register(self):
        """Register server or get existing server ID"""
        for attempt in range(MAX_RETRIES):
            try:
                self.server_info = self.get_server_info()
                
                response = self.session.post(
                    f'{SERVER_URL}/check_register', 
                    json=self.server_info,
                    headers={'Content-Type': 'application/json'}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    self.server_id = data['id']
                    logger.info(f"Successfully registered/connected as server ID: {self.server_id}")
                    return self.server_id
                else:
                    logger.error(f"Registration failed with status {response.status_code}: {response.text}")
                    
            except requests.exceptions.ConnectionError:
                logger.error(f"Connection failed (attempt {attempt + 1}/{MAX_RETRIES})")
            except Exception as e:
                logger.error(f"Registration error (attempt {attempt + 1}/{MAX_RETRIES}): {e}")
            
            if attempt < MAX_RETRIES - 1:
                logger.info(f"Retrying in {RETRY_DELAY} seconds...")
                time.sleep(RETRY_DELAY)
        
        logger.error("Failed to register after all attempts")
        sys.exit(1)

    def collect_metrics(self):
        """Collect system metrics"""
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            
            # Memory usage
            memory = psutil.virtual_memory()
            
            # Disk usage
            if sys.platform == 'win32':
                disk = psutil.disk_usage('C:')
            else:
                disk = psutil.disk_usage('/')
            
            # Network I/O
            net_io = psutil.net_io_counters()
            
            # Calculate uptime
            boot_time = psutil.boot_time()
            uptime_seconds = int(time.time() - boot_time)
            
            metrics = {
                "cpu_usage": round(cpu_percent, 2),
                "memory_usage": round(memory.percent, 2),
                "disk_usage": round((disk.used / disk.total) * 100, 2),
                "network_rx_gb": round(net_io.bytes_recv / (1024**3), 3),
                "network_tx_gb": round(net_io.bytes_sent / (1024**3), 3),
                "uptime": str(uptime_seconds)
            }
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error collecting metrics: {e}")
            # Return safe defaults
            return {
                "cpu_usage": 0.0,
                "memory_usage": 0.0,
                "disk_usage": 0.0,
                "network_rx_gb": 0.0,
                "network_tx_gb": 0.0,
                "uptime": "0"
            }

    def send_metrics(self, metrics):
        """Send metrics to server"""
        try:
            response = self.session.post(
                f'{SERVER_URL}/metrics/{self.server_id}',
                json=metrics,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                logger.debug(f"Metrics sent successfully: CPU={metrics['cpu_usage']}%, MEM={metrics['memory_usage']}%, DISK={metrics['disk_usage']}%")
                return True
            else:
                logger.warning(f"Metrics send failed with status {response.status_code}")
                return False
                
        except requests.exceptions.ConnectionError:
            logger.warning("Connection lost, will retry...")
            return False
        except Exception as e:
            logger.error(f"Error sending metrics: {e}")
            return False

    def run(self):
        """Main monitoring loop"""
        logger.info("Starting Atlas Server Monitor Agent")
        
        # Initial registration
        self.check_or_register()
        
        consecutive_failures = 0
        max_consecutive_failures = 5
        
        logger.info(f"Starting metrics collection (interval: {METRICS_INTERVAL}s)")
        
        while True:
            try:
                # Collect metrics
                metrics = self.collect_metrics()
                
                # Send metrics
                if self.send_metrics(metrics):
                    consecutive_failures = 0
                else:
                    consecutive_failures += 1
                    
                # If too many consecutive failures, try to re-register
                if consecutive_failures >= max_consecutive_failures:
                    logger.warning("Too many consecutive failures, attempting to re-register...")
                    try:
                        self.check_or_register()
                        consecutive_failures = 0
                    except:
                        logger.error("Re-registration failed")
                
                time.sleep(METRICS_INTERVAL)
                
            except KeyboardInterrupt:
                logger.info("Shutting down Atlas Monitor Agent")
                break
            except Exception as e:
                logger.error(f"Unexpected error in main loop: {e}")
                time.sleep(METRICS_INTERVAL)

def main():
    """Entry point"""
    print("Atlas Server Monitor Agent - Windows Compatible")
    print("=" * 50)
    
    try:
        agent = AtlasAgent()
        agent.run()
    except KeyboardInterrupt:
        logger.info("Agent stopped by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()