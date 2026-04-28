type LogLevel = 'info' | 'warn' | 'error'

type LogPayload = {
  event: string
  endpoint?: string
  method?: string
  userId?: string | null
  email?: string | null
  ip?: string | null
  status?: number
  result?: 'success' | 'error' | 'unauthorized' | 'forbidden'
  payload?: Record<string, any>
  error?: unknown
}

function sanitizePayload(payload?: Record<string, any>) {
  if (!payload) return undefined

  const blockedKeys = [
    'password',
    'token',
    'access_token',
    'refresh_token',
    'authorization',
    'stripeSignature',
    'secret',
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
  ]

  const clean: Record<string, any> = {}

  for (const [key, value] of Object.entries(payload)) {
    if (blockedKeys.some((blocked) => key.toLowerCase().includes(blocked.toLowerCase()))) {
      clean[key] = '[REDACTED]'
    } else {
      clean[key] = value
    }
  }

  return clean
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
    }
  }

  return error
}

export function log(level: LogLevel, data: LogPayload) {
  const body = {
    level,
    timestamp: new Date().toISOString(),
    app: 'super-quiniela-mundial-2026',
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    event: data.event,
    endpoint: data.endpoint,
    method: data.method,
    userId: data.userId || null,
    email: data.email || null,
    ip: data.ip || null,
    status: data.status,
    result: data.result,
    payload: sanitizePayload(data.payload),
    error: serializeError(data.error),
  }

  const line = JSON.stringify(body)

  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}