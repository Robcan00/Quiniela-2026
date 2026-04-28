import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  vus: 10,
  duration: '45s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1500'],
  },
}

const BASE_URL = 'https://www.superquiniela2026.com'

export default function () {
  const leaderboard = http.get(`${BASE_URL}/api/leaderboard`, {
  responseCallback: http.expectedStatuses(200),
})

const publicPicks = http.get(`${BASE_URL}/api/public/picks`, {
  responseCallback: http.expectedStatuses(200, 401, 403),
})

const publicEntries = http.get(`${BASE_URL}/api/public/entries`, {
  responseCallback: http.expectedStatuses(200, 401, 403),
})

  sleep(1)
}