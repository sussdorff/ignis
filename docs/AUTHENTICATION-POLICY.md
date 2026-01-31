# Ignis Authentication Policy

> Security policy for patient authentication across Voice AI and Frontend channels

## Overview

This document defines authentication requirements for patient actions across:

1. **Voice AI** (ElevenLabs) - Phone-based interaction
2. **Frontend** (Web App) - Passwordless authentication

## Legal Framework

- **GDPR Art. 32**: Appropriate technical and organizational measures
- **GDPR Art. 5(1)(f)**: Integrity and confidentiality of personal data
- **Industry Standard**: Aligned with German healthcare practice standards

---

# Part 1: Voice AI Authentication (ElevenLabs)

## System Architecture

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Patient    │──call──▶│  ElevenLabs  │──HTTP──▶│  Ignis API   │
│   (Phone)    │         │   Voice AI   │◀────────│    (Hono)    │
└──────────────┘         └──────────────┘         └──────────────┘
                               │                        │
                               ▼                        ▼
                         ┌──────────┐            ┌──────────┐
                         │  Tools   │            │   FHIR   │
                         │ (Custom) │            │ (Aidbox) │
                         └──────────┘            └──────────┘
```

### Call Flow

1. **Patient calls** → ElevenLabs receives call with Caller-ID
2. **ElevenLabs triggers `on_call_start`** → Calls `identify_patient` tool automatically
3. **Ignis API returns patient info** → ElevenLabs personalizes greeting
4. **Patient requests action** → ElevenLabs determines required auth level
5. **ElevenLabs asks verification questions** → Collects birth date, postal code, etc.
6. **ElevenLabs calls `authenticate_patient`** → Ignis validates factors
7. **If authorized** → ElevenLabs calls action tool (e.g., `cancel_appointment`)

### Detailed Sequence

```
Patient                  ElevenLabs                    Ignis API
   │                         │                            │
   │──── Calls ─────────────▶│                            │
   │                         │                            │
   │                         │── identify_patient ───────▶│
   │                         │   {phone: "+49171..."}     │
   │                         │◀─ {found: true,            │
   │                         │    patientId: "patient-2", │
   │                         │    name: "Maria Weber"}    │
   │                         │                            │
   │◀─ "Guten Tag Frau Weber"│                            │
   │                         │                            │
   │── "Cancel my appointment"                            │
   │                         │                            │
   │                         │── authorize_action ───────▶│
   │                         │   {action: "cancel_appt",  │
   │                         │    authLevel: 0}           │
   │                         │◀─ {authorized: false,      │
   │                         │    requiredLevel: 2,       │
   │                         │    missingFactors:         │
   │                         │    ["birthDate","postal"]} │
   │                         │                            │
   │◀─ "For security, your   │                            │
   │    date of birth?"      │                            │
   │                         │                            │
   │── "22. August 1972" ───▶│                            │
   │                         │                            │
   │◀─ "And your postal code?"                            │
   │                         │                            │
   │── "20099" ─────────────▶│                            │
   │                         │                            │
   │                         │── authenticate_patient ───▶│
   │                         │   {patientId: "patient-2", │
   │                         │    birthDate: "1972-08-22",│
   │                         │    postalCode: "20099"}    │
   │                         │◀─ {authenticated: true,    │
   │                         │    level: 2}               │
   │                         │                            │
   │                         │── cancel_appointment ─────▶│
   │                         │   {patientId: "patient-2", │
   │                         │    authLevel: 2}           │
   │                         │◀─ {success: true}          │
   │                         │                            │
   │◀─ "Your appointment     │                            │
   │    has been cancelled"  │                            │
```

---

## ElevenLabs Tool Configuration

Configure these tools in the ElevenLabs Conversational AI dashboard:

### Tool 1: identify_patient

```json
{
  "name": "identify_patient",
  "description": "Look up a patient by their phone number. Call this at the start of every conversation to personalize the greeting. Returns patient name if found.",
  "parameters": {
    "type": "object",
    "properties": {
      "caller_phone": {
        "type": "string",
        "description": "The caller's phone number in E.164 format (e.g., +491719876543)"
      }
    },
    "required": ["caller_phone"]
  },
  "endpoint": {
    "url": "https://api.ignis.de/api/voice/identify",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer ${IGNIS_API_KEY}",
      "Content-Type": "application/json"
    }
  }
}
```

### Tool 2: authenticate_patient

```json
{
  "name": "authenticate_patient",
  "description": "Verify a patient's identity using knowledge factors. Call this after collecting verification information from the patient (date of birth, postal code, etc.).",
  "parameters": {
    "type": "object",
    "properties": {
      "patient_id": {
        "type": "string",
        "description": "The patient ID returned from identify_patient"
      },
      "birth_date": {
        "type": "string",
        "description": "Patient's date of birth in YYYY-MM-DD format"
      },
      "postal_code": {
        "type": "string",
        "description": "Patient's postal code (optional, for Level 2)"
      },
      "street_name": {
        "type": "string",
        "description": "Patient's street name without house number (optional, for Level 3)"
      }
    },
    "required": ["patient_id", "birth_date"]
  },
  "endpoint": {
    "url": "https://api.ignis.de/api/voice/authenticate",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer ${IGNIS_API_KEY}",
      "Content-Type": "application/json"
    }
  }
}
```

### Tool 3: authorize_action

```json
{
  "name": "authorize_action",
  "description": "Check if the current authentication level is sufficient for an action. Call this before performing any action to determine if more verification is needed.",
  "parameters": {
    "type": "object",
    "properties": {
      "auth_level": {
        "type": "integer",
        "description": "Current authentication level (0-3)"
      },
      "action": {
        "type": "string",
        "enum": ["view_appointment", "cancel_appointment", "reschedule_appointment", "change_phone", "change_address", "request_prescription", "request_referral", "sick_note"],
        "description": "The action the patient wants to perform"
      }
    },
    "required": ["auth_level", "action"]
  },
  "endpoint": {
    "url": "https://api.ignis.de/api/voice/authorize-action",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer ${IGNIS_API_KEY}",
      "Content-Type": "application/json"
    }
  }
}
```

### ElevenLabs System Prompt

```
You are a friendly phone assistant for the medical practice "Praxis Dr. Müller".

## Initial Greeting
At the start of every call, immediately use the identify_patient tool with the caller's phone number.
- If patient found: "Guten Tag, [Name]! Wie kann ich Ihnen helfen?"
- If not found: "Guten Tag! Mit wem spreche ich bitte?"

## Authentication Flow
Before performing any action:
1. Use authorize_action to check if current auth level is sufficient
2. If not authorized, ask for the missing factors:
   - Level 1 needs: date of birth
   - Level 2 needs: date of birth + postal code
   - Level 3 needs: date of birth + postal code + street name
3. Use authenticate_patient to verify the factors
4. Only proceed with action if authenticated is true

## Security Rules
- NEVER reveal medical information without Level 3 authentication
- NEVER perform actions without proper authentication level
- After 3 failed authentication attempts, say: "Bitte wenden Sie sich direkt an unsere Praxis während der Öffnungszeiten."
- If patient wants to change their email address, say: "Aus Sicherheitsgründen können Sie Ihre E-Mail-Adresse nur persönlich in der Praxis ändern."

## Language
Speak German unless the patient speaks another language.
```

---

## Authentication Levels

### Level 0: Identification (No Authentication)

**Trigger:** Incoming call with known phone number (Caller-ID)

**Automatically determined:**
- Phone number → Patient lookup in FHIR (`Patient.telecom`)

**Allowed actions:**
- Greeting by name ("Good morning, Mrs. Weber")
- Display patient context for the system
- General practice information

**Not allowed:**
- Access to medical data
- Changes to patient data
- Appointment bookings

> ⚠️ **Note:** Phone number alone is NOT authentication, as phones can be shared, stolen, or numbers spoofed.

---

### Level 1: Basic Authentication

**Required information:**
| Factor | FHIR Field | Example |
|--------|------------|---------|
| Date of Birth | `Patient.birthDate` | "August 22, 1972" |

**If Caller-ID NOT available or unknown:**
| Factor | FHIR Field | Example |
|--------|------------|---------|
| Full Name | `Patient.name.given` + `Patient.name.family` | "Maria Weber" |
| Date of Birth | `Patient.birthDate` | "August 22, 1972" |

**Allowed actions:**
- Confirm appointment reminders
- Query next appointment
- General practice information

**Example dialogue (with known number):**
```
AI: "Good morning! I see you're calling from the number registered
     for Maria Weber. For verification: Can you please tell me
     your date of birth?"
Patient: "August 22, 1972"
AI: "Thank you, Mrs. Weber. How can I help you?"
```

---

### Level 2: Standard Authentication

**Required information (in addition to Level 1):**
| Factor | FHIR Field | Example |
|--------|------------|---------|
| Postal Code OR City | `Patient.address.postalCode` / `Patient.address.city` | "20099" or "Hamburg" |

**Alternative (if address not available):**
| Factor | Source | Example |
|--------|--------|---------|
| Last appointment (month/year) | `Appointment` resource | "November 2025" |

**Allowed actions:**
- Reschedule or cancel appointment
- Book new appointment
- Change contact details (phone number, email)
- Update address

**Example dialogue:**
```
AI: "To change your phone number, I need one additional piece of
     information. Can you please tell me your postal code?"
Patient: "20099"
AI: "Thank you. What new phone number would you like to register?"
```

---

### Level 3: Extended Authentication

**Required information (in addition to Level 2):**
| Factor | FHIR Field | Example |
|--------|------------|---------|
| Street (house number not required) | `Patient.address.line` | "Hauptstraße" |

**OR Knowledge-based question:**
| Factor | Source | Example |
|--------|--------|---------|
| Attending physician | Last `Encounter` resource | "Dr. Müller" |
| Type of last treatment | `Encounter.type` | "Preventive checkup" |

**Allowed actions:**
- Request prescription (repeat prescription)
- Request referral
- Query test results (only whether available, no details)
- Request sick note

**Example dialogue:**
```
AI: "For a prescription request, I need additional security
     information. What street do you live on?"
Patient: "Hauptstraße"
AI: "Thank you. Which medication do you need as a repeat prescription?"
```

---

### Level 4: Maximum Authentication (Out-of-Band)

**Required for:**
- Access to test results (content)
- Change of primary email address
- Power of attorney / proxy regulations

**Procedure:**
1. Level 2 or 3 authentication on the phone
2. **Plus** confirmation code via SMS to registered number
3. **Or** callback by practice staff

> This level requires human intervention and cannot be fully automated via Voice AI.

---

## Actions and Required Authentication Levels (Voice)

| Action | Level | Rationale |
|--------|-------|-----------|
| Greeting by name | 0 | Comfort only, no sensitive data |
| State next appointment | 1 | Appointment info is moderately sensitive |
| Practice opening hours | 0 | Public information |
| **Cancel appointment** | 2 | Irreversible action |
| **Reschedule appointment** | 2 | Data modification |
| **Book new appointment** | 2 | Resource binding |
| **Change phone number** | 2 | Contact data change |
| **Change email** | 4 | Can be misused for account takeover |
| **Change address** | 2 | Contact data change |
| **Request prescription** | 3 | Medically relevant |
| **Request referral** | 3 | Medically relevant |
| Query test result (yes/no) | 3 | Medical information |
| Read test result | 4 | Highly sensitive data |
| Sick note | 3 | Legally relevant |

---

## Voice AI Implementation (ElevenLabs)

### Available Authentication Factors

```typescript
interface VoiceAuthFactors {
  // Level 0 - Automatic
  callerPhoneNumber?: string;        // From Caller-ID

  // Level 1 - Basic
  fullName: string;                  // Patient.name
  birthDate: string;                 // Patient.birthDate (Format: YYYY-MM-DD)

  // Level 2 - Standard
  postalCode?: string;               // Patient.address.postalCode
  city?: string;                     // Patient.address.city
  lastAppointmentMonth?: string;     // From Appointment resources

  // Level 3 - Extended
  streetName?: string;               // Patient.address.line (without house number)
  attendingPhysician?: string;       // From last Encounter
  lastTreatmentType?: string;        // Encounter.type
}
```

### Prompt Template for ElevenLabs

```
You are a friendly phone assistant for the practice [PRACTICE_NAME].

AUTHENTICATION RULES:
1. If the phone number is known, greet the patient by name
2. For ANY action except general questions, ask for date of birth
3. For appointment changes or data changes, also ask for postal code
4. For prescription requests, also ask for street name

IMPORTANT:
- Never disclose medical details without full authentication
- After 3 failed attempts: "Please contact our practice directly"
- Document every authentication attempt

EXAMPLE FLOW for phone number change:
1. "For security: Can you tell me your date of birth?"
2. [Confirmation] "And your postal code please?"
3. [Confirmation] "What new number would you like to register?"
```

---

# Part 2: Frontend Authentication (Passwordless)

## Design Principles

1. **No passwords** - Patients don't need to remember credentials
2. **Magic Link + Knowledge Factor** - Email/SMS link plus verification question
3. **Progressive authentication** - Higher levels unlock more actions
4. **Session-based** - Authentication valid for session duration

---

## Frontend Authentication Methods

### Method A: Magic Link + Birth Date

**Flow:**
1. Patient enters email or phone number
2. System sends magic link (valid 15 minutes)
3. Patient clicks link → redirected to app
4. Patient enters date of birth for verification
5. Session established (Level 2)

**Best for:** Returning patients with email on file

```
┌─────────────────────────────────────────────────────────┐
│  Welcome to Ignis                                       │
│                                                         │
│  Enter your email or phone number:                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │ maria.weber@example.com                          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────┐                               │
│  │  Send Login Link    │                               │
│  └─────────────────────┘                               │
└─────────────────────────────────────────────────────────┘

         ↓ Email sent

┌─────────────────────────────────────────────────────────┐
│  Check your inbox!                                      │
│                                                         │
│  We sent a login link to m***@example.com              │
│  The link expires in 15 minutes.                        │
│                                                         │
│  Didn't receive it? [Resend] [Try phone instead]       │
└─────────────────────────────────────────────────────────┘

         ↓ User clicks link

┌─────────────────────────────────────────────────────────┐
│  One more step, Maria                                   │
│                                                         │
│  Please enter your date of birth:                       │
│  ┌──────┐  ┌──────┐  ┌──────┐                          │
│  │  22  │  │  08  │  │ 1972 │                          │
│  └──────┘  └──────┘  └──────┘                          │
│    Day       Month     Year                             │
│                                                         │
│  ┌─────────────────────┐                               │
│  │      Continue       │                               │
│  └─────────────────────┘                               │
└─────────────────────────────────────────────────────────┘
```

---

### Method B: SMS OTP + Birth Date

**Flow:**
1. Patient enters phone number
2. System sends 6-digit OTP via SMS (valid 10 minutes)
3. Patient enters OTP
4. Patient enters date of birth for verification
5. Session established (Level 2)

**Best for:** Patients without email, mobile-first users

```
┌─────────────────────────────────────────────────────────┐
│  Enter your phone number:                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ +49 171 9876543                                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────┐                               │
│  │    Send Code        │                               │
│  └─────────────────────┘                               │
└─────────────────────────────────────────────────────────┘

         ↓ SMS sent

┌─────────────────────────────────────────────────────────┐
│  Enter the 6-digit code                                 │
│                                                         │
│  We sent a code to +49 171 ****543                     │
│                                                         │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐            │
│  │  4 │ │  7 │ │  2 │ │  8 │ │  1 │ │  9 │            │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘            │
│                                                         │
│  Didn't receive it? [Resend in 45s]                    │
└─────────────────────────────────────────────────────────┘
```

---

### Method C: QR Code Check-In (Kiosk/Waiting Room)

**Flow:**
1. Patient scans QR code displayed in practice
2. Opens web app with practice context pre-filled
3. Patient enters name + date of birth
4. Optional: Confirm with postal code for Level 2
5. Check-in completed, staff notified

**Best for:** Walk-in patients, waiting room kiosks

```
┌─────────────────────────────────────────────────────────┐
│  Practice Check-In                                      │
│  Dr. Müller - General Practice                          │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ First Name                                       │   │
│  │ Maria                                            │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Last Name                                        │   │
│  │ Weber                                            │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Date of Birth                                    │   │
│  │ 22.08.1972                                       │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────┐                               │
│  │     Check In        │                               │
│  └─────────────────────┘                               │
└─────────────────────────────────────────────────────────┘
```

---

### Method D: Appointment Link (Pre-authenticated)

**Flow:**
1. Practice sends appointment confirmation with unique link
2. Link contains encrypted patient ID + appointment ID
3. Patient clicks link → enters birth date only
4. Session established for this appointment context

**Best for:** Appointment reminders, pre-visit questionnaires

```
Email/SMS:
"Your appointment with Dr. Müller on Feb 15 at 10:00.
 Complete your intake form: https://ignis.app/a/x7k2m..."

         ↓ User clicks link

┌─────────────────────────────────────────────────────────┐
│  Appointment: Feb 15, 2026 at 10:00                     │
│  Dr. Müller - General Practice                          │
│                                                         │
│  Hello Maria, please confirm your identity:             │
│                                                         │
│  Date of Birth:                                         │
│  ┌──────┐  ┌──────┐  ┌──────┐                          │
│  │  DD  │  │  MM  │  │ YYYY │                          │
│  └──────┘  └──────┘  └──────┘                          │
│                                                         │
│  ┌─────────────────────┐                               │
│  │  Start Intake Form  │                               │
│  └─────────────────────┘                               │
└─────────────────────────────────────────────────────────┘
```

---

## Frontend Authentication Levels

| Level | Method | Factors | Session Duration |
|-------|--------|---------|------------------|
| **1** | Appointment Link | Link token + Birth date | Until appointment |
| **2** | Magic Link / SMS OTP | Email/Phone + Birth date | 24 hours |
| **3** | Level 2 + Address | + Postal code verification | 24 hours |
| **4** | Level 3 + SMS confirm | + Real-time OTP | Single action |

---

## Actions and Required Levels (Frontend)

| Action | Level | Notes |
|--------|-------|-------|
| View upcoming appointments | 1 | Read-only |
| Complete intake questionnaire | 1 | Appointment-scoped |
| View appointment history | 2 | |
| Cancel/reschedule appointment | 2 | |
| Update phone number | 2 | Confirmation SMS to old number |
| Update email | 3 | Confirmation to old email |
| Request prescription refill | 3 | |
| View test results | 4 | Requires real-time OTP |
| Download medical records | 4 | |

---

## Frontend Implementation

### Design Decision: Single JWT with Level Elevation

The frontend uses a **single JWT token** that can be elevated to higher authentication levels. This approach:

- **Simplifies state management** - Frontend always has exactly 1 token
- **Clear invalidation** - Only 1 token to revoke on logout/security issue
- **Stateless** - Level is encoded in JWT, no database lookups needed

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    JWT Authentication Flow (Backend-Driven)               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Frontend                              Backend                           │
│     │                                     │                              │
│     │── POST /auth/initiate ─────────────▶│                              │
│     │◀─ { success: true } ────────────────│                              │
│     │                                     │                              │
│     │── POST /auth/verify-token ─────────▶│  (token + birthDate)         │
│     │◀─ { jwt: "eyJ..." } ────────────────│  ← Level 2 JWT               │
│     │                                     │                              │
│     │   Store JWT, use for API calls      │                              │
│     │                                     │                              │
│     │── POST /api/prescriptions ─────────▶│  (mit Level 2 JWT)           │
│     │◀─ 403 {                             │                              │
│     │     error: "insufficient_level",    │  ← Backend sagt was fehlt    │
│     │     currentLevel: 2,                │                              │
│     │     requiredLevel: 3,               │                              │
│     │     elevation: {                    │                              │
│     │       factors: ["postalCode"],      │                              │
│     │       prompt: "Bitte PLZ angeben"   │                              │
│     │     }                               │                              │
│     │   } ──────────────────────────────  │                              │
│     │                                     │                              │
│     │   Frontend zeigt Elevation-Dialog   │                              │
│     │   (verwendet prompt + factors)      │                              │
│     │                                     │                              │
│     │── POST /auth/elevate ──────────────▶│  { postalCode: "20099" }     │
│     │◀─ { jwt: "eyJ..." } ────────────────│  ← NEW Level 3 JWT           │
│     │                                     │                              │
│     │   Replace old JWT, RETRY request    │                              │
│     │                                     │                              │
│     │── POST /api/prescriptions ─────────▶│  (mit Level 3 JWT)           │
│     │◀─ { success: true } ────────────────│                              │
│     │                                     │                              │
└──────────────────────────────────────────────────────────────────────────┘
```

### Backend-Driven Elevation

The frontend does **not** need to know which endpoints require which level. Instead:

1. Frontend calls any endpoint with current JWT
2. If level insufficient, backend returns `403` with elevation instructions
3. Frontend shows elevation dialog using backend-provided prompt
4. After elevation, frontend retries the original request

**Benefits:**
- Frontend has zero knowledge of business rules
- Adding new protected endpoints requires no frontend changes
- Backend can customize prompts per action
- Easy to change level requirements without frontend deployment

### JWT Payload Structure

```typescript
interface JWTPayload {
  // Standard claims
  sub: string;              // Patient ID (e.g., "patient-2")
  iat: number;              // Issued at (Unix timestamp)
  exp: number;              // Expires at (Unix timestamp, 24h from iat)

  // Ignis-specific claims
  level: 1 | 2 | 3 | 4;     // Current authentication level
  method: 'magic_link' | 'sms_otp' | 'appointment_link' | 'qr_checkin';
  elevatedAt?: string;      // ISO timestamp when level was elevated
  scope?: {
    appointmentId?: string; // For appointment-scoped sessions (Level 1)
  };
}
```

**Example JWT payload:**
```json
{
  "sub": "patient-2",
  "iat": 1706745600,
  "exp": 1706832000,
  "level": 3,
  "method": "magic_link",
  "elevatedAt": "2026-01-31T15:30:00.000Z"
}
```

### API Endpoints

All endpoints return a new JWT when authentication state changes.

```typescript
// Step 1: Initiate authentication (send magic link or SMS OTP)
POST /api/auth/initiate
Request:
{
  "method": "magic_link" | "sms_otp",
  "identifier": "email@example.com" | "+49171..."
}
Response:
{
  "success": true,
  "expiresIn": 900,
  "maskedIdentifier": "m***@example.com"
}

// Step 2: Verify token + birth date → get initial JWT (Level 2)
POST /api/auth/verify-token
Request:
{
  "token": "abc123...",      // From magic link URL or SMS
  "birthDate": "1972-08-22"
}
Response:
{
  "jwt": "eyJhbGciOiJIUzI1NiIs...",  // Level 2 JWT
  "level": 2,
  "expiresAt": "2026-02-01T12:00:00.000Z",
  "patient": { "id": "patient-2", "name": "Maria Weber" }
}

// Step 3: Elevate to higher level → get NEW JWT with higher level
POST /api/auth/elevate
Headers: Authorization: Bearer <current-jwt>
Request:
{
  "postalCode": "20099"     // For Level 3
  // OR "streetName": "Hauptstraße" for Level 3
}
Response:
{
  "jwt": "eyJhbGciOiJIUzI1NiIs...",  // NEW Level 3 JWT
  "level": 3,
  "expiresAt": "2026-02-01T12:00:00.000Z"
}

// Step 4: Request OTP for Level 4 action
POST /api/auth/request-otp
Headers: Authorization: Bearer <level-3-jwt>
Request:
{
  "action": "view_test_results"
}
Response:
{
  "success": true,
  "expiresIn": 300,
  "maskedPhone": "+49 171 ****543"
}

// Step 5: Confirm Level 4 action → get action token (single-use)
POST /api/auth/confirm-action
Headers: Authorization: Bearer <level-3-jwt>
Request:
{
  "otp": "472819",
  "action": "view_test_results"
}
Response:
{
  "jwt": "eyJhbGciOiJIUzI1NiIs...",  // Level 4 JWT (short expiry)
  "level": 4,
  "expiresAt": "2026-01-31T15:35:00.000Z",  // 5 min expiry
  "actionScope": "view_test_results"  // Only valid for this action
}
```

### Backend Implementation

```typescript
import { sign, verify } from 'hono/jwt';

const JWT_SECRET = process.env.JWT_SECRET!;

// Verify token and birth date, issue Level 2 JWT
app.post('/api/auth/verify-token', async (c) => {
  const { token, birthDate } = await c.req.json();

  // Lookup token in database
  const authToken = await db.authTokens.findByHash(hashToken(token));
  if (!authToken || authToken.used || authToken.expiresAt < new Date()) {
    return c.json({ error: 'invalid_token' }, 401);
  }

  // Get patient and verify birth date
  const patient = await fhirClient.getPatient(authToken.patientId);
  if (patient.birthDate !== birthDate) {
    await db.authTokens.incrementAttempts(authToken.id);
    return c.json({ error: 'invalid_birthdate' }, 401);
  }

  // Mark token as used
  await db.authTokens.markUsed(authToken.id);

  // Issue JWT at Level 2
  const payload: JWTPayload = {
    sub: patient.id,
    level: 2,
    method: authToken.method,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24h
  };

  const jwt = await sign(payload, JWT_SECRET);

  return c.json({
    jwt,
    level: 2,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
    patient: { id: patient.id, name: formatName(patient.name) }
  });
});

// Elevate existing JWT to higher level
app.post('/api/auth/elevate', async (c) => {
  // Verify current JWT
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  const currentPayload = await verify(token, JWT_SECRET) as JWTPayload;

  const { postalCode, streetName } = await c.req.json();

  // Get patient from FHIR
  const patient = await fhirClient.getPatient(currentPayload.sub);

  // Determine target level based on provided factors
  let newLevel = currentPayload.level;

  if (postalCode || streetName) {
    // Verify postal code or street
    const addressMatch = postalCode
      ? patient.address?.[0]?.postalCode === postalCode
      : patient.address?.[0]?.line?.some(l =>
          l.toLowerCase().includes(streetName.toLowerCase())
        );

    if (!addressMatch) {
      return c.json({ error: 'invalid_factor' }, 401);
    }

    newLevel = 3;
  }

  if (newLevel <= currentPayload.level) {
    return c.json({ error: 'already_at_level' }, 400);
  }

  // Issue NEW JWT with elevated level
  const newPayload: JWTPayload = {
    ...currentPayload,
    level: newLevel,
    elevatedAt: new Date().toISOString(),
    // Keep original expiry
  };

  const jwt = await sign(newPayload, JWT_SECRET);

  return c.json({
    jwt,
    level: newLevel,
    expiresAt: new Date(newPayload.exp * 1000).toISOString()
  });
});

// Elevation hints for each level - tells frontend what to ask for
const ELEVATION_HINTS: Record<number, ElevationHint> = {
  3: {
    factors: ['postalCode', 'city'],
    prompt: 'Please enter your postal code to continue',
    promptDe: 'Bitte geben Sie Ihre Postleitzahl ein',
  },
  4: {
    factors: ['otp'],
    prompt: 'We will send a verification code to your phone',
    promptDe: 'Wir senden einen Bestätigungscode an Ihr Telefon',
    requiresOtp: true,
  },
};

// Middleware to check authentication level - returns elevation hints on 403
function requireLevel(minLevel: number) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'unauthorized' }, 401);
    }

    try {
      const token = authHeader.replace('Bearer ', '');
      const payload = await verify(token, JWT_SECRET) as JWTPayload;

      if (payload.level < minLevel) {
        // Return detailed elevation instructions
        return c.json({
          error: 'insufficient_level',
          currentLevel: payload.level,
          requiredLevel: minLevel,
          elevation: ELEVATION_HINTS[minLevel] || ELEVATION_HINTS[3],
        }, 403);
      }

      c.set('auth', payload);
      await next();
    } catch (e) {
      return c.json({ error: 'invalid_token' }, 401);
    }
  };
}

// Example: Protected endpoint requiring Level 3
// Frontend doesn't need to know this requires Level 3 - it just calls and reacts to 403
app.post('/api/prescriptions/request', requireLevel(3), async (c) => {
  const auth = c.get('auth') as JWTPayload;
  // auth.sub contains patient ID
  // auth.level is guaranteed >= 3
  // ... handle prescription request
});
```

### 403 Response Format (Insufficient Level)

When an endpoint requires a higher authentication level, it returns:

```typescript
// HTTP 403 Forbidden
{
  "error": "insufficient_level",
  "currentLevel": 2,
  "requiredLevel": 3,
  "elevation": {
    "factors": ["postalCode", "city"],     // Acceptable factors for elevation
    "prompt": "Please enter your postal code to continue",
    "promptDe": "Bitte geben Sie Ihre Postleitzahl ein"
  }
}

// For Level 4 (requires OTP)
{
  "error": "insufficient_level",
  "currentLevel": 3,
  "requiredLevel": 4,
  "elevation": {
    "factors": ["otp"],
    "prompt": "We will send a verification code to your phone",
    "promptDe": "Wir senden einen Bestätigungscode an Ihr Telefon",
    "requiresOtp": true
  }
}
```

### Frontend: API Client with Auto-Elevation

```typescript
// Types for elevation response
interface ElevationInfo {
  factors: string[];
  prompt: string;
  promptDe: string;
  requiresOtp?: boolean;
}

interface InsufficientLevelError {
  error: 'insufficient_level';
  currentLevel: number;
  requiredLevel: number;
  elevation: ElevationInfo;
}

// Custom error that carries elevation info
class ElevationRequiredError extends Error {
  constructor(public elevationInfo: InsufficientLevelError) {
    super('Elevation required');
  }
}

// API client that handles 403 responses
async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { jwt } = useAuthStore.getState();

  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
      ...(jwt && { 'Authorization': `Bearer ${jwt}` }),
    },
  });

  if (response.status === 403) {
    const data = await response.json();
    if (data.error === 'insufficient_level') {
      // Throw with full elevation info from backend
      throw new ElevationRequiredError(data);
    }
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// Hook that wraps API calls with auto-elevation
function useApiWithElevation() {
  const [pendingRequest, setPendingRequest] = useState<{
    path: string;
    options: RequestInit;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  } | null>(null);

  const [elevationInfo, setElevationInfo] = useState<ElevationInfo | null>(null);

  const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
    try {
      return await apiRequest<T>(path, options);
    } catch (error) {
      if (error instanceof ElevationRequiredError) {
        // Show elevation dialog, store pending request
        setElevationInfo(error.elevationInfo.elevation);
        return new Promise((resolve, reject) => {
          setPendingRequest({ path, options, resolve, reject });
        });
      }
      throw error;
    }
  };

  const onElevationComplete = async () => {
    if (pendingRequest) {
      // Retry the original request with new elevated JWT
      try {
        const result = await apiRequest(pendingRequest.path, pendingRequest.options);
        pendingRequest.resolve(result);
      } catch (error) {
        pendingRequest.reject(error);
      }
      setPendingRequest(null);
      setElevationInfo(null);
    }
  };

  return { request, elevationInfo, onElevationComplete };
}
```

### Frontend: Elevation Dialog Component

```tsx
interface ElevationDialogProps {
  elevation: ElevationInfo;
  onSuccess: () => void;
  onCancel: () => void;
}

function ElevationDialog({ elevation, onSuccess, onCancel }: ElevationDialogProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { jwt, elevate } = useAuthStore();

  // Use German prompt if browser language is German
  const prompt = navigator.language.startsWith('de')
    ? elevation.promptDe
    : elevation.prompt;

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    // Determine which factor to send based on what backend accepts
    const factor = elevation.factors[0]; // e.g., 'postalCode'

    const response = await fetch('/api/auth/elevate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify({ [factor]: value }),
    });

    if (response.ok) {
      const { jwt: newJwt, level } = await response.json();
      elevate(newJwt, level);  // Replace token in store
      onSuccess();             // Trigger retry of original request
    } else {
      const data = await response.json();
      setError(data.error === 'invalid_factor'
        ? 'The information you entered does not match our records'
        : 'An error occurred. Please try again.');
    }

    setLoading(false);
  };

  // For OTP flow, show different UI
  if (elevation.requiresOtp) {
    return <OtpElevationDialog elevation={elevation} onSuccess={onSuccess} onCancel={onCancel} />;
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Additional Verification Required</DialogTitle>
          <DialogDescription>{prompt}</DialogDescription>
        </DialogHeader>

        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={elevation.factors.includes('postalCode') ? 'e.g., 20099' : ''}
          disabled={loading}
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || !value}>
            {loading ? 'Verifying...' : 'Verify'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Frontend: Usage Example

```tsx
function PrescriptionRequestButton() {
  const { request, elevationInfo, onElevationComplete } = useApiWithElevation();
  const [loading, setLoading] = useState(false);

  const handleRequest = async () => {
    setLoading(true);
    try {
      // Just call the API - don't worry about auth levels!
      // If level is insufficient, elevation dialog will appear automatically
      await request('/prescriptions/request', {
        method: 'POST',
        body: JSON.stringify({ medication: 'Ibuprofen 400mg' }),
      });
      toast.success('Prescription requested!');
    } catch (error) {
      toast.error('Failed to request prescription');
    }
    setLoading(false);
  };

  return (
    <>
      <Button onClick={handleRequest} disabled={loading}>
        Request Prescription
      </Button>

      {elevationInfo && (
        <ElevationDialog
          elevation={elevationInfo}
          onSuccess={onElevationComplete}
          onCancel={() => setLoading(false)}
        />
      )}
    </>
  );
}
```

**Key Benefits of this approach:**
1. `PrescriptionRequestButton` has NO knowledge that prescriptions require Level 3
2. If we change prescription requests to require Level 2, only backend changes
3. Backend controls the user-facing prompts
4. Frontend automatically retries the original request after elevation

---

## Security Considerations

### Rate Limiting

| Action | Limit | Lockout |
|--------|-------|---------|
| Magic link requests | 3 per hour per email | 1 hour |
| SMS OTP requests | 3 per hour per phone | 1 hour |
| OTP verification attempts | 5 per code | Code invalidated |
| Birth date verification | 3 per session | Session invalidated |

### Token Security

- Magic links: 256-bit random tokens, single-use
- OTPs: 6 digits, 10-minute expiry, max 5 attempts
- Session tokens: JWT with 24h expiry, refresh via re-authentication

### Logging (GDPR-compliant)

Log for each authentication attempt:
- Timestamp
- Method used
- Success/failure (NOT entered data on failure)
- IP address (anonymized after 7 days)
- Device fingerprint (hashed)

---

## Edge Cases

### Patient has no email or phone on file

→ Cannot use self-service authentication
→ Must register contact details in person at practice
→ QR check-in still works with name + birth date

### Patient changes phone number

→ Confirmation SMS sent to OLD number
→ If old number inaccessible: Must visit practice in person

### Multiple patients with same birth date

→ System requires additional factor (postal code) automatically
→ Or: Search by name first, then verify

### Session expires during form completion

→ Form data saved locally (encrypted)
→ Re-authenticate to resume
→ Data restored after successful auth

---

## Comparison: Voice vs Frontend Authentication

| Aspect | Voice AI | Frontend |
|--------|----------|----------|
| Primary identifier | Caller-ID (phone) | Email or phone |
| Knowledge factor | Birth date + address | Birth date |
| Possession factor | Phone (implicit) | Email/SMS access |
| Session duration | Single call | 24 hours |
| Level 4 method | SMS + callback | Real-time OTP |
| Fallback | "Call practice directly" | "Visit practice in person" |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-31 | Initial version (Voice AI only) |
| 2.0 | 2026-01-31 | Added Frontend passwordless authentication |
| 2.1 | 2026-01-31 | Single JWT design: one token elevated in place |
| 2.2 | 2026-01-31 | Backend-driven elevation: 403 returns elevation hints, frontend has no business logic |
