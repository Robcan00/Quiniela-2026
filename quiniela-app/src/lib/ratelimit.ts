import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redisUrl = process.env.UPSTASH_REDIS_REST_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

export const rateLimitEnabled = Boolean(redisUrl && redisToken)

const redis = rateLimitEnabled
  ? new Redis({
      url: redisUrl!,
      token: redisToken!,
    })
  : null

export const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      analytics: true,
      prefix: 'ratelimit',
    })
  : null

export const strictRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
      prefix: 'strict-ratelimit',
    })
  : null