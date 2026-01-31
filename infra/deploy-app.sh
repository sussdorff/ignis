#!/bin/bash
# Deploy or update Ignis Bun application
# Usage: ./deploy-app.sh [--restart]
#
# This script:
# 1. Installs Bun if not present
# 2. Installs dependencies
# 3. Builds the frontend
# 4. Sets up systemd service
# 5. Starts/restarts the service

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

RESTART_ONLY=false
[[ "$1" == "--restart" ]] && RESTART_ONLY=true

# Check if running on server or locally
if [[ -f /etc/hostname ]] && grep -q "ignis-hackathon" /etc/hostname 2>/dev/null; then
    ON_SERVER=true
else
    ON_SERVER=false
fi

# 1. Install Bun if not present
if ! command -v bun &> /dev/null && [[ ! -f ~/.bun/bin/bun ]]; then
    log "Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
fi

BUN_BIN="${HOME}/.bun/bin/bun"
[[ ! -f "$BUN_BIN" ]] && BUN_BIN="$(command -v bun)"

log "Using Bun: $BUN_BIN"

if [[ "$RESTART_ONLY" == "false" ]]; then
    # 2. Install backend dependencies
    log "Installing backend dependencies..."
    "$BUN_BIN" install

    # 3. Install frontend dependencies
    log "Installing frontend dependencies..."
    cd "$PROJECT_DIR/frontend"
    "$BUN_BIN" install

    # 4. Build frontend
    log "Building frontend for production..."
    "$BUN_BIN" run build

    cd "$PROJECT_DIR"
    log "Build complete!"
fi

# 5. Setup systemd service (only on server)
if [[ "$ON_SERVER" == "true" ]]; then
    log "Setting up systemd service..."
    
    # Source .env for environment variables
    if [[ -f .env ]]; then
        set -a
        source .env
        set +a
    fi
    
    # Create systemd service file
    sudo tee /etc/systemd/system/ignis-app.service > /dev/null << EOF
[Unit]
Description=Ignis Patient Intake System
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR
Environment="PATH=$HOME/.bun/bin:/usr/local/bin:/usr/bin:/bin"
Environment="NODE_ENV=production"
Environment="PORT=3000"
$(if [[ -f .env ]]; then grep -v '^#' .env | grep -v '^$' | sed 's/^/Environment="/;s/$/"/'; fi)
ExecStart=$BUN_BIN run $PROJECT_DIR/src/index.ts
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ignis-app

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd
    sudo systemctl daemon-reload
    
    # Enable service to start on boot
    sudo systemctl enable ignis-app
    
    # Start or restart service
    if systemctl is-active --quiet ignis-app; then
        log "Restarting ignis-app service..."
        sudo systemctl restart ignis-app
    else
        log "Starting ignis-app service..."
        sudo systemctl start ignis-app
    fi
    
    # Wait for service to be ready
    sleep 3
    
    # Check service status
    if systemctl is-active --quiet ignis-app; then
        log "Service is running!"
        
        # Test health endpoint
        if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
            log "Health check passed!"
        else
            warn "Service is running but health check failed"
        fi
    else
        error "Service failed to start. Check logs with: sudo journalctl -u ignis-app -f"
    fi
    
    echo ""
    echo "==========================================================================="
    echo "  Ignis App Deployed!"
    echo "==========================================================================="
    echo ""
    echo "  Service:    ignis-app"
    echo "  Status:     $(systemctl is-active ignis-app)"
    echo "  Port:       3000"
    echo ""
    echo "  Commands:"
    echo "    Status:   sudo systemctl status ignis-app"
    echo "    Logs:     sudo journalctl -u ignis-app -f"
    echo "    Restart:  sudo systemctl restart ignis-app"
    echo "    Stop:     sudo systemctl stop ignis-app"
    echo ""
else
    log "Not on server - skipping systemd setup"
    log "To run locally: $BUN_BIN run dev"
fi
