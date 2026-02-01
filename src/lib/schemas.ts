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
  name: z.string().optional(),
  phone: z.string().optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
}).refine(
  (data) => data.name || data.phone || data.birthDate,
  { message: 'At least one of name, phone or birthDate must be provided' }
)

export const UpcomingAppointmentSchema = z.object({
  appointmentId: z.string(),
  start: z.string(),
  reason: z.string().optional(),
})

export const PatientLookupResponseSchema = z.object({
  patient: FHIRPatientSchema.nullable(),
  found: z.boolean(),
  patientId: z.string().nullable().optional(),
  patientName: z.string().nullable().optional(),
  upcomingAppointment: UpcomingAppointmentSchema.nullable().optional(),
})

export type UpcomingAppointment = z.infer<typeof UpcomingAppointmentSchema>
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

// --- Appointments: slots ---
export const SlotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  urgency: z.enum(['routine', 'urgent']).optional().default('routine'),
  practitionerId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
})

/** Query params for GET /api/appointments/slots/next - next N slots from now */
export const SlotsNextQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional().default(3),
})

export const SlotSchema = z.object({
  slotId: z.string(),
  start: z.string(),
  end: z.string(),
  practitionerId: z.string().optional(),
  practitionerDisplay: z.string().optional(),
})

export const SlotsResponseSchema = z.object({
  slots: z.array(SlotSchema),
})

export type Slot = z.infer<typeof SlotSchema>
export type SlotsResponse = z.infer<typeof SlotsResponseSchema>

// --- Appointments: book ---
export const BookAppointmentRequestSchema = z.object({
  slotId: z.string().min(1, 'slotId is required'),
  patientId: z.string().min(1, 'patientId is required'),
  practitionerId: z.string().optional(),
  type: z.enum(['routine', 'urgent']).optional(),
  reason: z.string().optional(),
})

export const BookAppointmentResponseSchema = z.object({
  appointment: z.record(z.string(), z.unknown()),
  start: z.string(),
  end: z.string(),
  confirmationMessage: z.string().optional(),
})

export type BookAppointmentRequest = z.infer<typeof BookAppointmentRequestSchema>
export type BookAppointmentResponse = z.infer<typeof BookAppointmentResponseSchema>

// --- Queue: urgent ---
export const AddToUrgentQueueRequestSchema = z.object({
  patientId: z.string().min(1, 'patientId is required'),
  reason: z.string().optional(),
  phone: z.string().optional(),
})

export const AddToUrgentQueueResponseSchema = z.object({
  queueEntryId: z.string(),
  position: z.number().optional(),
  message: z.string().optional(),
})

export type AddToUrgentQueueResponse = z.infer<typeof AddToUrgentQueueResponseSchema>

// --- Queue: emergency ---
export const RegisterEmergencyRequestSchema = z.object({
  patientId: z.string().optional(),
  phone: z.string().optional(),
  reason: z.string().optional(),
})

export const RegisterEmergencyResponseSchema = z.object({
  transferId: z.string(),
  message: z.string().optional(),
})

export type RegisterEmergencyResponse = z.infer<typeof RegisterEmergencyResponseSchema>

// --- Cancel appointment ---
export const CancelAppointmentBodySchema = z.object({
  reason: z.string().optional(),
})

export const CancelAppointmentResponseSchema = z.object({
  cancelled: z.boolean(),
  appointmentId: z.string().optional(),
  message: z.string().optional(),
})

export const AppointmentConflictErrorSchema = z.object({
  error: z.literal('appointment_conflict'),
  reason: z.string().optional(),
})

export type CancelAppointmentResponse = z.infer<typeof CancelAppointmentResponseSchema>

// --- Request callback ---
export const RequestCallbackRequestSchema = z.object({
  phone: z.string().min(1, 'Phone is required'),
  reason: z.string().min(1, 'Reason is required'),
  category: z.enum(['prescription', 'billing', 'test_results', 'insurance', 'technical_issue', 'general']),
  patientId: z.string().optional(),
  patientName: z.string().optional(),
})

export const RequestCallbackResponseSchema = z.object({
  callbackId: z.string(),
  estimatedTime: z.string().optional(),
  message: z.string().optional(),
})

export type RequestCallbackRequest = z.infer<typeof RequestCallbackRequestSchema>
export type RequestCallbackResponse = z.infer<typeof RequestCallbackResponseSchema>

// --- QuestionnaireResponse: submit (chat/voice collected) ---
const QuestionnaireResponseAnswerSchema = z.object({
  valueBoolean: z.boolean().optional(),
  valueDecimal: z.number().optional(),
  valueInteger: z.number().optional(),
  valueDate: z.string().optional(),
  valueDateTime: z.string().optional(),
  valueTime: z.string().optional(),
  valueString: z.string().optional(),
  valueUri: z.string().optional(),
  valueCoding: z.object({
    code: z.string(),
    display: z.string().optional(),
    system: z.string().optional(),
  }).optional(),
  valueQuantity: z.object({
    value: z.number(),
    unit: z.string().optional(),
    system: z.string().optional(),
    code: z.string().optional(),
  }).optional(),
  valueReference: z.object({ reference: z.string() }).optional(),
}).refine((obj) => Object.keys(obj).length > 0, { message: 'At least one value[x] required' })

const QuestionnaireResponseItemSchema: z.ZodType<{
  linkId: string
  text?: string
  answer?: Array<Record<string, unknown>>
  item?: unknown[]
}> = z.lazy(() =>
  z.object({
    linkId: z.string(),
    text: z.string().optional(),
    answer: z.array(QuestionnaireResponseAnswerSchema).optional(),
    item: z.array(QuestionnaireResponseItemSchema).optional(),
  })
)

/** API-friendly format (patientId, questionnaire, status, item) */
export const QuestionnaireResponseSubmitSchema = z.object({
  patientId: z.string().optional(),
  questionnaire: z.string().optional(),
  status: z.enum(['in-progress', 'completed', 'amended', 'entered-in-error', 'stopped']),
  item: z.array(QuestionnaireResponseItemSchema).optional().default([]),
  encounterId: z.string().optional(),
  authored: z.string().optional(),
  author: z.string().optional(),
})

/** Wrapped format from ElevenLabs/chat: { questionnaireResponse: {...} } */
export const WrappedQuestionnaireResponseSchema = z.object({
  questionnaireResponse: z.object({
    resourceType: z.literal('QuestionnaireResponse').optional(),
    questionnaire: z.string().optional(),
    status: z.enum(['in-progress', 'completed', 'amended', 'entered-in-error', 'stopped']),
    subject: z.object({ reference: z.string() }).optional(),
    encounter: z.object({ reference: z.string() }).optional(),
    authored: z.string().optional(),
    author: z.object({ reference: z.string() }).optional(),
    item: z.array(QuestionnaireResponseItemSchema).optional().default([]),
  }),
})

export type QuestionnaireResponseSubmit = z.infer<typeof QuestionnaireResponseSubmitSchema>

// --- Doctor: prescription requests ---
export const PrescriptionRequestActionSchema = z.object({
  action: z.enum(['approve', 'deny']),
  note: z.string().optional(),
})

export type PrescriptionRequestAction = z.infer<typeof PrescriptionRequestActionSchema>

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
