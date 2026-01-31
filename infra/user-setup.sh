#!/bin/bash
# Add team member SSH keys to Ignis server
# Usage: ./user-setup.sh <server-ip>
#
# Edit the TEAM_KEYS array below with your team's public keys

set -e

SERVER_IP="${1:-$(cat "$(dirname "$0")/.server-ip" 2>/dev/null)}"
[[ -z "$SERVER_IP" ]] && { echo "Usage: $0 <server-ip>"; exit 1; }

# Add team member public keys here
# Format: "ssh-ed25519 AAAA... user@email"
TEAM_KEYS=(
    # "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA... malte@example.com"
    # "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA... teammate1@example.com"
    # "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA... teammate2@example.com"
)

if [[ ${#TEAM_KEYS[@]} -eq 0 ]]; then
    echo "No team keys configured!"
    echo ""
    echo "Edit this script and add SSH public keys to the TEAM_KEYS array."
    echo "Then run again: ./user-setup.sh $SERVER_IP"
    echo ""
    echo "To add a single key manually:"
    echo "  ssh root@$SERVER_IP 'echo \"<PUBLIC_KEY>\" >> /home/hackathon/.ssh/authorized_keys'"
    exit 1
fi

echo "Adding ${#TEAM_KEYS[@]} team member keys to $SERVER_IP..."

for key in "${TEAM_KEYS[@]}"; do
    echo "  Adding: ${key##* }"  # Print email/comment part
    ssh root@"$SERVER_IP" "echo '$key' >> /home/hackathon/.ssh/authorized_keys"
done

echo ""
echo "Done! Team members can now SSH in:"
echo "  ssh hackathon@$SERVER_IP"
