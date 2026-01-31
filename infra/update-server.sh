#!/bin/bash
# Quick update script - run this after pushing code changes
# Usage: ./update-server.sh [ssh-host]

set -e

SSH_HOST="${1:-hackathon}"

echo "Updating Ignis on $SSH_HOST..."

ssh "$SSH_HOST" bash << 'REMOTE_SCRIPT'
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
