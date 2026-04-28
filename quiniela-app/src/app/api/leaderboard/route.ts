import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ratelimit } from '@/lib/ratelimit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    let remaining = 999

    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'anonymous'

    if (ratelimit) {
      const result = await ratelimit.limit(`leaderboard:${ip}`)
      remaining = result.remaining

      if (!result.success) {
        return NextResponse.json(
          {
            error: 'Demasiadas solicitudes. Intenta más tarde.',
            retryAfter: result.reset
              ? Math.ceil((result.reset - Date.now()) / 1000)
              : 60,
          },
          {
            status: 429,
            headers: {
              'Retry-After': result.reset
                ? String(Math.ceil((result.reset - Date.now()) / 1000))
                : '60',
              'X-RateLimit-Limit': String(result.limit),
              'X-RateLimit-Remaining': String(result.remaining),
            },
          }
        )
      }
    }

    const { data, error } = await supabase
      .from('leaderboard')
      .select(
  'entry_name, full_name, total_points, exact_hits, outcome_hits, goal_diff'
)
      .order('total_points', { ascending: false })
      .order('exact_hits', { ascending: false })
      .order('goal_diff', { ascending: true })
      .limit(500)

    if (error) {
      console.error('Error en leaderboard:', error.message)
      return NextResponse.json(
        { error: 'Error al traer datos del ranking' },
        { status: 500 }
      )
    }

    return NextResponse.json(data ?? [], {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=60',
        'X-RateLimit-Remaining': String(remaining),
      },
    })
  } catch (err) {
    console.error('Error en API leaderboard:', err)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}