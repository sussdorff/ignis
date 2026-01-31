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

echo "Rebuilding and restarting services..."
docker compose up -d --build

echo ""
echo "✓ Update complete!"
echo ""
echo "Check status:"
echo "  Services:  docker compose ps"
echo "  Logs:      docker compose logs -f"
echo "  App logs:  docker compose logs app -f"
echo ""
REMOTE_SCRIPT

echo ""
echo "Server updated successfully!"
