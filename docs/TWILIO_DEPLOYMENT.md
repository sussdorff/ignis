# Twilio + ElevenLabs Integration Deployment Guide

## Overview

This guide covers deploying the Twilio + ElevenLabs voice integration to the Ignis production server.

## Prerequisites

✅ Twilio account with phone number: `+15722314881`
✅ ElevenLabs account with agent created: `agent_8101kgaq3e85ecqay2ctsjgp0y2e`
✅ All credentials added to `.env` file
✅ Code implemented and tested locally

## Deployment Steps

### 1. Push Code to Git

```bash
git add .
git commit -m "feat: Add Twilio + ElevenLabs voice integration"
git push origin main
```

### 2. Deploy to Production Server

```bash
# SSH to server
ssh hackathon@167.235.236.238

# Navigate to project
cd /opt/ignis

# Pull latest code
git pull origin main

# Update .env with credentials
nano .env
# Add:
# TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# TWILIO_PHONE_NUMBER=+15722314881
# ELEVENLABS_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# ELEVENLABS_AGENT_ID=agent_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Rebuild and restart services
docker compose up -d --build app

# Verify logs
docker compose logs app -f
```

### 3. Configure Twilio Webhooks

Go to [Twilio Console](https://console.twilio.com/):

1. Navigate to **Phone Numbers** → **Manage** → **Active Numbers**
2. Click on your phone number: `+15722314881`
3. Scroll to **Voice Configuration**:

   **A call comes in:**
   - Webhook: `https://ignis.cognovis.de/api/twilio/voice`
   - HTTP Method: `POST`

   **Call Status Changes:**
   - Webhook: `https://ignis.cognovis.de/api/twilio/status`
   - HTTP Method: `POST`

4. Click **Save**

### 4. Test the Integration

**Test 1: Call the Number**
```bash
# From your phone, call: +1 572-231-4881
# Expected: ElevenLabs agent answers in German
```

**Test 2: Check Logs**
```bash
ssh hackathon@167.235.236.238
docker compose logs app -f

# Look for:
# [Twilio] Incoming call: CAxxxx from +1234567890 to +15722314881
# [WebSocket] Twilio stream connected
# [ElevenLabs] Started conversation: conv_xxxx
# [WebSocket] Connected to ElevenLabs
```

**Test 3: Debug Endpoints**
```bash
# Check active conversations
curl https://ignis.cognovis.de/api/twilio/conversations

# Expected: {"active": 0, "conversations": []}
# (when no calls active)
```

## Webhook URLs

| Purpose | URL | Method |
|---------|-----|--------|
| Incoming calls | `https://ignis.cognovis.de/api/twilio/voice` | POST |
| Call status updates | `https://ignis.cognovis.de/api/twilio/status` | POST |
| WebSocket stream | `wss://ignis.cognovis.de/api/twilio/stream` | WebSocket |

## Architecture Flow

```
Patient calls +15722314881
    ↓
Twilio receives call → POST to /api/twilio/voice
    ↓
Backend returns TwiML with WebSocket URL
    ↓
Twilio connects to WebSocket at /api/twilio/stream
    ↓
Backend starts ElevenLabs conversation
    ↓
Backend bridges audio: Twilio ↔ ElevenLabs
    ↓
ElevenLabs agent handles conversation using tools:
  - patient_lookup (GET /api/patients/lookup)
  - patient_create_or_update (POST /api/patients)
  - get_available_slots (GET /api/appointments/slots)
  - book_appointment (POST /api/appointments)
  - add_to_urgent_queue (POST /api/queue/urgent)
  - register_emergency_transfer (POST /api/queue/emergency)
    ↓
Call ends → POST to /api/twilio/status
    ↓
Backend ends ElevenLabs conversation and cleans up
```

## Troubleshooting

### Issue: No audio or agent doesn't respond

**Check:**
1. WebSocket connection established: `docker compose logs app | grep WebSocket`
2. ElevenLabs conversation started: `docker compose logs app | grep ElevenLabs`
3. ElevenLabs API key valid: `docker compose logs app | grep "Failed to start"`

### Issue: Tools not being called

**Check:**
1. ElevenLabs agent dashboard shows tools configured
2. Tool URLs point to `https://ignis.cognovis.de/api/...`
3. Backend logs show incoming tool requests: `docker compose logs app | grep "GET /api"`

### Issue: Twilio webhook not triggering

**Check:**
1. Webhook URL is correct: `https://ignis.cognovis.de/api/twilio/voice`
2. URL is publicly accessible: `curl https://ignis.cognovis.de/health`
3. Check Twilio debugger: [Twilio Console → Monitor → Logs → Errors](https://console.twilio.com/us1/monitor/logs/errors)

### Issue: WebSocket connection fails

**Check:**
1. Nginx WebSocket proxy configured correctly
2. Server firewall allows WebSocket connections
3. Check Nginx logs: `docker compose logs nginx -f`

## Nginx WebSocket Configuration

Verify that `/infra/nginx/nginx.conf` has WebSocket upgrade headers:

```nginx
location /api/ {
    proxy_pass http://app:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Monitoring

**Active Conversations:**
```bash
curl https://ignis.cognovis.de/api/twilio/conversations
```

**Health Check:**
```bash
curl https://ignis.cognovis.de/health
```

**Live Logs:**
```bash
ssh hackathon@167.235.236.238
docker compose logs app -f | grep -E "(Twilio|ElevenLabs|WebSocket)"
```

## Next Steps After Deployment

1. ✅ Configure Twilio webhooks
2. ✅ Test with real phone call
3. ✅ Verify ElevenLabs agent uses tools correctly
4. ✅ Test all conversation flows:
   - New patient registration
   - Returning patient lookup
   - Appointment booking
   - Emergency detection
   - Urgent queue handling

## Support

- **Twilio Console:** https://console.twilio.com
- **Twilio Logs:** https://console.twilio.com/us1/monitor/logs/errors
- **ElevenLabs Dashboard:** https://elevenlabs.io/app/conversational-ai
- **Server Logs:** `docker compose logs app -f`
