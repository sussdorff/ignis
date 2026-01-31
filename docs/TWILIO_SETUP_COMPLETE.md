# Twilio + ElevenLabs Integration - Final Setup Steps

## ✅ Completed

1. ✅ Implemented Twilio webhook handlers
2. ✅ Implemented ElevenLabs API client
3. ✅ Implemented bidirectional audio streaming
4. ✅ Updated nginx for WebSocket support
5. ✅ Committed and pushed code to GitHub
6. ✅ Created deployment script

## 🚀 Next Steps (Manual)

### Step 1: Deploy to Production Server

Run the deployment script:

```bash
./infra/deploy-twilio.sh
```

Or manually:

```bash
ssh hackathon@167.235.236.238

cd /opt/ignis
git pull origin main

# Add credentials to .env
nano .env
# Add these lines (replace with your actual credentials):
# TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# TWILIO_PHONE_NUMBER=+15722314881
# ELEVENLABS_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# ELEVENLABS_AGENT_ID=agent_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Rebuild and restart
docker compose up -d --build app
docker compose restart nginx

# Check logs
docker compose logs app -f
```

### Step 2: Configure Twilio Webhooks

Go to [Twilio Console](https://console.twilio.com/):

1. Navigate to **Phone Numbers** → **Manage** → **Active Numbers**
2. Click on `+15722314881`
3. Under **Voice Configuration**:

   **A call comes in:**
   - Webhook: `https://ignis.cognovis.de/api/twilio/voice`
   - HTTP Method: `POST`

   **Call Status Changes:**
   - Webhook: `https://ignis.cognovis.de/api/twilio/status`
   - HTTP Method: `POST`

4. Click **Save**

### Step 3: Test the Integration

**Test 1: Make a Test Call**

Call your Twilio number: **+1 572-231-4881**

Expected behavior:
- ElevenLabs agent answers
- Agent speaks in German (or detects your language)
- You can interact with the agent

**Test 2: Monitor Logs**

```bash
ssh hackathon@167.235.236.238
docker compose logs app -f | grep -E "(Twilio|ElevenLabs|WebSocket)"
```

Look for:
```
[Twilio] Incoming call: CAxxxx from +1234567890 to +15722314881
[Twilio] Returning TwiML with stream URL: wss://ignis.cognovis.de/api/twilio/stream
[WebSocket] Twilio stream connected
[ElevenLabs] Started conversation: conv_xxxx
[WebSocket] Connected to ElevenLabs
```

**Test 3: Verify Tools Work**

During the call, try:
- "I'd like to book an appointment" → Should call `get_available_slots`
- Provide your name and birthdate → Should call `patient_lookup`
- Book an appointment → Should call `book_appointment`

Check backend logs for tool calls:
```bash
docker compose logs app | grep "GET /api" | tail -20
```

**Test 4: Debug Endpoint**

Check active conversations:
```bash
curl https://ignis.cognovis.de/api/twilio/conversations
```

### Step 4: Troubleshooting

**Issue: No audio or agent doesn't respond**

Check:
1. WebSocket connection: `docker compose logs app | grep WebSocket`
2. ElevenLabs conversation started: `docker compose logs app | grep ElevenLabs`
3. Check Twilio debugger: [https://console.twilio.com/us1/monitor/logs/errors](https://console.twilio.com/us1/monitor/logs/errors)

**Issue: Webhook not triggered**

Check:
1. Webhook URL configured correctly in Twilio
2. Server accessible: `curl https://ignis.cognovis.de/health`
3. Check Twilio debugger for webhook errors

**Issue: WebSocket connection fails**

Check:
1. Nginx WebSocket configuration updated
2. Nginx restarted: `docker compose restart nginx`
3. Check nginx logs: `docker compose logs nginx`

## 📚 Architecture

```
Patient calls +15722314881
    ↓
Twilio → POST /api/twilio/voice
    ↓
Backend returns TwiML with WebSocket URL
    ↓
Twilio → WebSocket /api/twilio/stream
    ↓
Backend → ElevenLabs conversation start
    ↓
Audio streaming: Twilio ↔ Backend ↔ ElevenLabs
    ↓
ElevenLabs agent uses tools:
  - GET /api/patients/lookup
  - POST /api/patients
  - GET /api/appointments/slots
  - POST /api/appointments
  - POST /api/queue/urgent
  - POST /api/queue/emergency
    ↓
Call ends → POST /api/twilio/status
    ↓
Backend ends ElevenLabs conversation
```

## 📊 Monitoring

**Active calls:**
```bash
curl https://ignis.cognovis.de/api/twilio/conversations
```

**Live logs:**
```bash
ssh hackathon@167.235.236.238
cd /opt/ignis
docker compose logs app -f
```

**Health check:**
```bash
curl https://ignis.cognovis.de/health
```

## ✅ Success Criteria

- [ ] Deployment script runs successfully
- [ ] Twilio webhooks configured
- [ ] Test call connects to ElevenLabs agent
- [ ] Agent responds in correct language
- [ ] Backend logs show conversation started
- [ ] Tools are called correctly (patient_lookup, etc.)
- [ ] Call ends cleanly without errors

## 📝 Documentation

- Full deployment guide: [`docs/TWILIO_DEPLOYMENT.md`](./TWILIO_DEPLOYMENT.md)
- Deployment script: [`infra/deploy-twilio.sh`](../infra/deploy-twilio.sh)
- Integration plan: [`~/.cursor/plans/twilio_elevenlabs_integration_*.plan.md`](~/.cursor/plans/)

## 🎉 You're Done!

Once all tests pass, your Twilio + ElevenLabs integration is live!

Patients can now call your number and interact with the AI voice agent.
