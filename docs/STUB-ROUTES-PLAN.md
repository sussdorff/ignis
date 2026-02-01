# Plan: Stub Routes → Fully Functional (Aidbox Persistence)

## Stub routes identified

| Route | Current behavior | Persistence target |
|-------|------------------|--------------------|
| **POST /api/appointments** (book) | Returns fake appointment (stub id); no DB write | FHIR `Appointment` |
| **POST /api/queue/urgent** | Returns 201 with random UUID; no DB write | FHIR `Task` (urgent queue entry) |
| **POST /api/queue/emergency** | Returns 201 with random UUID; no DB write | FHIR `Task` (emergency transfer record) |
| **POST /api/callback** | Returns 201 with random UUID; no DB write | FHIR `Task` (callback request) |

## Approach

1. **Book appointment** — In `aidbox-appointments.ts`: add `getAppointmentsInRange(start, end)` to detect double-booking, and `createAppointment({ start, end, patientId, practitionerId, type?, reason? })` that builds a minimal FHIR Appointment and `POST` to Aidbox. Slot IDs remain stub-derived (start/end from `stub-YYYY-MM-DD-N`); we do not create Slot resources yet. Return 409 if an Appointment already exists in that time range.
2. **Queue urgent** — New `aidbox-tasks.ts`: create FHIR `Task` with `status: requested`, `intent: order`, `for: Patient/<id>`, custom code for urgent queue; `POST` Task. Response `queueEntryId` = Task.id.
3. **Queue emergency** — Same module: create FHIR `Task` for emergency transfer (optional patient/phone/reason); `POST` Task. Response `transferId` = Task.id.
4. **Callback** — Same module: create FHIR `Task` for callback request (phone, reason, category, optional patient); `POST` Task. Response `callbackId` = Task.id.

Task resources use a custom code system `http://ignis.hackathon/task-type` with values: `urgent-queue`, `emergency-transfer`, `callback-request` so the dashboard can filter by type.

## Implementation order

1. Extend `aidbox-appointments.ts`: `getAppointmentsInRange`, `createAppointment`.
2. Add `aidbox-tasks.ts`: `createUrgentQueueEntry`, `createEmergencyTransfer`, `createCallbackRequest`.
3. Update `routes/appointments.ts`: call `createAppointment`; on conflict return 409.
4. Update `routes/queue.ts`: call Aidbox task creators; return Task ids.
5. Update `routes/callback.ts`: call `createCallbackRequest`; return Task id.
6. Run `scripts/test-routes.ts` and fix any failures.
