#!/bin/bash
# Setup all Ignis services with nginx reverse proxy
# Usage: ./setup-services.sh [--with-synthea-data [count]]
#
# Options:
#   --with-synthea-data [count]  Load Synthea patient bundles after setup
#                                 count: number of patients (default: all 631)
#
# Prerequisites:
#   - .env file with AIDBOX_LICENSE_KEY
#   - Docker and docker-compose installed

set -e

# Parse arguments
LOAD_SYNTHEA_DATA=false
SYNTHEA_COUNT=0
while [[ $# -gt 0 ]]; do
    case $1 in
        --with-synthea-data)
            LOAD_SYNTHEA_DATA=true
            if [[ -n "$2" && "$2" =~ ^[0-9]+$ ]]; then
                SYNTHEA_COUNT="$2"
                shift
            fi
            shift
            ;;
        *)
            shift
            ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_IP="167.235.236.238"

cd "$PROJECT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[x]${NC} $1"; exit 1; }

# Check for .env file
if [[ ! -f .env ]]; then
    if [[ -f .env.example ]]; then
        warn ".env file not found. Creating from .env.example..."
        cp .env.example .env
        error "Please edit .env and add your AIDBOX_LICENSE_KEY, then run this script again."
    else
        error ".env file not found. Create one with AIDBOX_LICENSE_KEY."
    fi
fi

# Source .env
set -a
source .env
set +a

# Validate required variables
if [[ -z "$AIDBOX_LICENSE_KEY" ]]; then
    error "AIDBOX_LICENSE_KEY not set in .env. Get a free dev license at https://aidbox.app"
fi

# Check for SSL configuration
SSL_ENABLED=false
if [[ -n "$DOMAIN" && -f "$PROJECT_DIR/infra/ssl/fullchain.pem" && -f "$PROJECT_DIR/infra/nginx/nginx-ssl.conf" ]]; then
    log "SSL certificates found - enabling HTTPS for $DOMAIN"
    # Ensure NGINX_CONF is set in .env for docker-compose
    if ! grep -q "^NGINX_CONF=" .env 2>/dev/null; then
        echo "NGINX_CONF=./infra/nginx/nginx-ssl.conf" >> .env
    fi
    export NGINX_CONF="./infra/nginx/nginx-ssl.conf"
    SSL_ENABLED=true
elif [[ -n "$NGINX_CONF" && -f "$PROJECT_DIR/infra/ssl/fullchain.pem" ]]; then
    # NGINX_CONF already set in .env (e.g., by setup-ssl.sh)
    log "Using SSL configuration from NGINX_CONF=$NGINX_CONF"
    SSL_ENABLED=true
elif [[ -n "$DOMAIN" ]]; then
    warn "DOMAIN is set but SSL certificates not found."
    warn "Run ./infra/setup-ssl.sh after DNS is configured to enable HTTPS."
fi

# Stop any existing services
log "Stopping existing services..."
docker compose down --remove-orphans 2>/dev/null || true

# Start all services
log "Starting all services (db, aidbox, app, nginx)..."
docker compose up -d

# Wait for Aidbox to be healthy
log "Waiting for Aidbox to be healthy..."
RETRIES=40
until docker compose exec -T aidbox curl -sf http://localhost:8080/health > /dev/null 2>&1; do
    RETRIES=$((RETRIES - 1))
    if [[ $RETRIES -eq 0 ]]; then
        warn "Aidbox taking longer than expected. Check logs with: docker compose logs aidbox"
        break
    fi
    echo -n "."
    sleep 3
done
echo ""

# Get auth credentials
AIDBOX_USER="${AIDBOX_ADMIN_ID:-admin}"
AIDBOX_PASS="${AIDBOX_ADMIN_PASSWORD:-ignis2026}"

# Load demo data if it exists
if [[ -f aidbox/seed/demo-data.json ]]; then
    log "Loading demo data..."
    sleep 5  # Give Aidbox a moment to fully initialize

    HTTP_CODE=$(curl -s -o /tmp/aidbox-response.json -w "%{http_code}" \
        -X POST "http://localhost:8080/fhir" \
        -H "Content-Type: application/fhir+json" \
        -u "$AIDBOX_USER:$AIDBOX_PASS" \
        -d @aidbox/seed/demo-data.json 2>/dev/null || echo "000")

    if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "201" ]]; then
        log "Demo data loaded successfully!"
    else
        warn "Demo data load returned HTTP $HTTP_CODE (may already exist)"
    fi
fi

# Wait for nginx
log "Waiting for nginx..."
sleep 3

# Test external access
log "Testing external access..."
if curl -sf "http://localhost/health" > /dev/null 2>&1; then
    log "Nginx is responding!"
else
    warn "Nginx health check failed - may need more time"
fi

echo ""
echo "==========================================================================="
echo "  Ignis Services Ready!"
echo "==========================================================================="
echo ""

if [[ "$SSL_ENABLED" == "true" ]]; then
    echo "  External Access (HTTPS enabled):"
    echo "  ---------------------------------"
    echo "  Landing:    https://$DOMAIN/"
    echo "  Aidbox UI:  https://$DOMAIN/aidbox/"
    echo "  FHIR API:   https://$DOMAIN/fhir/"
    echo ""
    echo "  HTTP requests will redirect to HTTPS automatically."
else
    echo "  External Access (via nginx on port 80):"
    echo "  ----------------------------------------"
    echo "  Landing:    http://$SERVER_IP/"
    echo "  Aidbox UI:  http://$SERVER_IP/aidbox/"
    echo "  FHIR API:   http://$SERVER_IP/fhir/"
    echo ""
    if [[ -n "$DOMAIN" ]]; then
        echo "  To enable HTTPS, run: ./infra/setup-ssl.sh"
    fi
fi
echo ""
echo "  Credentials:"
echo "  ------------"
echo "  Aidbox:     $AIDBOX_USER / $AIDBOX_PASS"
echo ""
echo "  For developers (.env.development):"
echo "  -----------------------------------"
if [[ "$SSL_ENABLED" == "true" ]]; then
    echo "  AIDBOX_URL=https://$DOMAIN/aidbox"
    echo "  AIDBOX_FHIR_URL=https://$DOMAIN/fhir"
else
    echo "  AIDBOX_URL=http://$SERVER_IP/aidbox"
    echo "  AIDBOX_FHIR_URL=http://$SERVER_IP/fhir"
fi
echo "  AIDBOX_USER=$AIDBOX_USER"
echo "  AIDBOX_PASSWORD=$AIDBOX_PASS"
echo ""
echo "  Test FHIR API:"
if [[ "$SSL_ENABLED" == "true" ]]; then
    echo "    curl -u $AIDBOX_USER:$AIDBOX_PASS https://$DOMAIN/fhir/Patient"
else
    echo "    curl -u $AIDBOX_USER:$AIDBOX_PASS http://$SERVER_IP/fhir/Patient"
fi
echo ""

# Load Synthea data if requested
if [[ "$LOAD_SYNTHEA_DATA" == "true" ]]; then
    echo ""
    log "Loading Synthea patient data..."
    if [[ -x "$SCRIPT_DIR/load-synthea-data.sh" ]]; then
        if [[ "$SYNTHEA_COUNT" -gt 0 ]]; then
            "$SCRIPT_DIR/load-synthea-data.sh" "$SYNTHEA_COUNT"
        else
            "$SCRIPT_DIR/load-synthea-data.sh"
        fi
    else
        warn "load-synthea-data.sh not found or not executable"
        warn "Run: chmod +x $SCRIPT_DIR/load-synthea-data.sh"
    fi
fi
