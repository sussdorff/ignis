#!/bin/bash
set -e

# Ignis Hackathon Server Provisioning
# Usage: ./provision.sh

SERVER_NAME="ignis-hackathon"
SERVER_TYPE="cx42"  # 16 vCPU, 32GB RAM - for multiple users + services
IMAGE="ubuntu-24.04"
DATACENTER="fsn1-dc14"  # Frankfurt
SSH_KEY_NAME="Malte"  # Hetzner SSH key

echo "Provisioning Ignis hackathon server..."

# Check if server already exists
if hcloud server describe "$SERVER_NAME" &>/dev/null; then
    echo "Server '$SERVER_NAME' already exists!"
    hcloud server describe "$SERVER_NAME" -o format='IP: {{.PublicNet.IPv4.IP}}'
    exit 0
fi

# Create server
hcloud server create \
    --name "$SERVER_NAME" \
    --type "$SERVER_TYPE" \
    --image "$IMAGE" \
    --datacenter "$DATACENTER" \
    --ssh-key "$SSH_KEY_NAME" \
    --user-data-from-file "$(dirname "$0")/cloud-init.yaml"

# Get IP
IP=$(hcloud server ip "$SERVER_NAME")

echo ""
echo "Server created!"
echo "==============="
echo "Name: $SERVER_NAME"
echo "IP:   $IP"
echo ""
echo "Wait ~3-4 minutes for cloud-init to complete, then:"
echo "  ./infra/setup-remote.sh $IP"
echo ""
echo "Or SSH directly:"
echo "  ssh hackathon@$IP"
echo ""

# Save IP for other scripts
echo "$IP" > "$(dirname "$0")/.server-ip"
echo "IP saved to infra/.server-ip"
