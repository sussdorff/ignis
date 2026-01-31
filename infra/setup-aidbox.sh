#!/bin/bash
# Setup Aidbox FHIR Server with demo data
# Usage: ./setup-aidbox.sh
#
# Prerequisites:
#   - .env file with AIDBOX_LICENSE_ID and AIDBOX_LICENSE_KEY
#   - Docker and docker-compose installed

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

# Check for .env file
if [[ ! -f .env ]]; then
    if [[ -f .env.example ]]; then
        warn ".env file not found. Creating from .env.example..."
        cp .env.example .env
        error "Please edit .env and add your AIDBOX_LICENSE_ID and AIDBOX_LICENSE_KEY, then run this script again."
    else
        error ".env file not found. Create one with AIDBOX_LICENSE_ID and AIDBOX_LICENSE_KEY."
    fi
fi

# Source .env
set -a
source .env
set +a

# Validate required variables
if [[ -z "$AIDBOX_LICENSE_ID" ]]; then
    error "AIDBOX_LICENSE_ID not set in .env. Get a free dev license at https://aidbox.app"
fi

if [[ -z "$AIDBOX_LICENSE_KEY" ]]; then
    error "AIDBOX_LICENSE_KEY not set in .env. Get a free dev license at https://aidbox.app"
fi

log "Starting Aidbox services..."
docker compose up -d aidbox-db aidbox

log "Waiting for Aidbox to be healthy..."
RETRIES=30
until docker compose exec -T aidbox curl -sf http://localhost:8080/health > /dev/null 2>&1; do
    RETRIES=$((RETRIES - 1))
    if [[ $RETRIES -eq 0 ]]; then
        error "Aidbox failed to start. Check logs with: docker compose logs aidbox"
    fi
    echo -n "."
    sleep 2
done
echo ""

log "Aidbox is healthy!"

# Get auth credentials
AIDBOX_URL="http://localhost:8080"
AIDBOX_USER="${AIDBOX_ADMIN_ID:-admin}"
AIDBOX_PASS="${AIDBOX_ADMIN_PASSWORD:-ignis2026}"

# Load demo data if it exists
if [[ -f aidbox/seed/demo-data.json ]]; then
    log "Loading demo data..."

    HTTP_CODE=$(curl -s -o /tmp/aidbox-response.json -w "%{http_code}" \
        -X POST "$AIDBOX_URL/fhir" \
        -H "Content-Type: application/fhir+json" \
        -u "$AIDBOX_USER:$AIDBOX_PASS" \
        -d @aidbox/seed/demo-data.json)

    if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "201" ]]; then
        log "Demo data loaded successfully!"
    else
        warn "Demo data load returned HTTP $HTTP_CODE"
        cat /tmp/aidbox-response.json
    fi
else
    warn "No demo data found at aidbox/seed/demo-data.json"
fi

# Verify
log "Verifying Aidbox setup..."
echo ""
echo "Patients:"
curl -s "$AIDBOX_URL/fhir/Patient" -u "$AIDBOX_USER:$AIDBOX_PASS" | jq -r '.entry[]?.resource | "\(.name[0].given[0]) \(.name[0].family)"' 2>/dev/null || echo "  (none)"

echo ""
echo "Practitioners:"
curl -s "$AIDBOX_URL/fhir/Practitioner" -u "$AIDBOX_USER:$AIDBOX_PASS" | jq -r '.entry[]?.resource | "\(.name[0].prefix[0] // "") \(.name[0].given[0]) \(.name[0].family)"' 2>/dev/null || echo "  (none)"

echo ""
echo "Appointments:"
curl -s "$AIDBOX_URL/fhir/Appointment" -u "$AIDBOX_USER:$AIDBOX_PASS" | jq -r '.entry[]?.resource | "\(.start) - \(.description)"' 2>/dev/null || echo "  (none)"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Aidbox FHIR Server Ready!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  UI:       $AIDBOX_URL"
echo "  FHIR API: $AIDBOX_URL/fhir"
echo "  Auth:     $AIDBOX_USER / $AIDBOX_PASS"
echo ""
echo "  Test with:"
echo "    curl -u $AIDBOX_USER:$AIDBOX_PASS $AIDBOX_URL/fhir/Patient"
echo ""
