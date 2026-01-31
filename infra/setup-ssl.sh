#!/bin/bash
# Setup SSL with Let's Encrypt for Ignis
# Usage: ./setup-ssl.sh [domain] [email]
#
# This script:
#   - Installs certbot if needed
#   - Requests Let's Encrypt certificate
#   - Configures nginx for HTTPS
#   - Sets up auto-renewal cron job

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[x]${NC} $1"; exit 1; }

# Get domain from argument or .env
if [[ -n "$1" ]]; then
    DOMAIN="$1"
elif [[ -f .env ]]; then
    source .env
fi

# Get email from argument or .env
if [[ -n "$2" ]]; then
    SSL_EMAIL="$2"
elif [[ -f .env ]]; then
    source .env
fi

# Validate required variables
if [[ -z "$DOMAIN" ]]; then
    error "DOMAIN not set. Usage: ./setup-ssl.sh <domain> <email> or set DOMAIN in .env"
fi

if [[ -z "$SSL_EMAIL" ]]; then
    error "SSL_EMAIL not set. Usage: ./setup-ssl.sh <domain> <email> or set SSL_EMAIL in .env"
fi

log "Setting up SSL for: $DOMAIN"
log "Certificate email: $SSL_EMAIL"

# Check if running as root or with sudo
if [[ $EUID -ne 0 ]]; then
    SUDO="sudo"
else
    SUDO=""
fi

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    log "Installing certbot..."
    $SUDO apt-get update
    $SUDO apt-get install -y certbot
fi

# Verify DNS resolves to this server
log "Verifying DNS resolution..."
SERVER_IP=$(curl -s ifconfig.me || curl -s icanhazip.com)
DNS_IP=$(dig +short "$DOMAIN" | tail -1)

if [[ -z "$DNS_IP" ]]; then
    error "DNS lookup failed for $DOMAIN. Please configure DNS first."
fi

if [[ "$DNS_IP" != "$SERVER_IP" ]]; then
    warn "DNS mismatch: $DOMAIN -> $DNS_IP (server IP: $SERVER_IP)"
    warn "DNS may not have propagated yet. Continuing anyway..."
fi

log "DNS check: $DOMAIN -> $DNS_IP"

# Create SSL directory
mkdir -p "$PROJECT_DIR/infra/ssl"

# Stop nginx to free port 80 for certbot standalone
log "Stopping nginx temporarily for certificate request..."
docker compose stop nginx 2>/dev/null || true

# Request certificate using standalone mode
log "Requesting Let's Encrypt certificate..."
$SUDO certbot certonly \
    --standalone \
    -d "$DOMAIN" \
    --email "$SSL_EMAIL" \
    --agree-tos \
    --non-interactive \
    --preferred-challenges http

# Copy certificates to project directory
log "Copying certificates to project..."
CERT_PATH="/etc/letsencrypt/live/$DOMAIN"
$SUDO cp "$CERT_PATH/fullchain.pem" "$PROJECT_DIR/infra/ssl/"
$SUDO cp "$CERT_PATH/privkey.pem" "$PROJECT_DIR/infra/ssl/"
$SUDO chown -R $(whoami):$(id -gn) "$PROJECT_DIR/infra/ssl/"
chmod 600 "$PROJECT_DIR/infra/ssl/privkey.pem"
chmod 644 "$PROJECT_DIR/infra/ssl/fullchain.pem"

# Generate SSL nginx config from template
log "Generating SSL nginx configuration..."
if [[ -f "$PROJECT_DIR/infra/nginx/nginx-ssl.conf.template" ]]; then
    sed "s/\${DOMAIN}/$DOMAIN/g" "$PROJECT_DIR/infra/nginx/nginx-ssl.conf.template" > "$PROJECT_DIR/infra/nginx/nginx-ssl.conf"
else
    error "nginx-ssl.conf.template not found"
fi

# Update docker-compose environment
log "Updating environment for SSL..."
if grep -q "^DOMAIN=" .env 2>/dev/null; then
    sed -i.bak "s/^DOMAIN=.*/DOMAIN=$DOMAIN/" .env
else
    echo "DOMAIN=$DOMAIN" >> .env
fi
if grep -q "^SSL_EMAIL=" .env 2>/dev/null; then
    sed -i.bak "s/^SSL_EMAIL=.*/SSL_EMAIL=$SSL_EMAIL/" .env
else
    echo "SSL_EMAIL=$SSL_EMAIL" >> .env
fi
rm -f .env.bak

# Restart services with SSL
log "Restarting services with SSL configuration..."
docker compose up -d

# Wait for nginx
sleep 3

# Test HTTPS
log "Testing HTTPS connection..."
if curl -sf "https://$DOMAIN/health" -k > /dev/null 2>&1; then
    log "HTTPS is working!"
else
    warn "HTTPS test inconclusive - certificate may need a moment to propagate"
fi

# Setup auto-renewal cron job
log "Setting up certificate auto-renewal..."
CRON_CMD="0 3 * * * certbot renew --quiet --deploy-hook 'cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $PROJECT_DIR/infra/ssl/ && cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $PROJECT_DIR/infra/ssl/ && docker compose -f $PROJECT_DIR/docker-compose.yaml restart nginx'"

# Check if cron job already exists
if ! ($SUDO crontab -l 2>/dev/null | grep -q "certbot renew"); then
    ($SUDO crontab -l 2>/dev/null; echo "$CRON_CMD") | $SUDO crontab -
    log "Auto-renewal cron job added"
else
    log "Auto-renewal cron job already exists"
fi

echo ""
echo "==========================================================="
echo "  SSL Setup Complete!"
echo "==========================================================="
echo ""
echo "  HTTPS URLs:"
echo "  -----------"
echo "  Landing:    https://$DOMAIN/"
echo "  Aidbox UI:  https://$DOMAIN/aidbox/"
echo "  FHIR API:   https://$DOMAIN/fhir/"
echo "  n8n:        https://$DOMAIN/n8n/"
echo ""
echo "  Certificate Info:"
echo "  -----------------"
echo "  Location:   /etc/letsencrypt/live/$DOMAIN/"
echo "  Renewal:    Automatic (daily check at 3 AM)"
echo ""
echo "  Manual renewal:"
echo "    sudo certbot renew"
echo ""
