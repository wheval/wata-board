# SSL/HTTPS Configuration Guide

This guide provides comprehensive instructions for configuring SSL/HTTPS for the Wata-Board project in production environments.

## Overview

SSL/TLS encryption is essential for:
- Protecting sensitive data in transit (payment information, user credentials)
- Preventing man-in-the-middle attacks
- Ensuring browser compatibility and user trust
- Meeting security compliance requirements

## SSL Configuration Options

### Option 1: Let's Encrypt (Recommended for Production)

Let's Encrypt provides free, automated SSL certificates perfect for production deployments.

#### Prerequisites
- Domain name pointing to your server
- Server with shell access
- Admin privileges

#### Installation Steps

1. **Install Certbot**
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install certbot python3-certbot-nginx

   # CentOS/RHEL
   sudo yum install certbot python3-certbot-nginx

   # Docker alternative
   docker run -it --rm -p 80:80 certbot/certbot certonly --standalone
   ```

2. **Generate SSL Certificate**
   ```bash
   # Replace yourdomain.com with your actual domain
   sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
   ```

3. **Auto-renewal Setup**
   ```bash
   # Test renewal
   sudo certbot renew --dry-run

   # Add to crontab for automatic renewal
   echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
   ```

### Option 2: Nginx Reverse Proxy with SSL

Configure Nginx as a reverse proxy with SSL termination.

#### Nginx Configuration

Create `/etc/nginx/sites-available/wata-board`:

```nginx
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name yourdomain.com api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS configuration for frontend
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.yourdomain.com;" always;

    # Frontend static files
    location / {
        root /var/www/wata-board-frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}

# HTTPS configuration for API backend
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # API backend proxy
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Rate limiting
        limit_req zone=api burst=10 nodelay;
    }
}

# Rate limiting
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=5r/m;
}
```

### Option 3: Node.js with HTTPS

Configure the Node.js server to handle HTTPS directly.

#### Update Server Configuration

Modify `wata-board-dapp/src/server.ts`:

```typescript
import https from 'https';
import fs from 'fs';

// HTTPS configuration (only in production)
if (process.env.NODE_ENV === 'production' && process.env.HTTPS_ENABLED === 'true') {
  const sslOptions = {
    key: fs.readFileSync(process.env.SSL_KEY_PATH || '/etc/letsencrypt/live/yourdomain.com/privkey.pem'),
    cert: fs.readFileSync(process.env.SSL_CERT_PATH || '/etc/letsencrypt/live/yourdomain.com/fullchain.pem'),
    ca: fs.readFileSync(process.env.SSL_CA_PATH || '/etc/letsencrypt/live/yourdomain.com/chain.pem')
  };

  // Create HTTPS server
  https.createServer(sslOptions, app).listen(443, () => {
    console.log('🔒 HTTPS Server running on port 443');
  });

  // Redirect HTTP to HTTPS
  const httpApp = express();
  httpApp.use((req, res) => {
    res.redirect(301, `https://${req.headers.host}${req.url}`);
  });
  httpApp.listen(80, () => {
    console.log('🔄 HTTP redirect server running on port 80');
  });
} else {
  // Development HTTP server
  app.listen(PORT, () => {
    console.log(`🚀 Wata-Board API Server running on port ${PORT}`);
  });
}
```

#### Environment Variables

Add to `wata-board-dapp/.env.example`:

```bash
# SSL Configuration
HTTPS_ENABLED=false
SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
SSL_CA_PATH=/etc/letsencrypt/live/yourdomain.com/chain.pem
```

## Certificate Management

### Certificate Renewal

Let's Encrypt certificates expire every 90 days. Set up automatic renewal:

1. **Test renewal process**
   ```bash
   sudo certbot renew --dry-run
   ```

2. **Set up automatic renewal**
   ```bash
   # Add to crontab
   (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet --deploy-hook 'systemctl reload nginx'") | crontab -
   ```

3. **Monitor renewal logs**
   ```bash
   # Check renewal logs
   sudo journalctl -u certbot
   ```

### Certificate Monitoring

Set up monitoring for certificate expiration:

```bash
# Create monitoring script
cat > /usr/local/bin/check-ssl-expiry.sh << 'EOF'
#!/bin/bash
DOMAIN="yourdomain.com"
EXPIRY_DATE=$(echo | openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
CURRENT_EPOCH=$(date +%s)
DAYS_LEFT=$(( ($EXPIRY_EPOCH - $CURRENT_EPOCH) / 86400 ))

if [ $DAYS_LEFT -lt 30 ]; then
    echo "WARNING: SSL certificate for $DOMAIN expires in $DAYS_LEFT days"
    # Send alert (email, Slack, etc.)
fi
EOF

chmod +x /usr/local/bin/check-ssl-expiry.sh

# Add to crontab (daily check)
echo "0 8 * * * /usr/local/bin/check-ssl-expiry.sh" | crontab -
```

## Security Headers Configuration

### Enhanced Security Headers

Add these headers to your Nginx configuration or Node.js middleware:

```nginx
# Content Security Policy
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://stellar.org; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.yourdomain.com https://soroban-testnet.stellar.org https://soroban.stellar.org; frame-ancestors 'none';" always;

# HTTP Strict Transport Security (HSTS)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

# Other security headers
add_header X-Frame-Options DENY always;
add_header X-Content-Type-Options nosniff always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
```

### Node.js Security Middleware

Update `wata-board-dapp/src/server.ts`:

```typescript
import helmet from 'helmet';

// Enhanced security configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://stellar.org"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.yourdomain.com", "https://soroban-testnet.stellar.org", "https://soroban.stellar.org"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

## Frontend HTTPS Configuration

### Update Frontend Environment

Update `wata-board-frontend/.env.example`:

```bash
# Production URLs (HTTPS)
VITE_API_URL=https://api.yourdomain.com
VITE_FRONTEND_URL=https://yourdomain.com

# Stellar endpoints (use HTTPS)
VITE_RPC_URL_TESTNET=https://soroban-testnet.stellar.org
VITE_RPC_URL_MAINNET=https://soroban.stellar.org
```

### Service Worker for HTTPS

Create `wata-board-frontend/public/sw.js`:

```javascript
const CACHE_NAME = 'wata-board-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
```

## Deployment Checklist

### Pre-deployment

- [ ] Obtain SSL certificates for all domains
- [ ] Configure DNS records (A/AAAA records)
- [ ] Test SSL certificate validity
- [ ] Verify security headers
- [ ] Set up monitoring and alerts

### Post-deployment

- [ ] Test HTTPS redirects
- [ ] Verify all resources load over HTTPS
- [ ] Test mixed content prevention
- [ ] Set up certificate renewal monitoring
- [ ] Test security headers with security scanners

### Testing SSL Configuration

Use these tools to verify your SSL setup:

```bash
# Test SSL configuration
curl -I https://yourdomain.com

# Check certificate details
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Online SSL test
# Visit: https://www.ssllabs.com/ssltest/
```

## Troubleshooting

### Common Issues

1. **Mixed Content Errors**
   - Ensure all resources use HTTPS URLs
   - Check console for mixed content warnings

2. **Certificate Chain Issues**
   - Verify intermediate certificates are installed
   - Use SSL test tools to diagnose

3. **HSTS Preload Issues**
   - Ensure site works perfectly over HTTPS first
   - Submit to HSTS preload list only when ready

4. **CORS Issues with HTTPS**
   - Update CORS configuration to include HTTPS origins
   - Verify API endpoints are accessible over HTTPS

### Debug Commands

```bash
# Check Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Check SSL certificate details
sudo certbot certificates

# View Nginx logs
sudo tail -f /var/log/nginx/error.log
```

## Best Practices

1. **Always use HTTPS in production**
2. **Implement HSTS for long-term security**
3. **Use strong cipher suites**
4. **Regularly update SSL/TLS libraries**
5. **Monitor certificate expiration**
6. **Test with SSL assessment tools**
7. **Implement proper logging and monitoring**
8. **Keep backup of certificates and keys**
9. **Use certificate pinning for mobile apps**
10. **Regular security audits and penetration testing**

## References

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [OWASP TLS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html)
- [Google Web Fundamentals HTTPS](https://developers.google.com/web/fundamentals/security/encrypt-in-transit/why-https)
