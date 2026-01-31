# Ignis - AI-Powered Patient Intake System

> "Give Doctors Their Time Back"

Ignis is an AI-powered patient intake system for German medical practices (Praxen) that automates phone-based patient registration and appointment booking using voice AI.

## The Problem

- ~100,000 Arztpraxen in Germany still rely on phone + paper intake
- Praxis staff spend 30-40% of their time on phone administration
- Patients wait an average of 12 minutes for phone scheduling
- Non-German speakers face significant barriers to healthcare access
- Doctors lose valuable patient time to administrative overhead

## Our Solution

An AI voice agent that:

- **Handles intake calls 24/7** with an empathetic, caring voice
- **3-tier intelligent triage**: Emergency (→human agent→112), Urgent (→same-day), Regular (→booking)
- **Recognizes returning patients** and pre-fills known data
- **Speaks German + 30+ languages** natively via 11 Labs
- **Never gives medical advice** - safety-first design
- **Integrates with existing systems** via FHIR standard

## Key Features

| Feature | Description |
|---------|-------------|
| Voice Intake | AI collects patient info via natural conversation |
| 3-Tier Triage | Emergency/Urgent/Regular classification |
| Patient Lookup | Returning patients identified by phone/DOB |
| Verification Portal | Patients verify AI-collected data via secure link |
| AI Flags | Doctor sees flags for items needing verification |
| Praxis Dashboard | Real-time view of patients, appointments, urgent queue |

## Architecture

**Hybrid approach:** ElevenLabs handles real-time voice conversation, OpenClaw manages background tasks and smart notifications.

```mermaid
flowchart TB
    subgraph PatientInterface [Patient Interface]
        Phone[Phone Call]
        WebPortal[Patient Portal]
    end
    
    subgraph VoiceLayer [Voice Layer - Real-time]
        ElevenLabs[11 Labs Conversational AI]
        Twilio[Twilio Phone Integration]
    end
    
    subgraph Backend [Backend Services]
        NextAPI[Next.js API Routes]
        Aidbox[Aidbox FHIR Server]
    end
    
    subgraph Background [Background Orchestration]
        OpenClaw[OpenClaw Agent]
        Gemini[Gemini NLU]
    end
    
    subgraph ClinicInterface [Clinic Interface]
        Dashboard[Praxis Dashboard]
        Calendar[Appointment Calendar]
        StaffAlerts[Staff Alerts via WhatsApp]
    end
    
    Phone --> ElevenLabs
    ElevenLabs -->|"Tools (real-time)"| NextAPI
    ElevenLabs -->|"Post-call webhook"| OpenClaw
    WebPortal --> NextAPI
    NextAPI --> Aidbox
    OpenClaw --> Gemini
    OpenClaw --> Aidbox
    OpenClaw -->|"Send verification SMS"| Phone
    OpenClaw --> StaffAlerts
    Aidbox --> Dashboard
    Aidbox --> Calendar
```

### Component Roles

| Component | Role | When |
|-----------|------|------|
| **ElevenLabs** | Voice conversation, triage, patient lookup, booking | During call (real-time) |
| **Next.js APIs** | HTTP endpoints for ElevenLabs tools, web UIs | During call + web access |
| **Aidbox** | FHIR data storage (patients, appointments) | Always |
| **OpenClaw** | SMS notifications, staff alerts, call analysis, follow-ups | After call (background) |
| **Gemini** | Intent classification, confidence scoring | Called by OpenClaw |

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Vite + React + TypeScript + Tailwind + shadcn/ui | Praxis dashboard + Patient portal |
| Backend | Bun + Hono | Real-time APIs for ElevenLabs tools |
| FHIR Server | Aidbox Cloud Sandbox | Patient/appointment data storage |
| Voice AI | 11 Labs Conversational AI | Phone conversation handling |
| Phone | Twilio (via 11 Labs) | Inbound/outbound calls |
| Background Agent | OpenClaw | Post-call tasks, notifications, follow-ups |
| NLU | Gemini | Intent classification, confidence scoring |

## Project Status

✅ **Completed**
- Backend scaffold (Bun + Hono) with health check endpoint
- Frontend scaffold (Vite + React + TypeScript)
- Tailwind CSS v4 integration
- shadcn/ui components (button, card, input, form, calendar, label)
- Path aliases configured (@/* → src/*)
- Frontend proxy to backend (/api → localhost:3000)

🚧 **To Do**
- FHIR client (Aidbox integration)
- API routes (patients, appointments, queue, verification)
- UI pages (Praxis dashboard, Patient portal)
- ElevenLabs voice integration
- OpenClaw background tasks

📋 **Full Plan**: See [docs/PLAN.md](docs/PLAN.md)

## Quick Start

### 1. Install Dependencies

**Backend** (Bun + Hono)
```bash
# Bun is already installed in the project
~/.bun/bin/bun install
```

**Frontend** (Vite + React)
```bash
cd frontend
~/.bun/bin/bun install
```

### 2. Start Development Servers

**Terminal 1 - Backend** (port 3000)
```bash
~/.bun/bin/bun run dev
```

**Terminal 2 - Frontend** (port 5173)
```bash
cd frontend
~/.bun/bin/bun run dev
```

Open http://localhost:5173 in your browser.

### 3. Setup Aidbox (Optional - for FHIR backend)

**Get Aidbox License** (Free for Development)

1. Go to [https://aidbox.app](https://aidbox.app) and create an account
2. After login, click on your **project name** in the sidebar
3. Click **Assets** → **New Aidbox**
4. Configure: License type = **Dev**, Hosting = **Self-hosted**
5. Copy the `AIDBOX_LICENSE_ID` and `AIDBOX_LICENSE_KEY`

**Configure and Start**

```bash
cp .env.example .env
# Edit .env and add your Aidbox keys

./infra/setup-aidbox.sh
```

This will:
- Start PostgreSQL and Aidbox containers
- Wait for health checks
- Load demo FHIR data (patients, practitioners, appointments)

**Verify**

- Aidbox UI: http://localhost:8080 (admin/ignis2026)
- n8n Workflows: http://localhost:5678 (admin/ignis2026)

## Deployment

### Initial Setup (New Server)

```bash
# 1. Provision Hetzner server
./infra/provision.sh

# 2. Setup everything (clones repo, builds and starts all services)
./infra/setup-remote.sh <server-ip>
```

This will:
- Clone the repo to `/opt/ignis`
- Build Docker image for the app (Bun backend + React frontend)
- Start all Docker services (app, Aidbox, n8n, nginx)
- Configure nginx reverse proxy

### Updating Existing Server

After pushing code changes:

```bash
./infra/update-server.sh [server-ip]
```

This will:
- Pull latest code
- Rebuild Docker images
- Restart all services

### Manual Deployment

On the server:

```bash
cd /opt/ignis
git pull origin main
docker compose up -d --build
```

### Service Management

```bash
# Check all services
docker compose ps

# View logs
docker compose logs -f

# View specific service logs
docker compose logs app -f
docker compose logs aidbox -f
docker compose logs nginx -f

# Restart a service
docker compose restart app

# Rebuild and restart
docker compose up -d --build app
```

## Infrastructure

See `infra/` directory for server provisioning:

```bash
# Provision Hetzner server
./infra/provision.sh

# Setup after provisioning
./infra/setup-remote.sh <server-ip>

# Update after code changes
./infra/update-server.sh <server-ip>

# Add team member SSH keys
./infra/user-setup.sh <server-ip>

# Teardown when done
./infra/teardown.sh
```

## Server Access

```bash
ssh hackathon@167.235.236.238
```

## Services

| Service | Access | Credentials |
|---------|--------|-------------|
| **Ignis App** | http://server-ip/app/ | - |
| **Ignis API** | http://server-ip/api/ | - |
| **Aidbox UI** | http://server-ip/ | admin / ignis2026 |
| **FHIR API** | http://server-ip/fhir/ | admin / ignis2026 |
| **n8n** | http://server-ip/n8n/ | admin / ignis2026 |

All services run in Docker and are proxied through nginx.

### Service Architecture

The **Ignis App** runs as a single Docker container that includes both:
- **Backend**: Bun + Hono server (port 3000)
  - Handles `/api/*` routes
  - Serves built frontend static files
- **Frontend**: React app (built as static files)
  - Built during Docker image creation
  - Served by the Bun backend

```
Docker Container "app"
├── Bun Backend (Hono) - port 3000
│   ├── Handles /api routes
│   └── Serves built frontend static files
└── Frontend (React) - built as static files in /frontend/dist/
```

### Managing Services

```bash
# Check all services
docker compose ps

# Check specific service
docker compose ps app

# View logs
docker compose logs -f         # All services
docker compose logs app -f     # Just the app

# Restart a service
docker compose restart app
docker compose restart nginx

# Rebuild and restart
docker compose up -d --build app
```

## Project Structure

```
ignis/
├── src/                     # Bun + Hono backend
│   ├── index.ts             # Entry point (serves API + frontend)
│   ├── api/                 # API routes (to be implemented)
│   └── lib/                 # Shared libraries
│       ├── fhir/            # FHIR client
│       ├── elevenlabs/      # Voice AI integration
│       ├── openclaw/        # Agent orchestration
│       └── ai/              # Triage/classification
├── frontend/                # Vite + React frontend
│   ├── src/
│   │   ├── pages/           # Page components
│   │   │   ├── praxis/      # Clinic dashboard
│   │   │   └── patient/     # Patient-facing UI
│   │   ├── components/      # React components
│   │   │   ├── ui/          # shadcn/ui components
│   │   │   ├── praxis/      # Clinic-specific
│   │   │   └── patient/     # Patient-specific
│   │   └── lib/             # Frontend utilities
│   └── dist/                # Built frontend (served by backend)
├── infra/                   # Infrastructure & deployment
│   ├── deploy-app.sh        # Deploy/update app on server
│   ├── update-server.sh     # Quick update script
│   ├── setup-remote.sh      # Initial server setup
│   └── nginx/               # Nginx configs
├── docs/                    # Documentation
│   └── PLAN.md              # Detailed implementation plan
└── aidbox/                  # FHIR seed data
    └── seed/
```

## Documentation

See [docs/PLAN.md](docs/PLAN.md) for the detailed implementation plan including:
- Flow diagrams (Architecture, Triage, Emergency Detection, Verification Portal)
- Team distribution and workstreams
- Pitch deck structure
- Demo script
- Technical specifications

## Team

Built at a hackathon by Team Ignis, leveraging:
- 11 Labs (Voice AI)
- Gemini (NLU)
- Aidbox (FHIR)
- OpenClaw (Agent)
- Cursor (IDE)

## License

MIT
