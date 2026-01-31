# Step 2: Configure Twilio Webhooks - Detailed Guide

## Overview

You need to tell Twilio where to send call events. This connects your phone number to your backend.

## Prerequisites

- ✅ Code deployed to production server (Step 1 complete)
- ✅ Twilio account with phone number: `+15722314881`
- ✅ Backend accessible at: `https://ignis.cognovis.de`

## Step-by-Step Instructions

### 1. Log into Twilio Console

Go to: **https://console.twilio.com**

Log in with your Twilio account credentials.

### 2. Navigate to Phone Numbers

**Option A: Direct Link**
- Go directly to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming

**Option B: From Dashboard**
1. From the left sidebar, click **Develop**
2. Click **Phone Numbers**
3. Click **Manage**
4. Click **Active numbers**

You should see a list of your phone numbers.

### 3. Select Your Phone Number

Click on your phone number: **+15722314881**

This opens the phone number configuration page.

### 4. Scroll to Voice Configuration Section

Look for the section titled **"Voice Configuration"** or **"Voice & Fax"**

You'll see several fields here:

#### Field 1: "A CALL COMES IN"

This is the main webhook that Twilio calls when someone dials your number.

**Configure as follows:**

| Field | Value |
|-------|-------|
| **Webhook/TwiML App** | Select **"Webhook"** |
| **URL** | `https://ignis.cognovis.de/api/twilio/voice` |
| **HTTP Method** | Select **"HTTP POST"** |

⚠️ **Important**: Make sure you select **POST**, not GET!

#### Field 2: "PRIMARY HANDLER FAILS"

Leave this as default or set to:
- **URL**: (leave empty or same as above)
- This is optional - only triggers if the primary webhook fails

#### Field 3: "CALL STATUS CHANGES"

This webhook tracks call lifecycle (answered, completed, failed, etc.)

**Configure as follows:**

| Field | Value |
|-------|-------|
| **URL** | `https://ignis.cognovis.de/api/twilio/status` |
| **HTTP Method** | Select **"HTTP POST"** |

⚠️ **Important**: Make sure you select **POST**, not GET!

### 5. Save Configuration

At the bottom of the page, click the **"Save"** or **"Save configuration"** button.

Twilio will save your webhook configuration.

### 6. Verify Configuration

After saving, you should see:

```
✓ Phone number configuration saved
```

Double-check that the URLs are exactly:
- Voice: `https://ignis.cognovis.de/api/twilio/voice`
- Status: `https://ignis.cognovis.de/api/twilio/status`

## Visual Reference

Here's what each field should look like:

```
┌─────────────────────────────────────────────────┐
│ Voice Configuration                             │
├─────────────────────────────────────────────────┤
│                                                 │
│ A CALL COMES IN                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ [•] Webhook  [ ] TwiML Bin  [ ] TwiML App   │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────┐ │
│ │ https://ignis.cognovis.de/api/twilio/voice  │ │
│ └─────────────────────────────────────────────┘ │
│ [HTTP POST ▼]                                   │
│                                                 │
│ PRIMARY HANDLER FAILS                           │
│ ┌─────────────────────────────────────────────┐ │
│ │ (optional)                                   │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ CALL STATUS CHANGES                             │
│ ┌─────────────────────────────────────────────┐ │
│ │ https://ignis.cognovis.de/api/twilio/status │ │
│ └─────────────────────────────────────────────┘ │
│ [HTTP POST ▼]                                   │
│                                                 │
│         [Save configuration]                    │
└─────────────────────────────────────────────────┘
```

## Testing the Configuration

### Test 1: Verify Webhooks are Saved

1. Refresh the phone number page
2. Check that both URLs are still there
3. Confirm both are set to **HTTP POST**

### Test 2: Make a Test Call

1. From any phone, call: **+1 572-231-4881**
2. You should hear the ElevenLabs agent answer

### Test 3: Check Twilio Logs

If the call doesn't work:

1. Go to: https://console.twilio.com/us1/monitor/logs/calls
2. Click on your recent call
3. Look for webhook request/response details
4. Check for any errors (red indicators)

Common errors:
- **11200**: HTTP retrieval failure (URL not accessible)
- **11205**: HTTP connection failure (server not responding)
- **11206**: HTTP protocol violation (wrong response format)

### Test 4: Check Backend Logs

```bash
ssh hackathon@167.235.236.238
docker compose logs app -f | grep Twilio
```

You should see:
```
[Twilio] Incoming call: CAxxxx from +1234567890 to +15722314881
[Twilio] Returning TwiML with stream URL: wss://ignis.cognovis.de/api/twilio/stream
```

## Troubleshooting

### Issue: "URL not accessible" error

**Problem**: Twilio can't reach your webhook URL

**Solutions**:
1. Verify server is running:
   ```bash
   curl https://ignis.cognovis.de/health
   # Should return: {"status":"ok","timestamp":"..."}
   ```

2. Check if backend is accessible:
   ```bash
   curl https://ignis.cognovis.de/api/twilio/voice
   # Should return TwiML (even without proper call data)
   ```

3. Check nginx is running:
   ```bash
   ssh hackathon@167.235.236.238
   docker compose ps nginx
   # Should show "Up"
   ```

### Issue: "HTTP protocol violation"

**Problem**: Backend returned wrong response format

**Solutions**:
1. Check backend logs for errors:
   ```bash
   docker compose logs app --tail=50 | grep error
   ```

2. Verify TwiML is valid (should be XML):
   ```bash
   curl -X POST https://ignis.cognovis.de/api/twilio/voice
   # Should return XML starting with: <?xml version="1.0" encoding="UTF-8"?>
   ```

### Issue: Call connects but no audio

**Problem**: WebSocket connection failed

**Solutions**:
1. Check WebSocket is working:
   ```bash
   docker compose logs app | grep WebSocket
   ```

2. Verify nginx WebSocket config:
   ```bash
   cat /opt/ignis/infra/nginx/nginx.conf | grep -A 5 "Upgrade"
   # Should show: proxy_set_header Upgrade $http_upgrade;
   ```

3. Check ElevenLabs conversation started:
   ```bash
   docker compose logs app | grep ElevenLabs
   # Should show: [ElevenLabs] Started conversation: conv_xxxx
   ```

### Issue: Agent doesn't respond to questions

**Problem**: ElevenLabs tools not configured correctly

**Solutions**:
1. Go to ElevenLabs dashboard: https://elevenlabs.io/app/conversational-ai
2. Select your agent: "Ignis Demo Praxis"
3. Click on "Tools" tab
4. Verify all 6 tools are configured with base URL: `https://ignis.cognovis.de/api`

## Advanced: Webhook Security (Optional)

To add webhook signature verification:

1. In Twilio Console, copy your **Auth Token**
2. The backend already validates signatures using `TWILIO_AUTH_TOKEN` from `.env`
3. No additional configuration needed - it's automatic!

## What Happens After Configuration

When someone calls your number:

1. **Twilio receives call** → Sends POST to `/api/twilio/voice`
2. **Backend responds** with TwiML containing WebSocket URL
3. **Twilio connects** to WebSocket at `/api/twilio/stream`
4. **Backend starts** ElevenLabs conversation
5. **Audio streams** bidirectionally through backend
6. **ElevenLabs agent** handles conversation using your tools
7. **Call ends** → Twilio sends POST to `/api/twilio/status`
8. **Backend cleans up** conversation

## Next Step

After webhooks are configured, proceed to **Step 3: Test** in the main guide!

## Quick Reference

| Configuration | Value |
|---------------|-------|
| **Phone Number** | +15722314881 |
| **Voice Webhook** | https://ignis.cognovis.de/api/twilio/voice |
| **Status Webhook** | https://ignis.cognovis.de/api/twilio/status |
| **HTTP Method** | POST (both) |
| **Twilio Console** | https://console.twilio.com |
| **Phone Numbers Page** | https://console.twilio.com/us1/develop/phone-numbers/manage/incoming |
| **Call Logs** | https://console.twilio.com/us1/monitor/logs/calls |

---

**Need help?** Check the Twilio webhook debugger at: https://console.twilio.com/us1/monitor/logs/errors
