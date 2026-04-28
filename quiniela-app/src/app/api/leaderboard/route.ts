import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ratelimit } from '@/lib/ratelimit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // 1️⃣ Rate Limiting por IP
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'anonymous'
    
    const { success, limit, remaining, reset } = await ratelimit.limit(`leaderboard:${ip}`)
    
    if (!success) {
      return NextResponse.json(
        { 
          error: 'Demasiadas solicitudes. Intenta más tarde.',
          retryAfter: reset ? Math.ceil((reset - Date.now()) / 1000) : 60
        },
        { 
          status: 429,
          headers: {
            'Retry-After': reset ? String(Math.ceil((reset - Date.now()) / 1000)) : '60',
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': String(remaining),
          }
        }
      )
    }

    // 2️⃣ Traer leaderboard de forma segura
    const { data, error } = await supabase
      .from('leaderboard')
      .select('entry_id, user_id, entry_name, full_name, total_points, exact_hits, outcome_hits, goal_diff')
      .order('total_points', { ascending: false })
      .order('exact_hits', { ascending: false })
      .order('goal_diff', { ascending: true })
      .limit(500) // ← Limitar resultados

    if (error) {
      console.error('Error en leaderboard:', error.message)
      return NextResponse.json(
        { error: 'Error al traer datos del ranking' },
        { status: 500 }
      )
    }

    // 3️⃣ Response con headers de cache
    return NextResponse.json(data ?? [], {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=60', // Cache 60s
        'X-RateLimit-Remaining': String(remaining),
      }
    })
  } catch (err) {
    console.error('Error en API leaderboard:', err)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}