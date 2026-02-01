# ElevenLabs Test Cases

> Generated from live Aidbox FHIR database at https://ignis.cognovis.de/fhir  
> Last verified: 2026-01-31 21:00 CET

## Database Summary

| Resource | Count |
|----------|-------|
| Patients | 310+ |
| Practitioners | 240 |
| Appointments | 41 |
| Slots | 560 |

## Backend Endpoint Status

All endpoints verified working:

| Endpoint | Method | Status | Response |
|----------|--------|--------|----------|
| `/api/patients/lookup` | GET | OK | Returns found/patient/upcomingAppointment |
| `/api/patients` | POST | OK | Creates/updates patient |
| `/api/appointments/slots` | GET | OK | Returns available slots |
| `/api/appointments` | POST | OK | Books appointment |
| `/api/appointments/cancel/{id}` | POST | OK | Cancels appointment |
| `/api/queue/urgent` | POST | OK | Adds to urgent queue |
| `/api/queue/emergency` | POST | OK | Registers emergency |
| `/api/callback` | POST | OK | Creates callback request |

---

## Demo Patients (German)

### Patient 1: Hans Müller (Has Existing Appointment)

| Field | Value |
|-------|-------|
| ID | `patient-1` |
| Name | Hans Müller |
| DOB | **1985-03-15** |
| DOB (spoken DE) | "fünfzehnter März neunzehnhundertfünfundachtzig" |
| DOB (spoken EN) | "March 15, 1985" |
| Phone | +49 170 1234567 |
| Address | Musterstraße 42, 20095 Hamburg |
| Gender | Male |
| **Appointment** | Feb 3, 2026 at 09:00 - Routineuntersuchung |
| Appointment ID | `appointment-1` |

### Patient 2: Maria Weber

| Field | Value |
|-------|-------|
| ID | `patient-2` |
| Name | Maria Weber |
| DOB | **1972-08-22** |
| DOB (spoken DE) | "zweiundzwanzigster August neunzehnhundertzweiundsiebzig" |
| DOB (spoken EN) | "August 22, 1972" |
| Phone | +49 171 9876543 |
| Address | Hauptstraße 10, 20099 Hamburg |
| Gender | Female |

### Patient 3: Thomas Becker

| Field | Value |
|-------|-------|
| ID | `patient-3` |
| Name | Thomas Becker |
| DOB | **1990-12-01** |
| DOB (spoken DE) | "erster Dezember neunzehnhundertneunzig" |
| DOB (spoken EN) | "December 1, 1990" |
| Phone | +49 172 5555555 |
| Gender | Male |

---

## Practitioner

| Field | Value |
|-------|-------|
| ID | `practitioner-1` |
| Name | Dr. Anna Schmidt |
| Specialty | Allgemeinmedizin (General Practice) |
| Phone | +49 40 123456 |
| Email | anna.schmidt@praxis-ignis.de |

---

## Test Scenarios

### Test 1: Returning Patient - Regular Booking (German)

**Goal:** Verify patient_lookup finds existing patient and get_available_slots works

**Script:**
```
You: "Guten Tag, ich möchte einen Termin machen."

Agent: "Guten Tag, hier ist Ignis Demo Praxis. Mein Name ist Lisa. Ich helfe Ihnen gerne. 
        Dürfte ich Ihren Namen und Ihr Geburtsdatum haben?"

You: "Hans Müller, geboren am 15. März 1985"

[Agent calls patient_lookup with name="Hans Müller", birthDate="1985-03-15"]
[Response: found=true, patientId="patient-1", patientName="Herr Müller", 
 upcomingAppointment={appointmentId: "appointment-1", start: "2026-02-03T09:00:00"}]

Agent: "Willkommen zurück, Herr Müller! Ich sehe Sie haben bereits einen Termin am 
        3. Februar um 9 Uhr. Was führt Sie heute zu uns?"

You: "Ich brauche einen zusätzlichen Termin für eine Grippeimpfung"

[Agent calls get_available_slots with date="2026-02-04", urgency="routine"]

Agent: "Ich habe folgende Termine verfügbar: Dienstag um 10 Uhr, Mittwoch um 14:30. 
        Welcher passt Ihnen besser?"

You: "Dienstag um 10 Uhr"

[Agent calls book_appointment with slotId=..., patientId="patient-1", reason="Grippeimpfung"]

Agent: "Perfekt. Ich bestätige: Hans Müller, Termin am Dienstag, 4. Februar um 10 Uhr 
        für eine Grippeimpfung. Ist das richtig?"

You: "Ja, danke"

Agent: "Ihr Termin ist bestätigt. Wir sehen uns am Dienstag. Kann ich Ihnen noch bei 
        etwas anderem helfen?"
```

**Expected Tool Calls:**
1. `patient_lookup` → found: true
2. `get_available_slots` → list of slots
3. `book_appointment` → appointment created

---

### Test 2: Cancel Existing Appointment (German)

**Goal:** Verify patient lookup returns upcoming appointment and cancel_appointment works

**Script:**
```
You: "Hallo, ich möchte meinen Termin absagen"

Agent: "Guten Tag, hier ist Ignis Demo Praxis. Ich helfe Ihnen gerne dabei. 
        Dürfte ich Ihren Namen und Ihr Geburtsdatum haben?"

You: "Hans Müller, 15.03.1985"

[Agent calls patient_lookup with name="Hans Müller", birthDate="1985-03-15"]
[Response includes upcomingAppointment]

Agent: "Herr Müller, ich sehe Ihren Termin am 3. Februar um 9 Uhr für eine 
        Routineuntersuchung. Möchten Sie diesen Termin absagen?"

You: "Ja bitte"

[Agent calls cancel_appointment with appointmentId="appointment-1"]

Agent: "Ihr Termin wurde abgesagt. Möchten Sie einen neuen Termin vereinbaren?"

You: "Nein danke, ich melde mich später"

Agent: "Alles klar. Vielen Dank für Ihren Anruf bei Ignis Demo Praxis. Auf Wiederhören!"
```

**Expected Tool Calls:**
1. `patient_lookup` → found: true with upcomingAppointment
2. `cancel_appointment` → cancelled: true

---

### Test 3: New Patient Registration (German)

**Goal:** Verify new patient flow with patient_create_or_update

**Script:**
```
You: "Guten Tag, ich bin neu hier und brauche einen Termin"

Agent: "Guten Tag, hier ist Ignis Demo Praxis. Ich helfe Ihnen gerne. 
        Dürfte ich Ihren Namen und Ihr Geburtsdatum haben?"

You: "Peter Schulz, geboren am 5. Juni 1988"

[Agent calls patient_lookup with name="Peter Schulz", birthDate="1988-06-05"]
[Response: found=false]

Agent: "Ich sehe Sie noch nicht in unserem System. Kein Problem - ich kann Sie 
        jetzt als neuen Patienten aufnehmen. Darf ich Ihre Telefonnummer notieren?"

You: "0173 4567890"

Agent: "0173 4567890 - ist das korrekt?"

You: "Ja, genau"

[Agent calls patient_create_or_update with:
 family="Schulz", given="Peter", birthDate="1988-06-05", phone="+491734567890"]

Agent: "Vielen Dank, ich habe Sie registriert. Was führt Sie zu uns?"

You: "Ich brauche einen Gesundheitscheck"

[Agent continues with get_available_slots...]
```

**Expected Tool Calls:**
1. `patient_lookup` → found: false
2. `patient_create_or_update` → patient created
3. `get_available_slots` → list of slots
4. `book_appointment` → appointment created

---

### Test 4: Returning Patient - English

**Goal:** Verify language detection and English conversation flow

**Script:**
```
You: "Hi, I'd like to book an appointment"

Agent: "Hello, this is Ignis Demo Praxis. My name is Lisa. I'd be happy to help. 
        May I have your name and date of birth?"

You: "Maria Weber, August 22, 1972"

[Agent calls patient_lookup with name="Maria Weber", birthDate="1972-08-22"]
[Response: found=true, patientId="patient-2"]

Agent: "Welcome back, Ms. Weber! What can I help you with today?"

You: "I need a routine checkup"

[Agent calls get_available_slots]

Agent: "I have the following times available: Tuesday at 2pm, Wednesday at 10am. 
        Which works better for you?"
```

**Expected Tool Calls:**
1. `patient_lookup` → found: true
2. `get_available_slots` → list of slots

---

### Test 5: Emergency Detection Mid-Conversation (German)

**Goal:** Verify emergency detection interrupts flow and calls register_emergency_transfer

**Script:**
```
You: "Guten Tag, ich möchte einen Termin für..."

Agent: "Guten Tag, hier ist Ignis Demo Praxis..."

You: "...warten Sie, ich habe gerade starke Brustschmerzen"

[Agent IMMEDIATELY calls register_emergency_transfer with reason="Brustschmerzen"]

Agent: "Ich höre, dass Sie Brustschmerzen haben. Das ist sehr wichtig. 
        Ich leite Ihren Anruf jetzt an unser medizinisches Personal weiter. 
        Bitte bleiben Sie dran."
```

**Emergency Keywords to Test:**
- German: Brustschmerzen, Atemnot, starke Blutung, bewusstlos, Herzinfarkt
- English: chest pain, can't breathe, severe bleeding, unconscious, heart attack

**Expected Tool Calls:**
1. `register_emergency_transfer` → immediately, before any other tool

---

### Test 6: Emergency Detection (English)

**Goal:** Verify English emergency detection

**Script:**
```
You: "Hello, I'm calling because I can't breathe properly"

[Agent IMMEDIATELY calls register_emergency_transfer with reason="difficulty breathing"]

Agent: "I hear you're having difficulty breathing. This is very important. 
        I'm redirecting your call to our medical staff right now. 
        Please stay on the line."
```

---

### Test 7: Urgent Case - Post-Surgery Bleeding (German)

**Goal:** Verify urgent triage and add_to_urgent_queue when no slots available

**Script:**
```
You: "Hallo, ich hatte gestern eine Operation und die Wunde blutet ziemlich stark"

Agent: "Ich verstehe, dass Sie Blutungen von Ihrer Operationswunde haben. 
        Das braucht heute Aufmerksamkeit. Dürfte ich Ihren Namen und 
        Ihr Geburtsdatum haben?"

You: "Thomas Becker, 1. Dezember 1990"

[Agent calls patient_lookup with name="Thomas Becker", birthDate="1990-12-01"]
[Response: found=true, patientId="patient-3"]

Agent: "Herr Becker, lassen Sie mich einen dringenden Termin für heute finden."

[Agent calls get_available_slots with date=today, urgency="urgent"]
[Response: no slots available]

Agent: "Leider sind heute keine Termine mehr frei. Ich setze Sie auf unsere 
        Dringlichkeitsliste. Ein Mitarbeiter wird Sie so schnell wie möglich zurückrufen."

[Agent calls add_to_urgent_queue with patientId="patient-3", 
 reason="Post-OP Blutung", phone="+49 172 5555555"]

Agent: "Ich habe Sie auf unsere Dringlichkeitsliste gesetzt. Bitte halten Sie 
        Ihr Telefon bereit. Kann ich sonst noch etwas für Sie tun?"
```

**Expected Tool Calls:**
1. `patient_lookup` → found: true
2. `get_available_slots` with urgency="urgent" → no slots
3. `add_to_urgent_queue` → queueEntryId returned

---

### Test 8: Prescription Refill Request (English)

**Goal:** Verify out-of-scope request routes to request_callback

**Script:**
```
You: "Hi, I need a refill on my blood pressure medication"

Agent: "I understand you need a prescription refill. For medication requests, 
        I'll arrange for our staff to call you back. They can process that for you. 
        May I have your name and date of birth first?"

You: "Maria Weber, August 22, 1972"

[Agent calls patient_lookup → found]

Agent: "Thank you, Ms. Weber. What's the best number to reach you for the callback?"

You: "You can use the number on file"

[Agent calls request_callback with:
 phone="+49 171 9876543", category="prescription", 
 reason="blood pressure medication refill", patientId="patient-2"]

Agent: "I've arranged for our staff to call you back about your prescription. 
        Is there anything else I can help with?"
```

**Expected Tool Calls:**
1. `patient_lookup` → found: true
2. `request_callback` with category="prescription"

---

### Test 9: Billing Question (German)

**Goal:** Verify billing routes to request_callback with correct category

**Script:**
```
You: "Guten Tag, ich habe eine Frage zu meiner Rechnung"

Agent: "Guten Tag. Für Abrechnungsfragen werde ich veranlassen, dass unsere 
        Mitarbeiter Sie zurückrufen. Dürfte ich Ihren Namen und Ihre 
        Telefonnummer haben?"

You: "Hans Müller, 0170 1234567"

[Agent calls request_callback with:
 phone="+49 170 1234567", category="billing", 
 reason="Frage zur Rechnung", patientName="Hans Müller"]

Agent: "Ich habe Ihren Rückrufwunsch notiert. Unsere Buchhaltung wird sich 
        bei Ihnen melden. Kann ich Ihnen noch bei etwas anderem helfen?"
```

**Expected Tool Calls:**
1. `request_callback` with category="billing"

---

### Test 10: Test Results Inquiry (English)

**Goal:** Verify test results routes to request_callback

**Script:**
```
You: "Hi, I'd like to know my blood test results from last week"

Agent: "For test results, our medical staff will need to discuss those with you 
        directly. I'll arrange for them to call you. May I have your name and 
        date of birth?"

You: "Thomas Becker, December 1, 1990"

[Agent calls patient_lookup → found]

Agent: "Thank you, Mr. Becker. I've noted your request. Our medical team will 
        call you to discuss your results. Is there anything else?"

[Agent calls request_callback with category="test_results"]
```

**Expected Tool Calls:**
1. `patient_lookup` → found: true
2. `request_callback` with category="test_results"

---

## Quick Reference

### Patient Lookup Test Data

| Name | DOB | Phone | Expected Result |
|------|-----|-------|-----------------|
| Hans Müller | 1985-03-15 | +49 170 1234567 | Found, has appointment |
| Maria Weber | 1972-08-22 | +49 171 9876543 | Found |
| Thomas Becker | 1990-12-01 | +49 172 5555555 | Found |
| Peter Schulz | 1988-06-05 | (new) | Not found |

### Tool Call Expectations by Scenario

| Scenario | Primary Tool | Secondary Tools |
|----------|--------------|-----------------|
| Regular booking | patient_lookup | get_available_slots, book_appointment |
| Cancel appointment | patient_lookup | cancel_appointment |
| New patient | patient_lookup | patient_create_or_update, get_available_slots |
| Emergency | register_emergency_transfer | (none - immediate) |
| Urgent no slots | patient_lookup | get_available_slots, add_to_urgent_queue |
| Prescription | request_callback | patient_lookup (optional) |
| Billing | request_callback | - |
| Test results | request_callback | patient_lookup (optional) |

### Emergency Keywords

**German:**
- Brustschmerzen (chest pain)
- Atemnot (shortness of breath)
- Herzinfarkt (heart attack)
- starke Blutung (severe bleeding)
- bewusstlos (unconscious)
- Schlaganfall (stroke)
- Krampfanfall (seizure)
- Suizid (suicide)
- Überdosis (overdose)

**English:**
- chest pain
- can't breathe
- heart attack
- severe bleeding
- unconscious
- stroke
- seizure
- suicide
- overdose

---

## API Endpoints Reference

| Tool | Method | Endpoint |
|------|--------|----------|
| patient_lookup | GET | /api/patients/lookup |
| patient_create_or_update | POST | /api/patients |
| get_available_slots | GET | /api/appointments/slots |
| book_appointment | POST | /api/appointments |
| cancel_appointment | POST | /api/appointments/cancel/{appointmentId} |
| add_to_urgent_queue | POST | /api/queue/urgent |
| register_emergency_transfer | POST | /api/queue/emergency |
| request_callback | POST | /api/callback |

---

---

## Additional Test Scenarios

### Test 11: Reschedule Appointment (German)

**Goal:** Verify cancel + rebook flow works

**Script:**
```
You: "Guten Tag, ich möchte meinen Termin verschieben"

Agent: "Guten Tag, hier ist Ignis Demo Praxis. Ich helfe Ihnen gerne dabei.
        Dürfte ich Ihren Namen und Ihr Geburtsdatum haben?"

You: "Hans Müller, 15.03.1985"

[Agent calls patient_lookup → finds upcoming appointment]

Agent: "Herr Müller, ich sehe Ihren Termin am [date]. 
        Möchten Sie diesen auf einen anderen Tag verschieben?"

You: "Ja, geht es nächste Woche Mittwoch?"

[Agent calls cancel_appointment, then get_available_slots, then book_appointment]

Agent: "Ich habe Ihren alten Termin storniert und einen neuen Termin 
        am Mittwoch um [time] für Sie gebucht. Ist das in Ordnung?"
```

**Expected Tool Calls:**
1. `patient_lookup` → found: true
2. `cancel_appointment` → cancelled: true
3. `get_available_slots` → list of slots
4. `book_appointment` → appointment created

---

### Test 12: Language Switch Mid-Conversation

**Goal:** Verify agent switches language when patient does

**Script:**
```
You: "Guten Tag, ich brauche einen Termin"

Agent: "Guten Tag, hier ist Ignis Demo Praxis..."

You: "Actually, can we switch to English? My German is not so good."

Agent: "Of course! No problem. May I have your name and date of birth?"

You: "Maria Weber, August 22, 1972"

[Agent continues in English for rest of call]
```

**Expected:** Agent should seamlessly switch to English

---

### Test 13: Insurance Question (German)

**Goal:** Verify insurance routes to callback with correct category

**Script:**
```
You: "Hallo, ich habe eine Frage zu meiner Versicherung"

Agent: "Guten Tag. Für Versicherungsfragen werde ich veranlassen, dass unsere 
        Mitarbeiter Sie zurückrufen. Dürfte ich Ihren Namen und Ihre 
        Telefonnummer haben?"

You: "Thomas Becker, 0172 5555555"

[Agent calls request_callback with category="insurance"]

Agent: "Ich habe Ihren Rückrufwunsch notiert. Unsere Mitarbeiter werden sich 
        bei Ihnen melden."
```

**Expected Tool Calls:**
1. `request_callback` with category="insurance"

---

### Test 14: Multiple Emergency Keywords

**Goal:** Verify agent detects combined symptoms

**Script:**
```
You: "Ich habe Brustschmerzen und kann nicht richtig atmen"

[Agent IMMEDIATELY calls register_emergency_transfer with 
 reason="Brustschmerzen, Atemnot"]

Agent: "Ich höre, dass Sie Brustschmerzen und Atemnot haben. 
        Das ist sehr ernst. Ich leite Sie sofort an unser medizinisches 
        Personal weiter. Bitte bleiben Sie dran."
```

**Expected:** Immediate emergency detection and transfer

---

### Test 15: Wrong Patient Info Retry

**Goal:** Verify agent handles patient not found gracefully

**Script:**
```
You: "Guten Tag, ich bin Max Mustermann, geboren am 1. Januar 1980"

[Agent calls patient_lookup → not found]

Agent: "Ich kann Sie leider nicht in unserem System finden. 
        Haben Sie Ihren Namen möglicherweise anders buchstabiert, 
        oder haben Sie sich im Geburtsdatum geirrt?"

You: "Oh sorry, Maria Weber, 22. August 1972"

[Agent calls patient_lookup → found]

Agent: "Ah, da sind Sie! Willkommen zurück, Frau Weber."
```

**Expected:** Agent should help patient correct their info

---

## Manual Test Instructions

Since ElevenLabs simulation API uses generic user behavior, test manually via widget:

### Test via ElevenLabs Widget

1. Go to: https://elevenlabs.io/app/conversational-ai/agents
2. Open agent: **Ignis Demo Praxis**
3. Click **Test** button (phone icon)
4. Speak or type the test scripts above
5. Verify tool calls in the conversation log

### Test via Twilio (if configured)

Call the assigned phone number and follow the test scripts.

---

## Verified API Response Examples

### patient_lookup (found)
```json
{
  "patient": {...},
  "found": true,
  "patientId": "patient-2",
  "patientName": "Frau Weber",
  "upcomingAppointment": null
}
```

### patient_lookup (not found)
```json
{
  "patient": null,
  "found": false
}
```

### get_available_slots
```json
{
  "slots": [
    {"slotId": "stub-2026-02-01-0", "start": "2026-02-01T09:00:00+01:00", 
     "end": "2026-02-01T09:30:00+01:00", "practitionerDisplay": "Dr. Anna Schmidt"},
    {"slotId": "stub-2026-02-01-1", "start": "2026-02-01T09:30:00+01:00", ...}
  ]
}
```

### book_appointment
```json
{
  "appointment": {"id": "...", "status": "booked", "start": "...", "end": "..."},
  "confirmationMessage": "Ihre Termin wurde für ... bestätigt."
}
```

### request_callback
```json
{
  "callbackId": "uuid",
  "estimatedTime": "within 2 hours",
  "message": "Wir rufen Sie innerhalb von 2 Stunden zurück."
}
```

### add_to_urgent_queue
```json
{
  "queueEntryId": "uuid",
  "position": 1,
  "message": "Sie wurden in die dringende Warteschlange eingetragen. Wir rufen Sie zurück."
}
```

### register_emergency_transfer
```json
{
  "transferId": "uuid",
  "message": "Notfall erfasst. Sie werden mit einem Mitarbeiter verbunden."
}
```

---

*Last updated: 2026-01-31 21:00 CET*
