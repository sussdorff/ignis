#!/bin/bash
# Teardown Ignis hackathon server
# Usage: ./teardown.sh

set -e

SERVER_NAME="ignis-hackathon"

echo "⚠️  This will DELETE the server '$SERVER_NAME' and all data!"
read -p "Are you sure? (yes/no): " confirm

if [[ "$confirm" != "yes" ]]; then
    echo "Aborted."
    exit 0
fi

echo "Deleting server..."
hcloud server delete "$SERVER_NAME"

# Remove saved IP
rm -f "$(dirname "$0")/.server-ip"

echo "Server deleted."
