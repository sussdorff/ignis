# SIPgate → ElevenLabs Direct Integration Guide

## Overview

Connect your SIPgate German phone number directly to ElevenLabs Conversational AI agent, bypassing Twilio entirely.

**Flow:**
```
German caller → SIPgate number → ElevenLabs SIP endpoint → 
ElevenLabs agent (voice conversation) → Your backend APIs (tools)
```

**Benefits:**
- ✅ Works with German phone numbers
- ✅ No Twilio needed or costs
- ✅ Direct SIP connection
- ✅ Your backend tools still work (patient_lookup, booking, etc.)
- ✅ 10-15 minute setup

---

## Prerequisites

You said you have all SIPgate data, so you should have:
- ✅ SIPgate account
- ✅ German phone number on SIPgate
- ✅ SIPgate SIP credentials (username/password)

---

## Implementation Steps

### Step 1: Import Phone Number in ElevenLabs

**1.1 Go to ElevenLabs Phone Numbers**

Navigate to: https://elevenlabs.io/app/agents/phone-numbers

**1.2 Click "Import a phone number from SIP trunk"**

You'll see a configuration dialog.

**1.3 Enter Basic Configuration**

| Field | Value |
|-------|-------|
| **Label** | `Ignis SIPgate Number` (or any descriptive name) |
| **Phone Number** | Your German number in E.164 format (e.g., `+4930123456789`) |

⚠️ **Important**: Use E.164 format with `+` prefix (e.g., `+49` for Germany)

**1.4 Configure Transport and Encryption (Inbound)**

These settings control how ElevenLabs receives calls FROM SIPgate:

| Field | Value | Notes |
|-------|-------|-------|
| **Transport Type** | **TLS** (recommended) or TCP | Use TLS for security |
| **Media Encryption** | **Required** (recommended) or Allowed | SRTP encryption |

**1.5 Configure Outbound Settings**

These settings control how ElevenLabs sends calls TO SIPgate (for outbound calls):

| Field | Value |
|-------|-------|
| **Address** | Your SIPgate SIP server hostname (see SIPgate dashboard) |
| **Transport Type** | TLS (recommended) or TCP |
| **Media Encryption** | Required (recommended) or Allowed |

**Common SIPgate addresses:**
- `sipgate.de`
- `sipgate.com`
- Or check your SIPgate settings for the exact hostname

**1.6 Add Custom Headers (Optional)**

Leave empty unless SIPgate requires specific headers.

**1.7 Configure Authentication**

| Field | Value |
|-------|-------|
| **SIP Trunk Username** | Your SIPgate SIP username |
| **SIP Trunk Password** | Your SIPgate SIP password |

🔑 **Find SIPgate credentials:**
1. Log into SIPgate dashboard
2. Go to Settings → SIP credentials
3. Copy username and password

**1.8 Click "Import"**

ElevenLabs will save your SIP trunk configuration.

---

### Step 2: Assign Agent to Phone Number

**2.1 In Phone Numbers section**

After importing, you'll see your phone number listed.

**2.2 Click "Assign Agent"**

Select your agent: **"Ignis Demo Praxis"** (agent_8101kgaq3e85ecqay2ctsjgp0y2e)

**2.3 Save**

Your agent is now connected to the phone number!

---

### Step 3: Configure SIPgate to Forward Calls

Now we need to tell SIPgate to send calls to ElevenLabs instead of handling them locally.

**3.1 Log into SIPgate Dashboard**

Go to: https://app.sipgate.com (or your SIPgate portal)

**3.2 Navigate to Your Phone Number Settings**

Find your German phone number in the phone numbers list.

**3.3 Configure Call Forwarding**

**Option A: Direct SIP Forwarding** (if SIPgate supports it)

Set incoming calls to forward to:
```
sip:+49YOURNUMBER@sip.rtc.elevenlabs.io:5060
```

Replace `+49YOURNUMBER` with your actual German phone number in E.164 format.

**Option B: SIP Trunk Configuration** (more common)

1. Create a new SIP trunk or routing rule
2. Set destination as: `sip.rtc.elevenlabs.io`
3. Port: `5060` (TCP) or `5061` (TLS)
4. Transport: TLS (recommended) or TCP
5. Forward all incoming calls to this trunk

**3.4 Save Configuration**

SIPgate will now route calls to ElevenLabs.

---

### Step 4: Configure SIPgate SIP Credentials (for Outbound)

If you want ElevenLabs to make outbound calls through SIPgate:

**4.1 In SIPgate Dashboard**

Find your SIP credentials section

**4.2 Allow ElevenLabs IPs** (if using IP-based auth)

SIPgate may require you to whitelist ElevenLabs IP addresses. Contact ElevenLabs support for their IP ranges.

**4.3 Or use Digest Authentication**

Ensure your SIPgate SIP username/password are configured (already done in Step 1.7)

---

## Testing

### Test 1: Make a Test Call

Call your German SIPgate number from any phone.

**Expected behavior:**
1. Call routes through SIPgate
2. SIPgate forwards to ElevenLabs SIP endpoint
3. ElevenLabs agent answers
4. You can talk to the AI agent

### Test 2: Check ElevenLabs Logs

Go to: https://elevenlabs.io/app/agents/analytics

Look for your conversation - you should see:
- Call duration
- Conversation transcript
- Tool calls to your backend

### Test 3: Verify Backend Tools Work

During the call, try:
- "I'd like to book an appointment" → Should call your backend API
- Give your name and birthdate → Should call patient_lookup

Check backend logs:
```bash
ssh hackathon@167.235.236.238
docker compose logs app -f | grep -E "(GET /api|POST /api)"
```

You should see ElevenLabs calling your tools!

---

## Troubleshooting

### Issue: Call doesn't connect

**Check:**
1. **SIPgate configuration**: Is call forwarding enabled to ElevenLabs?
2. **Phone number format**: Must match in both SIPgate and ElevenLabs (with or without `+`)
3. **SIP credentials**: Are username/password correct in ElevenLabs?

**Test directly:**
```bash
# Check if SIPgate can reach ElevenLabs SIP endpoint
nslookup sip.rtc.elevenlabs.io
```

### Issue: Agent doesn't answer

**Check:**
1. **Agent assigned**: Go to ElevenLabs → Phone Numbers → Verify agent is assigned
2. **Agent published**: Ensure your agent is published (not in draft mode)
3. **ElevenLabs logs**: Check for any errors in ElevenLabs dashboard

### Issue: No audio or one-way audio

**Check:**
1. **Media encryption**: Try "Allowed" instead of "Required" if having issues
2. **Firewall**: Ensure UDP ports 10000-60000 are open for RTP audio
3. **Codec compatibility**: SIPgate should support G711 or G722

### Issue: Tools not being called

**Check:**
1. **Agent tools configured**: In ElevenLabs dashboard, verify tools point to `https://ignis.cognovis.de/api`
2. **Backend accessible**: Test: `curl https://ignis.cognovis.de/health`
3. **ElevenLabs can reach backend**: Check if ElevenLabs IPs can access your server

---

## SIPgate-Specific Configuration

### Common SIPgate SIP Servers:

- **Germany**: `sipgate.de` or `sipgate.com`
- **UK**: `sipgate.co.uk`
- **Check your SIPgate dashboard** for the exact hostname

### SIPgate Authentication:

SIPgate typically uses **digest authentication** (username/password), which is what we configured in Step 1.7.

### SIPgate Call Forwarding:

SIPgate supports several forwarding methods:
1. **Unconditional forward** - All calls go to ElevenLabs
2. **Conditional forward** - Based on time, availability, etc.
3. **SIP trunk routing** - Professional routing rules

Choose based on your needs. For testing, use unconditional forward.

---

## Important SIP Format Requirements

### Phone Number Format MUST Match!

**If your SIPgate forwards calls as:**
```
sip:+4930123456789@sip.rtc.elevenlabs.io
```

**Then import in ElevenLabs as:**
```
+4930123456789
```

**If SIPgate forwards as:**
```
sip:4930123456789@sip.rtc.elevenlabs.io
```

**Then import in ElevenLabs as:**
```
4930123456789
```

The formats MUST match exactly!

---

## What About the Twilio Integration We Built?

The Twilio WebSocket bridge we built is **not needed** for SIPgate → ElevenLabs direct connection.

**What still works:**
- ✅ All your backend API endpoints (/api/patients, /api/appointments, etc.)
- ✅ ElevenLabs tools configuration
- ✅ Patient lookup, booking, queue management
- ✅ Your FHIR data in Aidbox

**What's different:**
- ❌ Twilio webhook handlers not used
- ❌ WebSocket audio bridge not used
- ✅ SIPgate → ElevenLabs direct SIP connection
- ✅ ElevenLabs → Your backend via HTTPS (for tools)

---

## Architecture Comparison

### Old (Twilio):
```
Caller → Twilio → Your Backend WebSocket Bridge → ElevenLabs → Backend APIs
```

### New (SIPgate):
```
Caller → SIPgate → ElevenLabs (direct SIP) → Backend APIs
```

**Simpler and works with German numbers!**

---

## Next Steps

1. **Import phone number** in ElevenLabs (Step 1)
2. **Assign agent** to phone number (Step 2)
3. **Configure SIPgate** forwarding (Step 3)
4. **Test call** and verify it works
5. **Check backend logs** to confirm tools are being called

---

## Support Resources

- **ElevenLabs SIP Docs**: https://elevenlabs.io/docs/agents-platform/phone-numbers/sip-trunking
- **ElevenLabs Phone Numbers**: https://elevenlabs.io/app/agents/phone-numbers
- **SIPgate Support**: https://www.sipgate.de/support
- **Your Backend**: https://ignis.cognovis.de

---

## Quick Reference

| Component | Value |
|-----------|-------|
| **ElevenLabs SIP Endpoint** | `sip.rtc.elevenlabs.io:5060` (TCP) or `:5061` (TLS) |
| **Your German Number** | Your SIPgate number in E.164 format |
| **Backend API Base** | `https://ignis.cognovis.de/api` |
| **ElevenLabs Agent ID** | `agent_8101kgaq3e85ecqay2ctsjgp0y2e` |

---

**Ready to start? Begin with Step 1: Import your phone number in ElevenLabs!** 🚀
