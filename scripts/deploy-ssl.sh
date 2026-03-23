#!/bin/bash

# SSL Deployment Script for Wata-Board
# This script handles the complete deployment with SSL configuration

set -e

# Configuration
PROJECT_DIR="/path/to/wata-board"
DOMAIN="yourdomain.com"
API_DOMAIN="api.yourdomain.com"
ENVIRONMENT="production"

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
    echo -e "${BLUE}[DEPLOY]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root"
        exit 1
    fi
}

# Update deployment configuration
update_config() {
    print_header "Updating deployment configuration..."
    
    read -p "Enter project directory path [$PROJECT_DIR]: " input_project
    if [[ ! -z "$input_project" ]]; then
        PROJECT_DIR="$input_project"
    fi
    
    read -p "Enter main domain [$DOMAIN]: " input_domain
    if [[ ! -z "$input_domain" ]]; then
        DOMAIN="$input_domain"
        API_DOMAIN="api.$input_domain"
    fi
    
    read -p "Enter environment (development/staging/production) [$ENVIRONMENT]: " input_env
    if [[ ! -z "$input_env" ]]; then
        ENVIRONMENT="$input_env"
    fi
    
    print_status "Configuration updated:"
    echo "  Project Directory: $PROJECT_DIR"
    echo "  Domain: $DOMAIN"
    echo "  API Domain: $API_DOMAIN"
    echo "  Environment: $ENVIRONMENT"
}

# Validate project structure
validate_project() {
    print_header "Validating project structure..."
    
    if [[ ! -d "$PROJECT_DIR" ]]; then
        print_error "Project directory does not exist: $PROJECT_DIR"
        exit 1
    fi
    
    if [[ ! -f "$PROJECT_DIR/docker-compose.prod.yml" ]]; then
        print_error "docker-compose.prod.yml not found in project directory"
        exit 1
    fi
    
    if [[ ! -f "$PROJECT_DIR/nginx.conf" ]]; then
        print_error "nginx.conf not found in project directory"
        exit 1
    fi
    
    print_status "Project structure validation passed"
}

# Create necessary directories
create_directories() {
    print_header "Creating necessary directories..."
    
    # Create SSL directory
    mkdir -p /etc/letsencrypt/live/$DOMAIN
    mkdir -p /etc/letsencrypt/live/$API_DOMAIN
    
    # Create logs directory
    mkdir -p /var/log/wata-board
    mkdir -p /var/log/nginx
    
    # Create webroot for certbot
    mkdir -p /var/www/certbot
    
    # Set permissions
    chown -R www-data:www-data /var/www/certbot
    chown -R www-data:www-data /var/log/nginx
    chmod -R 755 /var/www/certbot
    
    print_status "Directories created successfully"
}

# Update configuration files
update_config_files() {
    print_header "Updating configuration files..."
    
    # Update nginx.conf with actual domain
    sed -i "s/yourdomain.com/$DOMAIN/g" $PROJECT_DIR/nginx.conf
    
    # Update docker-compose.prod.yml
    sed -i "s/yourdomain.com/$DOMAIN/g" $PROJECT_DIR/docker-compose.prod.yml
    sed -i "s/api.yourdomain.com/$API_DOMAIN/g" $PROJECT_DIR/docker-compose.prod.yml
    
    # Create environment file for production
    cat > $PROJECT_DIR/.env.prod << EOF
# Production Environment Variables
NODE_ENV=production
PORT=3001
HTTPS_ENABLED=true
SSL_KEY_PATH=/etc/letsencrypt/live/$DOMAIN/privkey.pem
SSL_CERT_PATH=/etc/letsencrypt/live/$DOMAIN/fullchain.pem
SSL_CA_PATH=/etc/letsencrypt/live/$DOMAIN/chain.pem

# CORS Configuration
ALLOWED_ORIGINS=https://$DOMAIN,https://$API_DOMAIN
FRONTEND_URL=https://$DOMAIN

# Network Configuration
NETWORK=testnet

# Stellar Configuration (update with actual values)
ADMIN_SECRET_KEY=\$ADMIN_SECRET_KEY
CONTRACT_ID_TESTNET=CDRRJ7IPYDL36YSK5ZQLBG3LICULETIBXX327AGJQNTWXNKY2UMDO4DA
CONTRACT_ID_MAINNET=\$CONTRACT_ID_MAINNET
RPC_URL_TESTNET=https://soroban-testnet.stellar.org
RPC_URL_MAINNET=https://soroban.stellar.org
NETWORK_PASSPHRASE_TESTNET="Test SDF Network ; September 2015"
NETWORK_PASSPHRASE_MAINNET="Public Global Stellar Network ; September 2015"
EOF
    
    print_status "Configuration files updated"
}

# Generate SSL certificates
generate_ssl_certificates() {
    print_header "Generating SSL certificates..."
    
    # Check if certificates already exist
    if [[ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
        print_warning "SSL certificates already exist for $DOMAIN"
        read -p "Do you want to regenerate them? (y/N): " regenerate
        if [[ ! "$regenerate" =~ ^[Yy]$ ]]; then
            print_status "Skipping certificate generation"
            return
        fi
    fi
    
    # Install certbot if not present
    if ! command -v certbot &> /dev/null; then
        print_status "Installing certbot..."
        apt update
        apt install -y certbot python3-certbot-nginx
    fi
    
    # Generate certificates
    certbot certonly --standalone \
        --email admin@$DOMAIN \
        --agree-tos \
        --no-eff-email \
        -d $DOMAIN \
        -d $API_DOMAIN
    
    print_status "SSL certificates generated successfully"
}

# Setup Docker and Docker Compose
setup_docker() {
    print_header "Setting up Docker..."
    
    # Install Docker if not present
    if ! command -v docker &> /dev/null; then
        print_status "Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        systemctl start docker
        systemctl enable docker
        usermod -aG docker $USER
    fi
    
    # Install Docker Compose if not present
    if ! command -v docker-compose &> /dev/null; then
        print_status "Installing Docker Compose..."
        curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    fi
    
    print_status "Docker setup completed"
}

# Deploy application
deploy_application() {
    print_header "Deploying Wata-Board application..."
    
    cd $PROJECT_DIR
    
    # Build and start services
    docker-compose -f docker-compose.prod.yml down
    docker-compose -f docker-compose.prod.yml build
    docker-compose -f docker-compose.prod.yml up -d
    
    print_status "Application deployment started"
}

# Setup SSL monitoring
setup_monitoring() {
    print_header "Setting up SSL monitoring..."
    
    # Create monitoring script
    cat > /usr/local/bin/wata-board-ssl-monitor.sh << EOF
#!/bin/bash

DOMAIN="$DOMAIN"
API_DOMAIN="$API_DOMAIN"
LOG_FILE="/var/log/wata-board/ssl-monitoring.log"

check_certificate() {
    local domain=\$1
    local expiry_date=\$(echo | openssl s_client -servername \$domain -connect \$domain:443 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
    local expiry_epoch=\$(date -d "\$expiry_date" +%s)
    local current_epoch=\$(date +%s)
    local days_left=\$(( (\$expiry_epoch - \$current_epoch) / 86400 ))

    echo "\$(date '+%Y-%m-%d %H:%M:%S') - Certificate for \$domain expires in \$days_left days (\$expiry_date)" >> \$LOG_FILE

    if [ \$days_left -lt 30 ]; then
        echo "WARNING: SSL certificate for \$domain expires in \$days_left days" | logger -t wata-board-ssl
        # Send notification (configure as needed)
        return 1
    fi
    return 0
}

check_certificate "\$DOMAIN"
check_certificate "\$API_DOMAIN"
EOF

    chmod +x /usr/local/bin/wata-board-ssl-monitor.sh
    
    # Add to crontab
    (crontab -l 2>/dev/null; echo "0 6 * * * /usr/local/bin/wata-board-ssl-monitor.sh") | crontab -
    
    print_status "SSL monitoring configured"
}

# Test deployment
test_deployment() {
    print_header "Testing deployment..."
    
    # Wait for services to start
    sleep 30
    
    # Test HTTP to HTTPS redirect
    if curl -s -o /dev/null -w "%{http_code}" "http://$DOMAIN" | grep -q "301"; then
        print_status "HTTP to HTTPS redirect test passed"
    else
        print_error "HTTP to HTTPS redirect test failed"
    fi
    
    # Test HTTPS access
    if curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN" | grep -q "200\|301\|302"; then
        print_status "HTTPS access test passed for $DOMAIN"
    else
        print_error "HTTPS access test failed for $DOMAIN"
    fi
    
    # Test API endpoint
    if curl -s -o /dev/null -w "%{http_code}" "https://$API_DOMAIN/health" | grep -q "200"; then
        print_status "API health check test passed"
    else
        print_warning "API health check test failed (may still be starting)"
    fi
    
    # Check SSL certificate
    echo | openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -dates
    
    print_status "Deployment testing completed"
}

# Setup automatic renewal
setup_auto_renewal() {
    print_header "Setting up automatic SSL renewal..."
    
    # Test renewal
    certbot renew --dry-run
    
    # Create renewal hook
    cat > /etc/letsencrypt/renewal-hooks/deploy/docker-reload.sh << 'EOF'
#!/bin/bash
cd /path/to/wata-board
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
EOF
    chmod +x /etc/letsencrypt/renewal-hooks/deploy/docker-reload.sh
    
    # Add to crontab
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet --deploy-hook '/etc/letsencrypt/renewal-hooks/deploy/docker-reload.sh'") | crontab -
    
    print_status "Automatic SSL renewal configured"
}

# Display deployment information
show_deployment_info() {
    print_header "Deployment Information"
    
    echo "Application URLs:"
    echo "  Frontend: https://$DOMAIN"
    echo "  API: https://$API_DOMAIN"
    echo ""
    echo "SSL Certificate Status:"
    echo | openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -dates -issuer
    echo ""
    echo "Docker Services:"
    docker-compose -f $PROJECT_DIR/docker-compose.prod.yml ps
    echo ""
    echo "Log Files:"
    echo "  Application: /var/log/wata-board/"
    echo "  Nginx: /var/log/nginx/"
    echo "  SSL Monitoring: /var/log/wata-board/ssl-monitoring.log"
    echo ""
    echo "Next Steps:"
    echo "  1. Update your DNS records to point to this server"
    echo "  2. Configure firewall: ufw allow 80,443"
    echo "  3. Set up email notifications for SSL expiry"
    echo "  4. Monitor application logs regularly"
}

# Main execution
main() {
    print_status "Starting SSL deployment for Wata-Board..."
    
    check_root
    update_config
    validate_project
    create_directories
    update_config_files
    setup_docker
    generate_ssl_certificates
    deploy_application
    setup_monitoring
    setup_auto_renewal
    test_deployment
    show_deployment_info
    
    print_status "SSL deployment completed successfully!"
}

# Run main function
main "$@"
