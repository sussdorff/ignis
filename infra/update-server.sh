#!/bin/bash
# Quick update script - run this after pushing code changes
# Usage: ./update-server.sh [server-ip]

set -e

SERVER_IP="${1:-167.235.236.238}"
USER="hackathon"

echo "Updating Ignis on $SERVER_IP..."

ssh "$USER@$SERVER_IP" bash << 'REMOTE_SCRIPT'
set -e

cd /opt/ignis

echo "Pulling latest changes..."
git pull origin main

echo "Deploying app..."
./infra/deploy-app.sh --restart

echo "Restarting nginx..."
docker compose restart nginx

echo ""
echo "✓ Update complete!"
echo ""
echo "Check status:"
echo "  App:    sudo systemctl status ignis-app"
echo "  Logs:   sudo journalctl -u ignis-app -f"
echo "  Nginx:  docker compose logs nginx"
echo ""
REMOTE_SCRIPT

echo ""
echo "Server updated successfully!"
