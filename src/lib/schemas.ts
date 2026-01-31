import { z } from 'zod'

// =============================================================================
// FHIR R4 Patient schemas (simplified for API layer)
// =============================================================================

export const FHIRIdentifierSchema = z.object({
  system: z.string().optional(),
  value: z.string(),
})

export const FHIRHumanNameSchema = z.object({
  use: z.enum(['official', 'usual', 'temp', 'nickname', 'anonymous', 'old', 'maiden']).optional(),
  family: z.string(),
  given: z.array(z.string()).optional(),
  prefix: z.array(z.string()).optional(),
})

export const FHIRContactPointSchema = z.object({
  system: z.enum(['phone', 'fax', 'email', 'pager', 'url', 'sms', 'other']).optional(),
  value: z.string(),
  use: z.enum(['home', 'work', 'temp', 'old', 'mobile']).optional(),
})

export const FHIRAddressSchema = z.object({
  use: z.enum(['home', 'work', 'temp', 'old', 'billing']).optional(),
  line: z.array(z.string()).optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
})

export const FHIRPatientSchema = z.object({
  resourceType: z.literal('Patient'),
  id: z.string(),
  identifier: z.array(FHIRIdentifierSchema).optional(),
  active: z.boolean().optional(),
  name: z.array(FHIRHumanNameSchema).optional(),
  telecom: z.array(FHIRContactPointSchema).optional(),
  gender: z.enum(['male', 'female', 'other', 'unknown']).optional(),
  birthDate: z.string().optional(), // ISO 8601 date
  address: z.array(FHIRAddressSchema).optional(),
})

export type FHIRPatient = z.infer<typeof FHIRPatientSchema>

// =============================================================================
// API Request/Response schemas (per OpenAPI spec)
// =============================================================================

// --- Patient lookup ---
export const PatientLookupQuerySchema = z.object({
  phone: z.string().optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
}).refine(
  (data) => data.phone || data.birthDate,
  { message: 'At least one of phone or birthDate must be provided' }
)

export const PatientLookupResponseSchema = z.object({
  patient: FHIRPatientSchema.nullable(),
  found: z.boolean(),
})

export type PatientLookupResponse = z.infer<typeof PatientLookupResponseSchema>

// --- Patient create/update ---
export const PatientCreateOrUpdateRequestSchema = z.object({
  id: z.string().optional(),
  family: z.string().min(1, 'Family name is required'),
  given: z.string().min(1, 'Given name is required'),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email().optional(),
  gender: z.enum(['male', 'female', 'other', 'unknown']).optional(),
  address: z.object({
    line: z.array(z.string()).optional(),
    city: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
})

export type PatientCreateOrUpdateRequest = z.infer<typeof PatientCreateOrUpdateRequestSchema>

export const PatientCreateOrUpdateResponseSchema = z.object({
  patient: FHIRPatientSchema,
  created: z.boolean(),
})

export type PatientCreateOrUpdateResponse = z.infer<typeof PatientCreateOrUpdateResponseSchema>

// =============================================================================
// Error response schemas
// =============================================================================

export const ValidationErrorSchema = z.object({
  error: z.literal('validation_failed'),
  message: z.string(),
  fields: z.array(z.string()).optional(),
})

export const NotFoundErrorSchema = z.object({
  error: z.literal('not_found'),
  resource: z.string().optional(),
})

export const InternalErrorSchema = z.object({
  error: z.literal('internal'),
  message: z.string(),
})
