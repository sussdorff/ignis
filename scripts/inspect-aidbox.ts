/**
 * Read-only inspection of Aidbox FHIR database.
 * Connects using project config and reports what data is stored. No modifications.
 *
 * Usage: bun run scripts/inspect-aidbox.ts
 */

import { fhirClient } from '../src/lib/fhir-client'
import { aidboxConfig } from '../src/lib/config'

interface FHIRBundle {
  resourceType: 'Bundle'
  type: string
  total?: number
  entry?: Array<{ resource?: { resourceType: string; id?: string; [key: string]: unknown } }>
}

async function getBundle(resourceType: string, count = 500): Promise<FHIRBundle> {
  return fhirClient.get<FHIRBundle>(`${resourceType}?_count=${count}`)
}

async function main(): Promise<void> {
  console.log('Aidbox (read-only) –', aidboxConfig.fhirBaseUrl)
  console.log('')

  const resourceTypes = [
    // Core patient/provider resources
    'Patient',
    'Practitioner',
    'PractitionerRole',
    'Organization',
    'Location',
    // Scheduling
    'Appointment',
    'Schedule',
    'Slot',
    // Clinical
    'Encounter',
    'Condition',
    'Observation',
    'Procedure',
    'DiagnosticReport',
    'AllergyIntolerance',
    'MedicationRequest',
    'MedicationStatement',
    // Intake/Forms
    'Questionnaire',
    'QuestionnaireResponse',
    'Consent',
    'Coverage',
    'DocumentReference',
    // Workflow
    'Task',
    'Communication',
    'CommunicationRequest',
    'ServiceRequest',
    'HealthcareService',
  ]

  for (const resourceType of resourceTypes) {
    try {
      const bundle = await getBundle(resourceType)
      const total = bundle.total ?? bundle.entry?.length ?? 0
      const entries = bundle.entry ?? []
      const resources = entries.map((e) => e.resource).filter(Boolean) as Array<{
        resourceType: string
        id?: string
        [key: string]: unknown
      }>

      if (total === 0 && resources.length === 0) {
        console.log(`${resourceType}: 0 resources`)
        continue
      }

      console.log(`${resourceType}: ${total} total (showing ${resources.length} in this page)`)
      for (const r of resources.slice(0, 15)) {
        const id = r.id ?? '(no id)'
        const name =
          resourceType === 'Patient' && Array.isArray(r.name)
            ? (r.name[0] as { family?: string; given?: string[] })?.family +
              ', ' +
              (r.name[0] as { given?: string[] })?.given?.join(' ')
            : resourceType === 'Practitioner' && Array.isArray(r.name)
              ? (r.name[0] as { family?: string; given?: string[] })?.family +
                ', ' +
                (r.name[0] as { given?: string[] })?.given?.join(' ')
              : ''
        const status = r.status != null ? ` status=${r.status}` : ''
        console.log(`  - ${id}${name ? ` ${name}` : ''}${status}`)
      }
      if (resources.length > 15) {
        console.log(`  ... and ${resources.length - 15} more`)
      }
      console.log('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('404') || msg.includes('Not Found')) {
        console.log(`${resourceType}: (none or not supported)`)
      } else {
        console.log(`${resourceType}: error – ${msg}`)
      }
      console.log('')
    }
  }

  console.log('Done (read-only, no changes made).')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
