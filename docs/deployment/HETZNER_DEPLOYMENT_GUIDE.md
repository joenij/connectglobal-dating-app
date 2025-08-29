# ConnectGlobal Hetzner Deployment Guide
## Complete Self-Hosted Setup with Mail Server

This guide walks you through deploying ConnectGlobal on a Hetzner server with a self-hosted mail server for complete control and unlimited emails.

## 🏢 **Why Self-Hosted on Hetzner?**

### **Benefits:**
- ✅ **Full Control**: Complete control over your infrastructure
- ✅ **Cost Effective**: €3-10/month for powerful VPS (vs $50+/month cloud)
- ✅ **Unlimited Emails**: No external service limits or costs
- ✅ **Data Sovereignty**: Your data stays in your control
- ✅ **Custom Domain**: Professional email addresses
- ✅ **High Performance**: Hetzner's excellent network and hardware

### **What You'll Have:**
- ConnectGlobal dating app running on your domain
- Self-hosted SMTP server for unlimited emails
- PostgreSQL database with automated backups  
- Redis cache for enterprise features
- SSL certificates with automatic renewal
- Monitoring and logging

---

## 📋 **Prerequisites**

### **Required:**
1. **Domain Name** (e.g., `connectglobal.app`)
2. **Hetzner Account** (https://www.hetzner.com/)
3. **Basic Linux Knowledge** (following commands is sufficient)

### **Recommended Server Specs:**
- **Starter**: CPX11 (2 vCPU, 4GB RAM) - €4.90/month
- **Recommended**: CPX21 (3 vCPU, 8GB RAM) - €7.90/month
- **High Traffic**: CPX31 (4 vCPU, 16GB RAM) - €15.90/month

---

## 🚀 **Step 1: Server Setup**

### **1.1 Create Hetzner Server**

1. Login to [Hetzner Cloud Console](https://console.hetzner-cloud.com/)
2. Create new project: `connectglobal-production`
3. Add server:
   - **Location**: Nuremberg or Helsinki (GDPR compliant)
   - **Image**: Ubuntu 22.04 LTS
   - **Type**: CPX21 (recommended)
   - **Name**: `connectglobal-prod-01`
4. Add SSH key or set root password
5. Create server

### **1.2 Initial Server Configuration**

SSH into your server:
```bash
ssh root@your-server-ip
```

Update system and install essentials:
```bash
# Update system
apt update && apt upgrade -y

# Install essential packages
apt install -y curl wget git ufw nginx certbot python3-certbot-nginx 
apt install -y docker.io docker-compose nodejs npm postgresql postgresql-contrib redis-server

# Enable services
systemctl enable docker
systemctl enable nginx
systemctl enable postgresql
systemctl enable redis-server

# Start services
systemctl start docker
systemctl start nginx
systemctl start postgresql
systemctl start redis-server
```

### **1.3 Configure Firewall**

```bash
# Configure UFW firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 25/tcp    # SMTP
ufw allow 587/tcp   # SMTP Submission
ufw allow 993/tcp   # IMAPS (optional)
ufw enable
```

---

## 🌐 **Step 2: Domain Configuration**

### **2.1 DNS Records Setup**

Configure these DNS records at your domain registrar:

```dns
# Main application
A     @                 your-server-ip
A     www               your-server-ip

# Mail server
A     mail              your-server-ip
MX    @         10      mail.yourdomain.com

# Email authentication (critical for deliverability)
TXT   @                 "v=spf1 mx a ~all"
TXT   _dmarc            "v=DMARC1; p=none; rua=mailto:postmaster@yourdomain.com"

# DKIM will be added after mail server setup
```

### **2.2 Verify DNS Propagation**

```bash
# Check DNS propagation
dig yourdomain.com
dig mail.yourdomain.com
dig -t MX yourdomain.com
```

---

## 📧 **Step 3: Self-Hosted Mail Server Setup**

### **3.1 Install Docker Mail Server**

```bash
# Create mail directory
mkdir -p /opt/mailserver
cd /opt/mailserver

# Download docker-mailserver
wget https://raw.githubusercontent.com/docker-mailserver/docker-mailserver/master/compose.yaml
wget https://raw.githubusercontent.com/docker-mailserver/docker-mailserver/master/mailserver.env
```

### **3.2 Configure Mail Server**

Edit `mailserver.env`:
```env
# Basic settings
HOSTNAME=mail.yourdomain.com
DOMAINNAME=yourdomain.com
CONTAINER_NAME=mailserver

# Security
SSL_TYPE=letsencrypt
SSL_CERT_PATH=/etc/letsencrypt/live/mail.yourdomain.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/mail.yourdomain.com/privkey.pem

# Authentication
ENABLE_SPAMASSASSIN=1
ENABLE_CLAMAV=1
ENABLE_FAIL2BAN=1
ENABLE_POSTGREY=1

# SMTP settings
SMTP_ONLY=0
ENABLE_POP3=0
ENABLE_CLAMAV=1
```

### **3.3 Get SSL Certificate for Mail Server**

```bash
# Get SSL certificate for mail subdomain
certbot certonly --nginx -d mail.yourdomain.com

# Verify certificate
ls -la /etc/letsencrypt/live/mail.yourdomain.com/
```

### **3.4 Start Mail Server**

```bash
cd /opt/mailserver

# Start mail server
docker-compose up -d

# Check logs
docker-compose logs -f mailserver
```

### **3.5 Create Email Accounts**

```bash
# Create system email accounts
docker exec -it mailserver setup email add noreply@yourdomain.com your-strong-password
docker exec -it mailserver setup email add admin@yourdomain.com your-admin-password
docker exec -it mailserver setup email add support@yourdomain.com your-support-password

# List accounts
docker exec -it mailserver setup email list
```

### **3.6 Configure DKIM**

```bash
# Generate DKIM key
docker exec -it mailserver setup config dkim

# Get DKIM record for DNS
docker exec -it mailserver setup config dkim domain yourdomain.com

# Copy the output and add as TXT record: mail._domainkey.yourdomain.com
```

### **3.7 Test Mail Server**

```bash
# Test SMTP connection
telnet localhost 587

# Test sending email
echo "Subject: Test Email
Test message from ConnectGlobal mail server" | sendmail -f noreply@yourdomain.com admin@yourdomain.com

# Check mail logs
docker-compose logs mailserver | tail -50
```

---

## 🗄️ **Step 4: Database Setup**

### **4.1 Configure PostgreSQL**

```bash
# Switch to postgres user
sudo -u postgres psql

-- Create database and user
CREATE DATABASE connectglobal_prod;
CREATE USER connectglobal_user WITH ENCRYPTED PASSWORD 'your-super-secure-database-password';
GRANT ALL PRIVILEGES ON DATABASE connectglobal_prod TO connectglobal_user;
ALTER USER connectglobal_user CREATEDB;
\q
```

### **4.2 Configure Redis**

```bash
# Edit Redis configuration
nano /etc/redis/redis.conf

# Add password
requirepass your-redis-password

# Restart Redis
systemctl restart redis-server

# Test Redis
redis-cli
AUTH your-redis-password
ping
exit
```

---

## 🔧 **Step 5: Application Deployment**

### **5.1 Clone Repository**

```bash
# Create app directory
mkdir -p /opt/connectglobal
cd /opt/connectglobal

# Clone your repository
git clone https://github.com/yourusername/connectglobal-dating-app.git .

# Install dependencies
cd backend
npm install --production

# Build frontend (if needed)
cd ../frontend
npm install
npm run build
```

### **5.2 Environment Configuration**

Create production environment file:
```bash
cd /opt/connectglobal
cp .env.example .env
nano .env
```

Configure your `.env`:
```env
# Application
NODE_ENV=production
PORT=8000
API_VERSION=v1
FRONTEND_URL=https://yourdomain.com

# Database
DATABASE_URL=postgresql://connectglobal_user:your-super-secure-database-password@localhost:5432/connectglobal_prod

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Self-Hosted SMTP (YOUR NEW SETUP!)
SELF_HOSTED_SMTP=true
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-strong-password
FROM_EMAIL=noreply@yourdomain.com

# JWT Security
JWT_SECRET=your-256-bit-random-hex-key-here-generated-with-crypto
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Security
CORS_ORIGIN=https://yourdomain.com
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000

# SSL
SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

### **5.3 Database Migration**

```bash
cd /opt/connectglobal/backend

# Run database migrations
npm run db:migrate

# Seed initial data (optional)
npm run db:seed

# Validate deployment
npm run validate-deployment
```

---

## 🌐 **Step 6: Nginx Configuration**

### **6.1 Create Nginx Configuration**

```bash
nano /etc/nginx/sites-available/connectglobal
```

```nginx
# ConnectGlobal Production Configuration
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # API Proxy
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout       60s;
        proxy_send_timeout          60s;
        proxy_read_timeout          60s;
    }

    # Static Files
    location / {
        root /opt/connectglobal/frontend/build;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Health check
    location /health {
        proxy_pass http://localhost:8000/health;
        access_log off;
    }

    # Uploads
    location /uploads/ {
        root /opt/connectglobal/backend;
        expires 1y;
        add_header Cache-Control "public";
    }
}
```

### **6.2 Enable Site and Get SSL**

```bash
# Enable site
ln -s /etc/nginx/sites-available/connectglobal /etc/nginx/sites-enabled/

# Test configuration
nginx -t

# Get SSL certificate
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Reload nginx
systemctl reload nginx
```

---

## ⚙️ **Step 7: Process Management with PM2**

### **7.1 Install and Configure PM2**

```bash
# Install PM2 globally
npm install -g pm2

# Create PM2 ecosystem file
cd /opt/connectglobal
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'connectglobal-api',
    script: './backend/src/server.js',
    cwd: '/opt/connectglobal',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 8000
    },
    error_file: './logs/api-error.log',
    out_file: './logs/api-out.log',
    log_file: './logs/api-combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }],

  deploy: {
    production: {
      user: 'root',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'https://github.com/yourusername/connectglobal-dating-app.git',
      path: '/opt/connectglobal',
      'post-deploy': 'cd backend && npm install --production && pm2 reload ecosystem.config.js --env production'
    }
  }
};
```

### **7.2 Start Application**

```bash
# Create logs directory
mkdir -p /opt/connectglobal/logs

# Start application with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup
pm2 startup systemd
# Follow the command output instructions

# Check application status
pm2 status
pm2 logs connectglobal-api
```

---

## 🔍 **Step 8: Monitoring and Maintenance**

### **8.1 Setup Log Rotation**

```bash
# Configure logrotate
nano /etc/logrotate.d/connectglobal
```

```logrotate
/opt/connectglobal/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    copytruncate
    notifempty
    postrotate
        pm2 reloadLogs
    endscript
}
```

### **8.2 Automated Backups**

```bash
# Create backup script
nano /opt/scripts/backup-connectglobal.sh
```

```bash
#!/bin/bash
# ConnectGlobal Backup Script

BACKUP_DIR="/opt/backups/connectglobal"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
pg_dump connectglobal_prod > $BACKUP_DIR/database_$DATE.sql

# Redis backup
cp /var/lib/redis/dump.rdb $BACKUP_DIR/redis_$DATE.rdb

# Application files backup
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /opt/connectglobal --exclude=node_modules --exclude=logs

# Mail server backup
tar -czf $BACKUP_DIR/mail_$DATE.tar.gz /opt/mailserver

# Keep only last 30 days of backups
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.rdb" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

```bash
# Make executable
chmod +x /opt/scripts/backup-connectglobal.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /opt/scripts/backup-connectglobal.sh >> /var/log/backup.log 2>&1
```

### **8.3 SSL Certificate Auto-Renewal**

```bash
# Test renewal
certbot renew --dry-run

# Renewal is automatic via systemd timer
systemctl status certbot.timer
```

---

## 🧪 **Step 9: Testing and Validation**

### **9.1 Application Testing**

```bash
# Health check
curl https://yourdomain.com/health

# API test
curl https://yourdomain.com/api/v1/health

# Mail server test
echo "Subject: Production Test
ConnectGlobal is live!" | sendmail -f noreply@yourdomain.com admin@yourdomain.com
```

### **9.2 Performance Testing**

```bash
# Install tools
apt install -y apache2-utils

# Load test API
ab -n 1000 -c 10 https://yourdomain.com/api/v1/health

# Monitor resources
htop
iotop
```

### **9.3 Security Testing**

```bash
# Port scan
nmap -sS yourdomain.com

# SSL test
curl -I https://yourdomain.com

# Check mail server reputation
# Visit: https://www.mail-tester.com/
# Send test email to provided address
```

---

## 📋 **Step 10: Go Live Checklist**

### **Before Launch:**

- [ ] Domain DNS records configured and propagated
- [ ] SSL certificates installed and working
- [ ] Mail server DKIM/SPF/DMARC configured
- [ ] Database migrated and tested
- [ ] Application deployed and running
- [ ] Environment validation passed (`npm run validate-deployment`)
- [ ] Backup system configured and tested
- [ ] Monitoring set up
- [ ] Security scan completed
- [ ] Performance test passed
- [ ] Email delivery test successful

### **Launch Day:**

- [ ] Final database backup
- [ ] Switch DNS to production server
- [ ] Monitor application logs
- [ ] Test all critical features
- [ ] Send test emails to verify delivery
- [ ] Check system resources
- [ ] Verify SSL certificates

### **Post-Launch:**

- [ ] Monitor error logs for 24 hours
- [ ] Check email deliverability
- [ ] Monitor server resources
- [ ] Test backup restoration
- [ ] Document any issues and fixes

---

## 🆘 **Troubleshooting**

### **Mail Server Issues:**

```bash
# Check mail server logs
docker-compose logs -f mailserver

# Test SMTP connection
telnet localhost 587

# Check DNS records
dig -t MX yourdomain.com
dig -t TXT yourdomain.com
dig -t TXT mail._domainkey.yourdomain.com

# Mail deliverability test
# Use https://www.mail-tester.com/
```

### **Application Issues:**

```bash
# Check PM2 status
pm2 status
pm2 logs connectglobal-api --lines 100

# Check environment validation
cd /opt/connectglobal/backend
npm run validate-deployment

# Database connection test
psql -U connectglobal_user -d connectglobal_prod -h localhost
```

### **Performance Issues:**

```bash
# Check system resources
htop
df -h
free -m

# Check database performance
psql -U connectglobal_user -d connectglobal_prod -c "SELECT * FROM pg_stat_activity;"

# Check Redis
redis-cli info memory
```

---

## 💰 **Cost Breakdown**

### **Monthly Costs:**
- **Hetzner CPX21**: €7.90/month (recommended)
- **Domain**: €10-15/year (one-time)
- **Total**: ~€8-10/month for unlimited emails and full control

### **vs. Cloud Alternatives:**
- **AWS/GCP equivalent**: €50-100/month
- **Email services**: €20-50/month for high volume
- **Managed database**: €25-50/month

**You save 80-90% with self-hosting while gaining full control!**

---

## 🎉 **Congratulations!**

You now have a fully self-hosted ConnectGlobal dating app running on Hetzner with:

✅ **Unlimited Email Sending** (your own SMTP server)
✅ **Full Data Control** (your server, your data)
✅ **Professional Domain** (your-brand.com)
✅ **Enterprise Features** (Redis, PostgreSQL, logging)
✅ **High Performance** (Hetzner's excellent infrastructure)
✅ **Cost Effective** (€8/month vs €100+ cloud)
✅ **Production Ready** (SSL, monitoring, backups)

Your users can now register with `@yourdomain.com` email addresses and receive unlimited verification emails, password resets, and notifications - all from your own infrastructure!

---

## 📞 **Support**

If you need help with the deployment:
1. Check the troubleshooting section above
2. Review application logs: `pm2 logs connectglobal-api`
3. Check mail server logs: `docker-compose logs mailserver`
4. Validate environment: `npm run validate-deployment`

Remember: You have complete control over your infrastructure now! 🚀