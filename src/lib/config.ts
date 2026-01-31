/**
 * Aidbox FHIR server configuration.
 * Uses env vars with defaults for the remote Ignis Aidbox instance.
 */
const FHIR_BASE = process.env.AIDBOX_FHIR_URL ?? 'https://ignis.cognovis.de/fhir'
const AIDBOX_USER = process.env.AIDBOX_USER ?? process.env.AIDBOX_ADMIN_ID ?? 'admin'
const AIDBOX_PASSWORD = process.env.AIDBOX_PASSWORD ?? process.env.AIDBOX_ADMIN_PASSWORD ?? 'ignis2026'

export const aidboxConfig = {
  /** FHIR API base URL (e.g. https://ignis.cognovis.de/fhir) */
  fhirBaseUrl: FHIR_BASE.replace(/\/$/, ''),
  /** Basic auth username */
  user: AIDBOX_USER,
  /** Basic auth password */
  password: AIDBOX_PASSWORD,
  /** FHIR version (R4 4.0.1) */
  fhirVersion: '4.0.1' as const,
}
