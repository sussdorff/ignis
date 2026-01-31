# Ignis - AI Patient Intake System

> **Recovery**: Run `gt prime` after compaction, clear, or new session

## Tech Stack

- **Runtime**: Bun
- **Backend**: Hono (TypeScript)
- **Frontend**: React + Vite
- **FHIR Server**: Aidbox (R4 4.0.1)
- **Testing**: Bun Test (built-in)

## Testing

We use **Bun's built-in test runner** for all automated tests.

```bash
# Run all tests (requires server running)
bun test

# Run tests in watch mode
bun test --watch

# Run specific test file
bun test src/__tests__/questionnaires.test.ts
```

**Important**: Tests are integration tests that require the server to be running (`bun run dev`).

Test files are located in `src/__tests__/*.test.ts`.

## FHIR Server Configuration

```bash
# Add to .env.development or .env.local
AIDBOX_URL=https://ignis.cognovis.de/
AIDBOX_FHIR_URL=https://ignis.cognovis.de/fhir
AIDBOX_USER=admin
AIDBOX_PASSWORD=ignis2026
```

**Quick test command:**
```bash
curl -u admin:ignis2026 https://ignis.cognovis.de/fhir/Patient
```

## For Other Agents

Configure the backend to connect to the remote Aidbox FHIR server:
- Base URL: https://ignis.cognovis.de/
- FHIR endpoint: https://ignis.cognovis.de/fhir
- Auth: Basic auth with admin / ignis2026
- FHIR version: R4 (4.0.1)