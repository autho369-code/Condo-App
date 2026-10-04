// Pure validation for company-admin → platform-operator requests. The table
// has no CHECK constraints, so the action is the only gate on these values.

export const PLATFORM_REQUEST_TYPES = [
  'more_doors',
  'plan_upgrade',
  'plan_downgrade',
  'billing_review',
  'technical_support',
  'feature_request',
  'data_import',
  'new_association',
  'white_glove',
  'urgent_issue',
] as const

export const PLATFORM_REQUEST_PRIORITIES = ['high', 'medium', 'low'] as const

export const PLATFORM_REQUEST_TITLE_MAX = 200
export const PLATFORM_REQUEST_DESCRIPTION_MAX = 5000

/** Columns a company admin may see. internal_notes / assigned_to are operator-only. */
export const PLATFORM_REQUEST_ADMIN_COLUMNS =
  'id, request_type, priority, title, description, status, platform_response, created_at, updated_at, resolved_at'

export type PlatformRequestInput = {
  request_type: FormDataEntryValue | null
  priority: FormDataEntryValue | null
  subject: FormDataEntryValue | null
  description: FormDataEntryValue | null
}

export type ValidPlatformRequest = {
  request_type: (typeof PLATFORM_REQUEST_TYPES)[number]
  priority: (typeof PLATFORM_REQUEST_PRIORITIES)[number]
  title: string
  description: string
}

export function validatePlatformRequest(input: PlatformRequestInput): ValidPlatformRequest | { error: string } {
  const text = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '')
  const requestType = text(input.request_type)
  const priority = text(input.priority)
  const title = text(input.subject)
  const description = text(input.description)

  if (!requestType || !priority || !title || !description) return { error: 'All fields are required.' }
  if (!(PLATFORM_REQUEST_TYPES as readonly string[]).includes(requestType)) return { error: 'Choose a valid request type.' }
  if (!(PLATFORM_REQUEST_PRIORITIES as readonly string[]).includes(priority)) return { error: 'Choose a valid priority.' }
  if (title.length > PLATFORM_REQUEST_TITLE_MAX) return { error: `Keep the subject under ${PLATFORM_REQUEST_TITLE_MAX} characters.` }
  if (description.length > PLATFORM_REQUEST_DESCRIPTION_MAX) return { error: `Keep the description under ${PLATFORM_REQUEST_DESCRIPTION_MAX} characters.` }

  return {
    request_type: requestType as ValidPlatformRequest['request_type'],
    priority: priority as ValidPlatformRequest['priority'],
    title,
    description,
  }
}
