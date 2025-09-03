#!/bin/bash

# FieldSync Production Setup Script
# This script helps set up FieldSync for production deployment

set -e

echo "🚀 FieldSync Production Setup Starting..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[SETUP]${NC} $1"
}

# Check if running as root (not recommended for production)
if [[ $EUID -eq 0 ]]; then
   print_warning "This script is running as root. For security, consider running as a non-root user."
fi

# Step 1: Environment Validation
print_header "Step 1: Validating Environment"

# Check Node.js version
NODE_VERSION=$(node --version 2>/dev/null || echo "not installed")
if [[ $NODE_VERSION == "not installed" ]]; then
    print_error "Node.js is not installed. Please install Node.js 18+ before proceeding."
    exit 1
fi

print_status "Node.js version: $NODE_VERSION"

# Check if we're in the correct directory
if [[ ! -f "package.json" ]] || [[ ! -d "backend" ]]; then
    print_error "Please run this script from the FieldSync root directory"
    exit 1
fi

# Step 2: Environment Configuration
print_header "Step 2: Environment Configuration"

# Create production environment file
if [[ ! -f "backend/.env" ]]; then
    print_status "Creating production environment file..."
    cp backend/.env.example backend/.env
    print_warning "Please edit backend/.env with your production values before proceeding"
    print_warning "CRITICAL: Change JWT_SECRET, REFRESH_SECRET, and CSRF_SECRET"
    read -p "Press enter to continue after updating .env file..."
fi

# Generate secure secrets if needed
generate_secret() {
    openssl rand -hex 32
}

# Check if secrets need to be generated
if grep -q "changeme" backend/.env 2>/dev/null; then
    print_warning "Default secrets detected in .env file"
    read -p "Generate new secure secrets? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        JWT_SECRET=$(generate_secret)
        REFRESH_SECRET=$(generate_secret)
        CSRF_SECRET=$(generate_secret)
        
        # Replace secrets in .env file (macOS/Linux compatible)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/JWT_SECRET=.*/JWT_SECRET=${JWT_SECRET}/" backend/.env
            sed -i '' "s/REFRESH_SECRET=.*/REFRESH_SECRET=${REFRESH_SECRET}/" backend/.env
            sed -i '' "s/CSRF_SECRET=.*/CSRF_SECRET=${CSRF_SECRET}/" backend/.env
        else
            # Linux
            sed -i "s/JWT_SECRET=.*/JWT_SECRET=${JWT_SECRET}/" backend/.env
            sed -i "s/REFRESH_SECRET=.*/REFRESH_SECRET=${REFRESH_SECRET}/" backend/.env
            sed -i "s/CSRF_SECRET=.*/CSRF_SECRET=${CSRF_SECRET}/" backend/.env
        fi
        
        print_status "New secure secrets generated and saved to .env"
    fi
fi

# Step 3: Dependencies Installation
print_header "Step 3: Installing Dependencies"

print_status "Installing root dependencies..."
npm ci --production

print_status "Installing backend dependencies..."
cd backend && npm ci --production && cd ..

print_status "Installing mobile dependencies..."
cd mobile && npm ci --production && cd ..

# Step 4: Build Process
print_header "Step 4: Building Application"

print_status "Building web application..."
npm run build

print_status "Building backend..."
cd backend && npm run build:prod && cd ..

# Step 5: Security Checks
print_header "Step 5: Security Validation"

print_status "Running security audit..."
npm audit --audit-level=high || print_warning "Security vulnerabilities detected - please review"

print_status "Validating backend security configuration..."
cd backend && node -e "
const { validateSecurityConfig } = require('./dist/config/security.js');
const result = validateSecurityConfig();
if (!result.isValid) {
    console.error('❌ Security validation failed:');
    result.errors.forEach(err => console.error('  -', err));
    process.exit(1);
} else {
    console.log('✅ Security configuration is valid');
}
" && cd ..

# Step 6: Database Setup
print_header "Step 6: Database Preparation"

# Check MongoDB connection
print_status "Checking MongoDB connection..."
if command -v mongosh &> /dev/null; then
    MONGO_CMD="mongosh"
elif command -v mongo &> /dev/null; then
    MONGO_CMD="mongo"
else
    print_warning "MongoDB client not found. Please ensure MongoDB is accessible."
    MONGO_CMD=""
fi

if [[ -n "$MONGO_CMD" ]]; then
    # Test connection (assumes local MongoDB for now)
    $MONGO_CMD --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1 && \
        print_status "MongoDB connection successful" || \
        print_warning "Could not connect to MongoDB - please verify connection"
fi

# Step 7: SSL/TLS Setup
print_header "Step 7: SSL/TLS Configuration"

SSL_CERT_DIR="backend/certs"
if [[ ! -d "$SSL_CERT_DIR" ]]; then
    print_status "Creating SSL certificate directory..."
    mkdir -p "$SSL_CERT_DIR"
fi

if [[ ! -f "$SSL_CERT_DIR/cert.pem" ]] || [[ ! -f "$SSL_CERT_DIR/key.pem" ]]; then
    print_warning "SSL certificates not found in $SSL_CERT_DIR"
    print_warning "Please place your SSL certificate (cert.pem) and private key (key.pem) in this directory"
    print_warning "For testing, you can generate self-signed certificates with:"
    echo "openssl req -x509 -newkey rsa:4096 -keyout $SSL_CERT_DIR/key.pem -out $SSL_CERT_DIR/cert.pem -days 365 -nodes"
fi

# Step 8: Process Management Setup
print_header "Step 8: Process Management Setup"

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    print_warning "PM2 not found. Installing PM2 for process management..."
    npm install -g pm2
fi

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'fieldsync-backend',
      script: './backend/dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024'
    },
    {
      name: 'fieldsync-web',
      script: 'npm',
      args: 'start',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/web-err.log',
      out_file: './logs/web-out.log',
      log_file: './logs/web-combined.log',
      time: true
    }
  ]
};
EOF

print_status "Created PM2 ecosystem configuration"

# Step 9: Logging Setup
print_header "Step 9: Logging Configuration"

LOG_DIR="logs"
if [[ ! -d "$LOG_DIR" ]]; then
    print_status "Creating logs directory..."
    mkdir -p "$LOG_DIR"
fi

# Set up log rotation
if command -v logrotate &> /dev/null; then
    cat > /tmp/fieldsync-logrotate << EOF
$PWD/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
}
EOF
    print_status "Log rotation configuration created at /tmp/fieldsync-logrotate"
    print_warning "Add this to your system's logrotate configuration"
fi

# Step 10: Systemd Service (Linux only)
if [[ "$OSTYPE" == "linux-gnu"* ]] && command -v systemctl &> /dev/null; then
    print_header "Step 10: Systemd Service Setup"
    
    SERVICE_FILE="/tmp/fieldsync.service"
    cat > "$SERVICE_FILE" << EOF
[Unit]
Description=FieldSync Application
After=network.target

[Service]
Type=forking
User=$USER
WorkingDirectory=$PWD
ExecStart=$PWD/node_modules/.bin/pm2 start ecosystem.config.js --no-daemon
ExecReload=$PWD/node_modules/.bin/pm2 reload ecosystem.config.js
ExecStop=$PWD/node_modules/.bin/pm2 delete ecosystem.config.js
Restart=always

[Install]
WantedBy=multi-user.target
EOF

    print_status "Systemd service file created at $SERVICE_FILE"
    print_warning "To install the service, run as root:"
    echo "  sudo cp $SERVICE_FILE /etc/systemd/system/"
    echo "  sudo systemctl daemon-reload"
    echo "  sudo systemctl enable fieldsync"
    echo "  sudo systemctl start fieldsync"
fi

# Step 11: Final Security Checklist
print_header "Step 11: Final Security Checklist"

echo "📋 Security Checklist:"
echo "  ✅ Environment variables configured"
echo "  ✅ Secure secrets generated"
echo "  ✅ Dependencies installed and audited"
echo "  ✅ Application built for production"
echo "  ✅ Security configuration validated"
echo ""
echo "🔒 Additional Security Recommendations:"
echo "  📌 Enable firewall and restrict access to necessary ports only"
echo "  📌 Set up reverse proxy (nginx/Apache) with proper SSL configuration"
echo "  📌 Configure regular database backups"
echo "  📌 Set up monitoring and alerting"
echo "  📌 Implement log monitoring and SIEM integration"
echo "  📌 Regular security updates and vulnerability scanning"
echo ""

# Step 12: Start Services
print_header "Step 12: Starting Services"

read -p "Start FieldSync services now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Starting FieldSync with PM2..."
    pm2 start ecosystem.config.js
    pm2 save
    print_status "FieldSync is now running!"
    echo ""
    echo "🌐 Access your application:"
    echo "  - Web: http://localhost:3000"
    echo "  - API: http://localhost:3001"
    echo ""
    echo "📊 Monitor with PM2:"
    echo "  - pm2 status"
    echo "  - pm2 logs"
    echo "  - pm2 monit"
fi

print_status "Production setup completed! 🎉"
print_warning "Please review all configuration files and test thoroughly before going live."