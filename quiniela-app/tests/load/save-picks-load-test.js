import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1500'],
  },
}

const BASE_URL = 'https://www.superquiniela2026.com'
const TOKEN = __ENV.TOKEN
const ENTRY_ID = __ENV.ENTRY_ID
const MATCH_ID = __ENV.MATCH_ID

export default function () {
  const homeScore = Math.floor(Math.random() * 5)
  const awayScore = Math.floor(Math.random() * 5)

  const res = http.post(
    `${BASE_URL}/api/predictions/save`,
    JSON.stringify({
      entryId: ENTRY_ID,
      matchId: MATCH_ID,
      homeScore,
      awayScore,
    }),
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      responseCallback: http.expectedStatuses(200, 201, 400, 404, 405),
    }
  )

  check(res, {
    'no 500 en guardado': (r) => ![500, 502, 503, 504].includes(r.status),
  })

  sleep(1)
}