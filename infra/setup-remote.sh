#!/bin/bash
# Setup Ignis server after provisioning
# Run this locally - it SSHs into the server and configures everything
#
# Usage: ./setup-remote.sh <server-ip> [github-ssh-key-path]

set -e

SERVER_IP="${1:-$(cat "$(dirname "$0")/.server-ip" 2>/dev/null)}"
[[ -z "$SERVER_IP" ]] && { echo "Usage: $0 <server-ip> [github-ssh-key-path]"; exit 1; }

SSH_KEY="${2:-~/.ssh/id_ed25519}"
USER="hackathon"

echo "Setting up Ignis on $SERVER_IP..."

# Copy GitHub SSH key to server for cloning repos
echo "Copying GitHub SSH key..."
scp "$SSH_KEY" "$USER@$SERVER_IP:~/.ssh/github_key"
scp "$SSH_KEY.pub" "$USER@$SERVER_IP:~/.ssh/github_key.pub" 2>/dev/null || true

# Run setup on server
ssh "$USER@$SERVER_IP" bash << 'REMOTE_SCRIPT'
set -e

# Configure SSH for GitHub
cat >> ~/.ssh/config << 'EOF'
Host github.com
    IdentityFile ~/.ssh/github_key
    StrictHostKeyChecking no
EOF
chmod 600 ~/.ssh/config ~/.ssh/github_key

# Configure git
git config --global user.name "Ignis Hackathon"
git config --global user.email "ignis@hackathon.local"

# Pull latest ignis repo
cd /opt/ignis
git pull origin main 2>/dev/null || echo "Repo may be empty or not yet pushed"

# Create .env from example if not exists
[[ -f .env ]] || cp .env.example .env 2>/dev/null || true

# Start Docker services (includes app)
echo ""
echo "Starting Docker services..."
docker compose up -d --build 2>/dev/null || echo "Docker compose failed - check logs"

echo ""
echo "================================================"
echo "🔥 Ignis Server Ready!"
echo "================================================"
echo ""
echo "Project: /opt/ignis"
echo ""
echo "Services:"
echo "  Aidbox: http://$HOSTNAME:8080"
echo "  n8n:    http://$HOSTNAME:5678 (admin/ignis2026)"
echo "  App:    http://$HOSTNAME/app/ (Ignis Patient Intake)"
echo ""
echo "Next steps:"
echo "  1. Edit /opt/ignis/.env with API keys"
echo "  2. Check services: docker compose ps"
echo "  3. View logs: docker compose logs -f"
echo ""
REMOTE_SCRIPT

echo ""
echo "Setup complete! SSH in with:"
echo "  ssh $USER@$SERVER_IP"
