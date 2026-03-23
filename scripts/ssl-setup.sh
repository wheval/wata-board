#!/bin/bash

# SSL Certificate Setup Script for Wata-Board
# This script automates SSL certificate generation and configuration using Let's Encrypt

set -e

# Configuration
DOMAIN="yourdomain.com"
API_DOMAIN="api.yourdomain.com"
EMAIL="admin@yourdomain.com"
WEBROOT="/var/www/certbot"
NGINX_CONF="/etc/nginx/sites-available/wata-board"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root"
        exit 1
    fi
}

# Update configuration
update_config() {
    print_status "Updating configuration..."
    
    read -p "Enter your main domain (e.g., yourdomain.com): " input_domain
    if [[ ! -z "$input_domain" ]]; then
        DOMAIN="$input_domain"
        API_DOMAIN="api.$input_domain"
    fi
    
    read -p "Enter your email for Let's Encrypt: " input_email
    if [[ ! -z "$input_email" ]]; then
        EMAIL="$input_email"
    fi
    
    print_status "Configuration updated:"
    echo "  Domain: $DOMAIN"
    echo "  API Domain: $API_DOMAIN"
    echo "  Email: $EMAIL"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Update package list
    apt update
    
    # Install required packages
    apt install -y nginx certbot python3-certbot-nginx curl wget
    
    # Start and enable nginx
    systemctl start nginx
    systemctl enable nginx
    
    print_status "Dependencies installed successfully"
}

# Create temporary Nginx configuration
create_temp_nginx() {
    print_status "Creating temporary Nginx configuration..."
    
    cat > /etc/nginx/sites-available/wata-board-temp << EOF
server {
    listen 80;
    server_name $DOMAIN $API_DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root $WEBROOT;
        allow all;
    }
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}
EOF

    # Enable temporary site
    ln -sf /etc/nginx/sites-available/wata-board-temp /etc/nginx/sites-enabled/
    
    # Remove default site
    rm -f /etc/nginx/sites-enabled/default
    
    # Test and reload nginx
    nginx -t && systemctl reload nginx
    
    print_status "Temporary Nginx configuration created"
}

# Create webroot directory
create_webroot() {
    print_status "Creating webroot directory..."
    
    mkdir -p $WEBROOT
    chown -R www-data:www-data $WEBROOT
    chmod -R 755 $WEBROOT
    
    print_status "Webroot directory created"
}

# Generate SSL certificates
generate_certificates() {
    print_status "Generating SSL certificates..."
    
    # Generate certificate for main domain
    certbot certonly --webroot \
        --webroot-path=$WEBROOT \
        --email $EMAIL \
        --agree-tos \
        --no-eff-email \
        --force-renewal \
        -d $DOMAIN
    
    # Generate certificate for API domain
    certbot certonly --webroot \
        --webroot-path=$WEBROOT \
        --email $EMAIL \
        --agree-tos \
        --no-eff-email \
        --force-renewal \
        -d $API_DOMAIN
    
    print_status "SSL certificates generated successfully"
}

# Create production Nginx configuration
create_production_nginx() {
    print_status "Creating production Nginx configuration..."
    
    # Update the nginx.conf file with actual domain
    sed -i "s/yourdomain.com/$DOMAIN/g" /path/to/wata-board/nginx.conf
    
    # Copy the configuration
    cp /path/to/wata-board/nginx.conf $NGINX_CONF
    
    # Enable the site
    ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
    
    # Remove temporary configuration
    rm -f /etc/nginx/sites-available/wata-board-temp
    rm -f /etc/nginx/sites-enabled/wata-board-temp
    
    print_status "Production Nginx configuration created"
}

# Setup auto-renewal
setup_renewal() {
    print_status "Setting up automatic certificate renewal..."
    
    # Test renewal
    certbot renew --dry-run
    
    # Create renewal hook
    cat > /etc/letsencrypt/renewal-hooks/deploy/nginx-reload.sh << 'EOF'
#!/bin/bash
systemctl reload nginx
EOF
    chmod +x /etc/letsencrypt/renewal-hooks/deploy/nginx-reload.sh
    
    # Add to crontab
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet --deploy-hook 'systemctl reload nginx'") | crontab -
    
    print_status "Auto-renewal configured"
}

# Create SSL monitoring script
create_monitoring() {
    print_status "Creating SSL monitoring script..."
    
    cat > /usr/local/bin/check-ssl-expiry.sh << EOF
#!/bin/bash

DOMAIN="$DOMAIN"
API_DOMAIN="$API_DOMAIN"
WARN_DAYS=30

check_certificate() {
    local domain=\$1
    local expiry_date=\$(echo | openssl s_client -servername \$domain -connect \$domain:443 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
    local expiry_epoch=\$(date -d "\$expiry_date" +%s)
    local current_epoch=\$(date +%s)
    local days_left=\$(( (\$expiry_epoch - \$current_epoch) / 86400 ))

    if [ \$days_left -lt \$WARN_DAYS ]; then
        echo "WARNING: SSL certificate for \$domain expires in \$days_left days (\$expiry_date)"
        # Send email notification (configure mail server first)
        # echo "SSL certificate for \$domain expires in \$days_left days" | mail -s "SSL Certificate Expiration Warning" \$EMAIL
        return 1
    else
        echo "OK: SSL certificate for \$domain expires in \$days_left days (\$expiry_date)"
        return 0
    fi
}

# Check both domains
check_certificate "\$DOMAIN"
check_certificate "\$API_DOMAIN"
EOF

    chmod +x /usr/local/bin/check-ssl-expiry.sh
    
    # Add to crontab for daily checks
    (crontab -l 2>/dev/null; echo "0 8 * * * /usr/local/bin/check-ssl-expiry.sh >> /var/log/ssl-monitoring.log 2>&1") | crontab -
    
    print_status "SSL monitoring script created"
}

# Test SSL configuration
test_ssl() {
    print_status "Testing SSL configuration..."
    
    # Test nginx configuration
    nginx -t
    
    # Reload nginx
    systemctl reload nginx
    
    # Wait a moment for nginx to start
    sleep 2
    
    # Test SSL connection
    if curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN" | grep -q "200\|301\|302"; then
        print_status "SSL configuration test passed for $DOMAIN"
    else
        print_error "SSL configuration test failed for $DOMAIN"
    fi
    
    if curl -s -o /dev/null -w "%{http_code}" "https://$API_DOMAIN" | grep -q "200\|301\|302"; then
        print_status "SSL configuration test passed for $API_DOMAIN"
    else
        print_error "SSL configuration test failed for $API_DOMAIN"
    fi
}

# Display certificate information
show_certificate_info() {
    print_status "Certificate Information:"
    
    echo "Main Domain: $DOMAIN"
    echo | openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -dates -issuer
    
    echo ""
    echo "API Domain: $API_DOMAIN"
    echo | openssl s_client -servername $API_DOMAIN -connect $API_DOMAIN:443 2>/dev/null | openssl x509 -noout -dates -issuer
}

# Main execution
main() {
    print_status "Starting SSL setup for Wata-Board..."
    
    check_root
    update_config
    install_dependencies
    create_webroot
    create_temp_nginx
    generate_certificates
    create_production_nginx
    setup_renewal
    create_monitoring
    test_ssl
    show_certificate_info
    
    print_status "SSL setup completed successfully!"
    print_warning "Remember to:"
    echo "  1. Update your DNS records to point to this server"
    echo "  2. Configure your firewall to allow ports 80 and 443"
    echo "  3. Test your application with the new SSL certificates"
    echo "  4. Set up email notifications for certificate expiry warnings"
}

# Run main function
main "$@"
