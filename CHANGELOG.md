# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-02-06

### Added

- **Questionnaire Responses Seed Script** (`scripts/seed-questionnaire-responses.ts`): Generates realistic QuestionnaireResponses from Synthea patient data with Condition/Medication mapping, ~70% coverage, mixed completion states
- **Frontend Questionnaire Submit**: Fragebogen page now POSTs completed responses to FHIR backend with `convertResponsesToFHIRItems()` conversion
- **Patient Questionnaire Status Indicators**: PatientTable shows per-patient badge (Ausgefuellt/In Bearbeitung/Ausstehend) with color-coded status
- **QuestionnaireResponseModal**: Click-to-view modal displaying FHIR responses grouped by sections with human-readable answer rendering
- **Patient Notes Persistence**: Notes stored as FHIR Communication resources with POST/PUT/GET endpoints, replacing local-only save
- **Patient Notes Backend** (`src/lib/aidbox-notes.ts`): FHIR Communication resource CRUD operations
- **Comprehensive Test Suite**: 56 new tests (26 seed mapping, 9 submit, 8 status indicator, 12 modal, 17 notes)

### Changed

- `frontend/components/patient-table.tsx`: Added "Fragebogen" column with status badges and modal integration
- `frontend/components/patient-notes.tsx`: Save operations now persist to FHIR backend instead of local state only
- `frontend/app/fragebogen/page.tsx`: Submits responses on completion with loading/error feedback
- `frontend/lib/api.ts`: Added questionnaire response, patient notes API functions and FHIR types
- `src/routes/patients.ts`: Replaced notes stub with real FHIR Communication endpoints (GET/POST/PUT)

### Fixed

- Next.js upgraded to 15.1.11 for CVE-2025-66478
- Calendar same-day appointment moves no longer create duplicates

## [0.1.0] - 2026-02-02

Initial hackathon release - AI-powered patient intake system for German medical practices.

### Added

- **Backend API** (Hono/Bun): FHIR R4-compliant REST API with Aidbox integration
- **Frontend** (Next.js App Router): Praxis dashboard with waiting room, patient management, calendar
- **Patient Intake Questionnaire**: German-language FHIR Questionnaire (`patient-intake-de`) with 10 sections, conditional logic, triage assessment
- **Voice Integration**: Twilio + ElevenLabs for phone-based patient intake
- **Chat Interface**: Browser-based voice/text intake with ElevenLabs
- **Waiting Room Queue**: Real-time queue management with Aidbox Encounters, SSE updates
- **Appointment Management**: FHIR Schedule/Slot/Appointment with drag-and-drop calendar, real-time SSE sync
- **Patient Lookup**: Name/phone/birthdate search with German salutation
- **Synthea Data Loader**: Import ~631 realistic patient records from Synthea R4 bundles
- **Demo Seed Script**: 11 daily patients with appointments and queue entries
- **Infrastructure**: Docker Compose with Aidbox, PostgreSQL, nginx reverse proxy, SSL/HTTPS
