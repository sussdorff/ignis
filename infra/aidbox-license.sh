#!/bin/bash
# Aidbox License Management via API
# Usage:
#   ./aidbox-license.sh create <name>     # Create new license
#   ./aidbox-license.sh list              # List all licenses
#   ./aidbox-license.sh get <id>          # Get license details
#   ./aidbox-license.sh env <id>          # Output .env format
#
# Prerequisites:
#   Set AIDBOX_PORTAL_TOKEN in environment or .env
#   Get token from: https://aidbox.app → Project Settings → Issue Token

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load .env if exists
if [[ -f "$PROJECT_DIR/.env" ]]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
fi

API_URL="https://aidbox.app/rpc"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[x]${NC} $1"; exit 1; }

# Check for token
if [[ -z "$AIDBOX_PORTAL_TOKEN" ]]; then
    error "AIDBOX_PORTAL_TOKEN not set.

To get a token:
  1. Go to https://aidbox.app
  2. Click on your project name → Settings
  3. Click 'Issue Token'
  4. Add to .env: AIDBOX_PORTAL_TOKEN=<your-token>"
fi

# Check for required tools
command -v curl >/dev/null 2>&1 || error "curl is required"
command -v yq >/dev/null 2>&1 || command -v python3 >/dev/null 2>&1 || warn "yq or python3 recommended for YAML parsing"

rpc_call() {
    local method="$1"
    local extra_params="$2"

    curl -s "$API_URL" \
        -H "content-type: text/yaml" \
        -H "accept: text/yaml" \
        -d "method: $method
params:
  token: $AIDBOX_PORTAL_TOKEN
$extra_params"
}

case "${1:-help}" in
    create)
        NAME="${2:-ignis-dev-$(date +%Y%m%d)}"
        log "Creating development license: $NAME"

        RESPONSE=$(rpc_call "portal.portal/issue-license" "  name: $NAME
  product: aidbox
  type: development")

        echo "$RESPONSE"

        # Extract license ID if possible
        if command -v yq >/dev/null 2>&1; then
            LICENSE_ID=$(echo "$RESPONSE" | yq -r '.result.id // empty')
            if [[ -n "$LICENSE_ID" ]]; then
                echo ""
                log "License created! ID: $LICENSE_ID"
                echo ""
                echo "To get .env values:"
                echo "  $0 env $LICENSE_ID"
            fi
        fi
        ;;

    list)
        log "Listing all licenses..."
        rpc_call "portal.portal/get-licenses" ""
        ;;

    get)
        LICENSE_ID="${2:?Usage: $0 get <license-id>}"
        log "Getting license: $LICENSE_ID"
        rpc_call "portal.portal/get-license" "  id: $LICENSE_ID"
        ;;

    env)
        LICENSE_ID="${2:?Usage: $0 env <license-id>}"
        log "Getting license for .env format..."

        RESPONSE=$(rpc_call "portal.portal/get-license" "  id: $LICENSE_ID")

        # Try to extract values
        if command -v yq >/dev/null 2>&1; then
            LIC_ID=$(echo "$RESPONSE" | yq -r '.result.id // empty')
            LIC_KEY=$(echo "$RESPONSE" | yq -r '.result.license // empty')

            if [[ -n "$LIC_ID" && -n "$LIC_KEY" ]]; then
                echo ""
                echo "# Add these to your .env file:"
                echo "AIDBOX_LICENSE_ID=$LIC_ID"
                echo "AIDBOX_LICENSE_KEY=$LIC_KEY"
            else
                echo "$RESPONSE"
                warn "Could not parse license. Raw response above."
            fi
        else
            echo "$RESPONSE"
            warn "Install yq for automatic parsing: brew install yq"
        fi
        ;;

    delete)
        LICENSE_ID="${2:?Usage: $0 delete <license-id>}"
        warn "Deleting license: $LICENSE_ID"
        read -p "Are you sure? (yes/no): " confirm
        if [[ "$confirm" == "yes" ]]; then
            rpc_call "portal.portal/remove-license" "  id: $LICENSE_ID"
            log "License deleted."
        else
            echo "Aborted."
        fi
        ;;

    help|*)
        echo "Aidbox License Management"
        echo ""
        echo "Usage: $0 <command> [args]"
        echo ""
        echo "Commands:"
        echo "  create [name]    Create new development license"
        echo "  list             List all licenses in project"
        echo "  get <id>         Get license details by ID"
        echo "  env <id>         Output license in .env format"
        echo "  delete <id>      Delete a license"
        echo ""
        echo "Prerequisites:"
        echo "  1. Get portal token from https://aidbox.app → Settings → Issue Token"
        echo "  2. Set AIDBOX_PORTAL_TOKEN in .env or environment"
        echo ""
        echo "Example workflow:"
        echo "  export AIDBOX_PORTAL_TOKEN=<your-token>"
        echo "  $0 create ignis-hackathon"
        echo "  $0 env <license-id> >> .env"
        echo "  ./setup-aidbox.sh"
        ;;
esac
