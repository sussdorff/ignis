#!/bin/bash
# generate-appointments.sh - Generate FHIR Schedule/Slot/Appointment data using Claude
#
# This script uses Claude Code to generate realistic appointment data by:
# 1. Creating Schedules for practitioners
# 2. Creating time Slots within those schedules
# 3. Creating Appointments that link patients to slots, with reasonReference
#    pointing to the patient's existing Conditions
#
# Usage: ./generate-appointments.sh [days] [appointments]
#   days:         Number of days to generate slots for (default: 5)
#   appointments: Approximate number of appointments to create (default: 40)
#
# Examples:
#   ./generate-appointments.sh           # 5 days, ~40 appointments
#   ./generate-appointments.sh 7 100     # 7 days, ~100 appointments
#
# Environment variables:
#   FHIR_BASE_URL - FHIR endpoint (default: https://ignis.cognovis.de/fhir)
#   FHIR_USER     - Auth username (default: admin)
#   FHIR_PASS     - Auth password (default: ignis2026)
#
# Requirements:
#   - Claude Code CLI installed and authenticated
#   - curl, jq

set -euo pipefail

FHIR_BASE_URL="${FHIR_BASE_URL:-https://ignis.cognovis.de/fhir}"
FHIR_USER="${FHIR_USER:-admin}"
FHIR_PASS="${FHIR_PASS:-ignis2026}"
DAYS="${1:-5}"
APPOINTMENTS="${2:-40}"

# Get current date
START_DATE=$(date +%Y-%m-%d)
END_DATE=$(date -v+${DAYS}d +%Y-%m-%d 2>/dev/null || date -d "+${DAYS} days" +%Y-%m-%d)

echo "========================================"
echo "  FHIR Appointment Data Generator"
echo "========================================"
echo ""
echo "FHIR Server: $FHIR_BASE_URL"
echo "Date Range:  $START_DATE to $END_DATE"
echo "Target Appointments: ~$APPOINTMENTS"
echo ""

# The prompt for Claude to generate the data
PROMPT=$(cat <<EOF
Generate FHIR R4 Schedule, Slot, and Appointment resources for the ignis FHIR server.

**FHIR Server:**
- URL: $FHIR_BASE_URL
- Auth: Basic auth, user: $FHIR_USER, password: $FHIR_PASS

**Task:**
1. First, get 4-6 practitioners from the server to create schedules for
2. Create a Schedule for each practitioner (for $DAYS days starting from $START_DATE)
3. Create Slots for each schedule (15-minute slots from 08:00-12:00 and 14:00-17:00)
4. Get 30+ patients and their Conditions from the server
5. Create approximately $APPOINTMENTS Appointments for various slots, linking:
   - The patient
   - The slot (mark it as "busy")
   - The practitioner
   - **reasonReference** pointing to one of the patient's existing Conditions
   - Also set **reasonCode** with the condition's code/display from SNOMED CT

**FHIR Resources to create:**

Schedule:
\`\`\`json
{
  "resourceType": "Schedule",
  "id": "schedule-<practitioner-id>",
  "active": true,
  "actor": [{"reference": "Practitioner/<id>", "display": "Dr. Name"}],
  "planningHorizon": {"start": "$START_DATE", "end": "$END_DATE"}
}
\`\`\`

Slot:
\`\`\`json
{
  "resourceType": "Slot",
  "id": "slot-<unique-id>",
  "schedule": {"reference": "Schedule/<id>"},
  "status": "free" or "busy",
  "start": "${START_DATE}T08:00:00+01:00",
  "end": "${START_DATE}T08:15:00+01:00"
}
\`\`\`

Appointment:
\`\`\`json
{
  "resourceType": "Appointment",
  "id": "appointment-<number>",
  "status": "booked",
  "start": "...",
  "end": "...",
  "slot": [{"reference": "Slot/<id>"}],
  "reasonReference": [{"reference": "Condition/<patient-condition-id>"}],
  "reasonCode": [{"coding": [{"system": "http://snomed.info/sct", "code": "...", "display": "..."}]}],
  "participant": [
    {"actor": {"reference": "Patient/<id>", "display": "Patient Name"}, "status": "accepted"},
    {"actor": {"reference": "Practitioner/<id>", "display": "Dr. Name"}, "status": "accepted"}
  ]
}
\`\`\`

Use PUT requests to create resources with predictable IDs. Make sure:
- Some slots remain free (status: "free") for new bookings
- Appointments are spread across different days and times
- Each appointment's reasonReference points to an actual Condition the patient has

Execute all curl commands to create the resources on the server. Report a summary at the end.
EOF
)

echo "Starting Claude Code to generate appointment data..."
echo ""

# Run Claude Code with the prompt
# Using --print to output directly, haiku model for speed
claude --print --model haiku "$PROMPT"

echo ""
echo "========================================"
echo "  Generation Complete"
echo "========================================"
echo ""

# Verify results
echo "Verifying created resources..."
echo ""
SCHEDULES=$(curl -s -u "${FHIR_USER}:${FHIR_PASS}" "${FHIR_BASE_URL}/Schedule?_summary=count" | jq -r '.total // 0')
SLOTS=$(curl -s -u "${FHIR_USER}:${FHIR_PASS}" "${FHIR_BASE_URL}/Slot?_summary=count" | jq -r '.total // 0')
APPTS=$(curl -s -u "${FHIR_USER}:${FHIR_PASS}" "${FHIR_BASE_URL}/Appointment?_summary=count" | jq -r '.total // 0')
FREE_SLOTS=$(curl -s -u "${FHIR_USER}:${FHIR_PASS}" "${FHIR_BASE_URL}/Slot?status=free&_summary=count" | jq -r '.total // 0')

echo "  Schedules:    $SCHEDULES"
echo "  Total Slots:  $SLOTS"
echo "  Free Slots:   $FREE_SLOTS"
echo "  Appointments: $APPTS"
echo ""
