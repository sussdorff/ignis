import { randomBytes, createHash } from 'crypto'

// =============================================================================
// Types
// =============================================================================

export type AuthMethod = 'magic_link' | 'sms_otp'

export interface AuthToken {
  /** Hash of the token (stored, not the raw token) */
  tokenHash: string
  /** Patient ID from FHIR */
  patientId: string
  /** Authentication method used */
  method: AuthMethod
  /** When the token expires */
  expiresAt: Date
  /** Whether the token has been used */
  used: boolean
  /** Number of failed verification attempts */
  attempts: number
  /** When the token was created */
  createdAt: Date
}

export interface RateLimitEntry {
  /** Identifier (email or phone) */
  identifier: string
  /** Request count in current window */
  count: number
  /** Window start time */
  windowStart: Date
}

// =============================================================================
// In-memory storage (replace with database in production)
// =============================================================================

const tokenStore = new Map<string, AuthToken>()
const rateLimitStore = new Map<string, RateLimitEntry>()

// =============================================================================
// Constants
// =============================================================================

/** Magic link token validity in seconds */
export const MAGIC_LINK_EXPIRY_SECONDS = 15 * 60 // 15 minutes

/** SMS OTP validity in seconds */
export const SMS_OTP_EXPIRY_SECONDS = 10 * 60 // 10 minutes

/** Rate limit: max requests per hour per identifier */
const RATE_LIMIT_MAX_REQUESTS = 3

/** Rate limit window in milliseconds (1 hour) */
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000

// =============================================================================
// Token generation
// =============================================================================

/**
 * Generate a secure 256-bit random token for magic links.
 * Returns the raw token (to send to user) - store only the hash.
 */
export function generateMagicLinkToken(): string {
  return randomBytes(32).toString('hex') // 256 bits = 32 bytes = 64 hex chars
}

/**
 * Generate a 6-digit numeric OTP for SMS.
 */
export function generateSmsOtp(): string {
  // Use crypto random for better security
  const bytes = randomBytes(4)
  const num = bytes.readUInt32BE(0)
  // Map to 6-digit range (100000-999999)
  const otp = 100000 + (num % 900000)
  return otp.toString()
}

/**
 * Hash a token for secure storage.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// =============================================================================
// Token storage operations
// =============================================================================

/**
 * Store a new auth token (stores hash, not raw token).
 */
export function storeAuthToken(
  rawToken: string,
  patientId: string,
  method: AuthMethod
): AuthToken {
  const tokenHash = hashToken(rawToken)
  const expirySeconds = method === 'magic_link'
    ? MAGIC_LINK_EXPIRY_SECONDS
    : SMS_OTP_EXPIRY_SECONDS

  const authToken: AuthToken = {
    tokenHash,
    patientId,
    method,
    expiresAt: new Date(Date.now() + expirySeconds * 1000),
    used: false,
    attempts: 0,
    createdAt: new Date(),
  }

  tokenStore.set(tokenHash, authToken)
  return authToken
}

/**
 * Find a token by its hash.
 */
export function findTokenByHash(tokenHash: string): AuthToken | null {
  return tokenStore.get(tokenHash) ?? null
}

/**
 * Mark a token as used.
 */
export function markTokenUsed(tokenHash: string): void {
  const token = tokenStore.get(tokenHash)
  if (token) {
    token.used = true
  }
}

/**
 * Increment failed verification attempts for a token.
 */
export function incrementTokenAttempts(tokenHash: string): number {
  const token = tokenStore.get(tokenHash)
  if (token) {
    token.attempts += 1
    return token.attempts
  }
  return 0
}

/**
 * Delete a token (e.g., after max attempts).
 */
export function deleteToken(tokenHash: string): void {
  tokenStore.delete(tokenHash)
}

// =============================================================================
// Rate limiting
// =============================================================================

/**
 * Normalize identifier for rate limiting (lowercase, strip whitespace).
 */
function normalizeIdentifier(identifier: string): string {
  return identifier.toLowerCase().replace(/\s/g, '')
}

/**
 * Check if an identifier is rate limited.
 * Returns { allowed: true } if request is allowed,
 * or { allowed: false, retryAfterSeconds } if rate limited.
 */
export function checkRateLimit(identifier: string): {
  allowed: boolean
  retryAfterSeconds?: number
} {
  const normalized = normalizeIdentifier(identifier)
  const now = Date.now()
  const entry = rateLimitStore.get(normalized)

  if (!entry) {
    // First request, allow
    return { allowed: true }
  }

  const windowEnd = entry.windowStart.getTime() + RATE_LIMIT_WINDOW_MS

  if (now >= windowEnd) {
    // Window has expired, allow (new window will be created on record)
    return { allowed: true }
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    // Rate limited
    const retryAfterSeconds = Math.ceil((windowEnd - now) / 1000)
    return { allowed: false, retryAfterSeconds }
  }

  return { allowed: true }
}

/**
 * Record a rate limit request for an identifier.
 */
export function recordRateLimitRequest(identifier: string): void {
  const normalized = normalizeIdentifier(identifier)
  const now = Date.now()
  const entry = rateLimitStore.get(normalized)

  if (!entry || now >= entry.windowStart.getTime() + RATE_LIMIT_WINDOW_MS) {
    // New window
    rateLimitStore.set(normalized, {
      identifier: normalized,
      count: 1,
      windowStart: new Date(now),
    })
  } else {
    // Increment count in existing window
    entry.count += 1
  }
}

// =============================================================================
// Identifier masking
// =============================================================================

/**
 * Mask an email address for display (e.g., "m***@example.com").
 */
export function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@')
  if (!localPart || !domain) return '***@***.***'

  const firstChar = localPart[0] ?? '*'
  return `${firstChar}***@${domain}`
}

/**
 * Mask a phone number for display (e.g., "+49 171 ****543").
 */
export function maskPhone(phone: string): string {
  // Keep country code and last 3 digits visible
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 6) return '****' + digits.slice(-3)

  // Format: +XX XXX ****XXX
  const countryCode = digits.slice(0, 2)
  const lastDigits = digits.slice(-3)
  return `+${countryCode} ****${lastDigits}`
}

// =============================================================================
// Validation helpers
// =============================================================================

/** Regex for validating email addresses */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Regex for validating E.164 phone numbers */
const E164_REGEX = /^\+[1-9]\d{1,14}$/

/**
 * Check if a string is a valid email address.
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email)
}

/**
 * Check if a string is a valid E.164 phone number.
 */
export function isValidE164Phone(phone: string): boolean {
  // Remove spaces and dashes for validation
  const normalized = phone.replace(/[\s\-()]/g, '')
  return E164_REGEX.test(normalized)
}

/**
 * Normalize phone to E.164 format (strip non-digit except leading +).
 */
export function normalizePhoneToE164(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, '')
  // Ensure it starts with +
  if (!cleaned.startsWith('+')) {
    // Assume German number if no country code
    if (cleaned.startsWith('0')) {
      return '+49' + cleaned.slice(1)
    }
    return '+' + cleaned
  }
  return cleaned
}

// =============================================================================
// Cleanup (for testing/maintenance)
// =============================================================================

/**
 * Clear all tokens and rate limits (for testing).
 */
export function clearAllAuthData(): void {
  tokenStore.clear()
  rateLimitStore.clear()
}

/**
 * Remove expired tokens (maintenance task).
 */
export function cleanupExpiredTokens(): number {
  const now = Date.now()
  let removed = 0

  for (const [hash, token] of tokenStore.entries()) {
    if (token.expiresAt.getTime() < now) {
      tokenStore.delete(hash)
      removed++
    }
  }

  return removed
}
