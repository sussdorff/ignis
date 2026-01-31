#!/bin/bash
# Deploy app2 to ignis.cognovis.de
# Run this script from your local machine

set -e

SERVER="hackathon@167.235.236.238"

echo "=== Deploying app2 to ignis.cognovis.de ==="

ssh -o StrictHostKeyChecking=accept-new "$SERVER" bash << 'EOF'
set -e
cd /opt/ignis

echo "=== Current state ==="
git log -1 --oneline
docker compose ps

echo ""
echo "=== Pulling latest code ==="
git pull origin main

echo ""
echo "=== Verifying app2 config exists ==="
grep -c "app2" infra/nginx/nginx.conf && echo "app2 config found in nginx.conf"

echo ""
echo "=== Rebuilding app2 container ==="
docker compose build app2

echo ""
echo "=== Restarting nginx and app2 ==="
docker compose up -d nginx app2

echo ""
echo "=== Waiting for containers to start ==="
sleep 10

echo ""
echo "=== Container status ==="
docker compose ps

echo ""
echo "=== Testing app2 internally ==="
curl -s -o /dev/null -w "Internal test: HTTP %{http_code}\n" http://app2:3001/app2/ || echo "Direct app2 test failed (expected if not on docker network)"

echo ""
echo "=== Testing via nginx ==="
curl -s -o /dev/null -w "Nginx test: HTTP %{http_code}\n" http://localhost/app2/ || echo "Nginx test result shown above"

echo ""
echo "=== Recent app2 logs ==="
docker compose logs app2 --tail 20

echo ""
echo "=== Deployment complete ==="
EOF

echo ""
echo "=== Testing from external ==="
curl -sSL -k -o /dev/null -w "External test: HTTP %{http_code}\n" https://ignis.cognovis.de/app2/

echo ""
echo "Done! Check https://ignis.cognovis.de/app2/"
