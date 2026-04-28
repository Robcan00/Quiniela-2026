import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Validar que las variables de entorno existan
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('Faltan variables de entorno de Upstash Redis para Rate Limiting')
}

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests/minuto
  analytics: true,
  prefix: 'ratelimit',
})

// Rate limit más estricto para operaciones sensibles
export const strictRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests/minuto
  analytics: true,
  prefix: 'strict-ratelimit',
})