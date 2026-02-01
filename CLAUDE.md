# Ignis - AI Patient Intake System

> **Recovery**: Run `gt prime` after compaction, clear, or new session

## Tech Stack

- **Runtime**: Bun
- **Backend**: Hono (TypeScript) in `src/`
- **Frontend**: Next.js (App Router) in `frontend/`
- **FHIR Server**: Aidbox (R4 4.0.1)
- **Testing**:
  - Backend: Bun Test (integration tests)
  - Frontend: Vitest + React Testing Library (component tests)

## Testing

### Backend Tests (Bun Test)

```bash
# Run all backend tests (requires server running)
bun test

# Run tests in watch mode
bun test --watch

# Run specific test file
bun test src/__tests__/questionnaires.test.ts
```

**Important**: Backend tests are integration tests that require the server to be running (`bun run dev`).

Test files are located in `src/__tests__/*.test.ts`.

### Frontend Tests (Vitest)

```bash
# Run frontend tests
cd frontend && bun run test

# Run in watch mode
cd frontend && bun run test:watch

# Run with coverage
cd frontend && bun run test:coverage
```

Test files are located in `frontend/**/*.test.tsx` (next to components).

## Agent Instructions

When writing frontend code:
- **Always generate Vitest tests** for new React components
- Place test files next to components: `Component.tsx` → `Component.test.tsx`
- Use React Testing Library for component testing
- Test user interactions, not implementation details

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