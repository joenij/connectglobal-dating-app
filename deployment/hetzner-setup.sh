#!/bin/bash

# =============================================================================
# JNECONNECT.COM - HETZNER SERVER SETUP
# ConnectGlobal Dating App Production Deployment
# Server: 91.98.117.106 (CPX21)
# =============================================================================

set -e  # Exit on any error

echo "🚀 Starting JNEConnect.com Server Setup..."
echo "Server: $(hostname) - $(date)"
echo "=============================================="

# =============================================================================
# 1. SYSTEM UPDATE & BASIC SECURITY
# =============================================================================
echo "📦 Updating system packages..."
apt update && apt upgrade -y

echo "🔐 Installing essential security packages..."
apt install -y \
    ufw \
    fail2ban \
    htop \
    curl \
    wget \
    git \
    nano \
    unzip \
    certbot \
    python3-certbot-nginx

# =============================================================================
# 2. FIREWALL CONFIGURATION
# =============================================================================
echo "🛡️ Configuring UFW Firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# SSH (22)
ufw allow 22/tcp comment 'SSH Access'

# HTTP/HTTPS (80, 443)
ufw allow 80/tcp comment 'HTTP Web Traffic'
ufw allow 443/tcp comment 'HTTPS Web Traffic'

# ConnectGlobal Backend API (8000)
ufw allow 8000/tcp comment 'ConnectGlobal API'

# WebSocket Server (8001)
ufw allow 8001/tcp comment 'WebSocket Real-time'

# Enable firewall
ufw --force enable
ufw status verbose

# =============================================================================
# 3. FAIL2BAN CONFIGURATION
# =============================================================================
echo "🚫 Configuring Fail2Ban..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3
backend = systemd

[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 3
bantime = 3600
EOF

systemctl enable fail2ban
systemctl start fail2ban
systemctl status fail2ban --no-pager

# =============================================================================
# 4. DOCKER INSTALLATION
# =============================================================================
echo "🐳 Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
echo "🐳 Installing Docker Compose..."
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Start Docker
systemctl enable docker
systemctl start docker

# Test Docker installation
docker --version
docker-compose --version

# =============================================================================
# 5. NGINX INSTALLATION & BASIC CONFIG
# =============================================================================
echo "🌐 Installing and configuring Nginx..."
apt install -y nginx

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Create directory structure
mkdir -p /var/www/jneconnect.com
mkdir -p /var/log/nginx/jneconnect.com
mkdir -p /etc/nginx/sites-available
mkdir -p /etc/nginx/sites-enabled

# Basic Nginx configuration for jneconnect.com
cat > /etc/nginx/sites-available/jneconnect.com << 'EOF'
server {
    listen 80;
    server_name jneconnect.com www.jneconnect.com;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    # Logging
    access_log /var/log/nginx/jneconnect.com/access.log;
    error_log /var/log/nginx/jneconnect.com/error.log;
    
    # Temporary location (will be replaced after SSL setup)
    location / {
        return 200 "🚀 JNEConnect.com - ConnectGlobal Dating App Coming Soon!\nServer: $(hostname)\nTime: $(date)";
        add_header Content-Type text/plain;
    }
    
    # Health check endpoint
    location /health {
        return 200 "OK - JNEConnect.com Server Online";
        add_header Content-Type text/plain;
    }
    
    # API proxy (will be configured later)
    location /api/ {
        return 503 "ConnectGlobal API - Deployment in Progress";
        add_header Content-Type text/plain;
    }
}

# API subdomain
server {
    listen 80;
    server_name api.jneconnect.com;
    
    access_log /var/log/nginx/jneconnect.com/api-access.log;
    error_log /var/log/nginx/jneconnect.com/api-error.log;
    
    location / {
        return 503 "ConnectGlobal API - Deployment in Progress";
        add_header Content-Type text/plain;
    }
    
    location /health {
        return 200 "API Health Check - OK";
        add_header Content-Type text/plain;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/jneconnect.com /etc/nginx/sites-enabled/

# Test Nginx configuration
nginx -t

# Start Nginx
systemctl enable nginx
systemctl restart nginx
systemctl status nginx --no-pager

# =============================================================================
# 6. NODE.JS INSTALLATION
# =============================================================================
echo "⚡ Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verify installation
node --version
npm --version

# Install PM2 for process management
npm install -g pm2

# =============================================================================
# 7. CREATE APPLICATION DIRECTORIES
# =============================================================================
echo "📁 Creating application directories..."
mkdir -p /opt/jneconnect
mkdir -p /opt/jneconnect/backend
mkdir -p /opt/jneconnect/logs
mkdir -p /opt/jneconnect/ssl
mkdir -p /opt/jneconnect/backups

# Set permissions
chown -R www-data:www-data /var/www/jneconnect.com
chown -R root:root /opt/jneconnect
chmod -R 755 /opt/jneconnect

# =============================================================================
# 8. BASIC MONITORING SETUP
# =============================================================================
echo "📊 Setting up basic monitoring..."

# Create system monitoring script
cat > /opt/jneconnect/monitor.sh << 'EOF'
#!/bin/bash
# JNEConnect.com System Monitor

DATE=$(date '+%Y-%m-%d %H:%M:%S')
CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
MEMORY=$(free -m | awk 'NR==2{printf "%.1f%%", $3*100/$2 }')
DISK=$(df -h / | awk 'NR==2{print $5}')
LOAD=$(uptime | awk -F'load average:' '{ print $2 }')

echo "[$DATE] CPU: ${CPU}% | Memory: ${MEMORY} | Disk: ${DISK} | Load: ${LOAD}"
EOF

chmod +x /opt/jneconnect/monitor.sh

# Add to crontab for regular monitoring
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/jneconnect/monitor.sh >> /opt/jneconnect/logs/system.log") | crontab -

# =============================================================================
# 9. SSL PREPARATION (Let's Encrypt)
# =============================================================================
echo "🔐 Preparing SSL certificate setup..."
echo "Note: SSL certificates will be configured after DNS is pointing to this server"
echo "Domain: jneconnect.com -> 91.98.117.106"
echo "Run: certbot --nginx -d jneconnect.com -d www.jneconnect.com -d api.jneconnect.com"

# =============================================================================
# 10. DOCKER NETWORK SETUP
# =============================================================================
echo "🐳 Setting up Docker networks..."
docker network create jneconnect-network || true

# =============================================================================
# SETUP COMPLETE
# =============================================================================
echo ""
echo "✅ JNECONNECT.COM SERVER SETUP COMPLETE!"
echo "=============================================="
echo "Server IP: 91.98.117.106"
echo "Domain: jneconnect.com"
echo "Services:"
echo "  - Nginx: ✅ Running on ports 80/443"
echo "  - Docker: ✅ Ready for deployment"
echo "  - Firewall: ✅ Configured (SSH, HTTP, HTTPS, API)"
echo "  - Security: ✅ Fail2Ban active"
echo "  - Node.js: ✅ Ready for ConnectGlobal Backend"
echo ""
echo "🔧 NEXT STEPS:"
echo "1. Point jneconnect.com DNS to 91.98.117.106"
echo "2. Run SSL setup: certbot --nginx -d jneconnect.com -d www.jneconnect.com -d api.jneconnect.com"
echo "3. Deploy ConnectGlobal Dating App backend"
echo "4. Configure production database"
echo ""
echo "🌐 Test URLs:"
echo "  - http://jneconnect.com/health"
echo "  - http://api.jneconnect.com/health"
echo ""
echo "📊 Monitor system: /opt/jneconnect/monitor.sh"
echo "📝 Logs: /opt/jneconnect/logs/"
echo ""
echo "🚀 Ready for ConnectGlobal Dating App deployment!"
echo "=============================================="