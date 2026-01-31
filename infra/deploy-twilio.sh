#!/bin/bash
# Deploy Twilio + ElevenLabs integration to production server

set -e

SERVER="hackathon@167.235.236.238"
PROJECT_DIR="/opt/ignis"

echo "🚀 Deploying Twilio + ElevenLabs integration to production..."

# Step 1: Pull latest code
echo "📦 Pulling latest code..."
ssh $SERVER "cd $PROJECT_DIR && git pull origin main"

# Step 2: Update environment variables
echo "🔑 Updating environment variables..."
echo ""
echo "⚠️  Please add the following to /opt/ignis/.env on the server:"
echo ""
echo "TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
echo "TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
echo "TWILIO_PHONE_NUMBER=+15722314881"
echo "ELEVENLABS_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
echo "ELEVENLABS_AGENT_ID=agent_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
echo ""
read -p "Press Enter after you've added the credentials to .env..."

# Step 3: Rebuild and restart app
echo "🔨 Rebuilding app container..."
ssh $SERVER "cd $PROJECT_DIR && docker compose up -d --build app"

# Step 4: Restart nginx for WebSocket support
echo "🔄 Restarting nginx..."
ssh $SERVER "cd $PROJECT_DIR && docker compose restart nginx"

# Step 5: Check logs
echo "📋 Checking app logs..."
ssh $SERVER "cd $PROJECT_DIR && docker compose logs app --tail=50"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📞 Next steps:"
echo "1. Configure Twilio webhooks at https://console.twilio.com"
echo "   - Voice webhook: https://ignis.cognovis.de/api/twilio/voice (POST)"
echo "   - Status webhook: https://ignis.cognovis.de/api/twilio/status (POST)"
echo ""
echo "2. Test by calling: +1 572-231-4881"
echo ""
echo "3. Monitor logs: ssh $SERVER 'cd $PROJECT_DIR && docker compose logs app -f'"
