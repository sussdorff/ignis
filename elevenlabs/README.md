# ElevenLabs Agent Configuration

This directory contains the ElevenLabs Conversational AI agent configuration, synced from the cloud for version control.

## Files

| File | Description |
|------|-------------|
| `agent-config.json` | Full agent configuration (reference only) |
| `agent-settings.json` | Key settings: name, LLM, voice, phone numbers |
| `system-prompt.md` | **Editable** system prompt for the agent |
| `tools/*.json` | Individual tool configurations |

## Scripts

```bash
# Export current config from ElevenLabs to local files
bun run elevenlabs:export

# Preview what changes would be applied
bun run elevenlabs:import:dry

# Apply local changes to ElevenLabs
bun run elevenlabs:import
```

## Environment Variables

Required:
- `ELEVENLABS_API_KEY` - Your ElevenLabs API key

Optional:
- `ELEVENLABS_AGENT_ID` - Agent ID (defaults to Ignis Demo Praxis agent)

## Workflow

### Making changes

1. Edit the system prompt in `system-prompt.md`
2. Or modify tool configs in `tools/*.json`
3. Preview changes: `bun run elevenlabs:import:dry`
4. Apply changes: `bun run elevenlabs:import`
5. Commit changes to git

### Keeping in sync

After changes in the ElevenLabs dashboard:
1. Export: `bun run elevenlabs:export`
2. Review and commit changes

## Agent Details

- **Name:** Ignis Demo Praxis
- **Agent ID:** `agent_8101kgaq3e85ecqay2ctsjgp0y2e`
- **LLM:** gemini-2.5-flash
- **Voice:** WyFXw4PzMbRnp8iLMJwY
- **Phone:** +1 572-231-4881 (Twilio)

## Tools

| Tool | Endpoint | Purpose |
|------|----------|---------|
| patient_lookup | GET /api/patients/lookup | Find patient by name/phone/DOB |
| patient_create_or_update | POST /api/patients | Register new patient |
| get_available_slots | GET /api/appointments/slots | Find appointment times |
| book_appointment | POST /api/appointments | Book an appointment |
| cancel_appointment | POST /api/appointments/cancel/{id} | Cancel appointment |
| add_to_urgent_queue | POST /api/queue/urgent | Add to urgent callback |
| register_emergency_transfer | POST /api/queue/emergency | Log emergency |
| request_callback | POST /api/callback | Request staff callback |
| get_intake_questions | GET /api/appointments/intake-questions | Get follow-up questions |
