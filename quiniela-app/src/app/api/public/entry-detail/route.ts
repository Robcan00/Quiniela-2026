import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PUBLIC_REVEAL_DATE = new Date('2026-06-11T10:00:00-06:00')
const ADMIN_EMAILS = ['rcantoral@cantoralabogados.com']

function isAdminEmail(email?: string | null) {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase())
}

async function canViewPublicData(
  req: Request,
  supabaseUrl: string,
  supabaseAnonKey: string
) {
  if (new Date() >= PUBLIC_REVEAL_DATE) return true

  const authHeader = req.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false

  const token = authHeader.substring(7)
  if (!token || token === 'null' || token === 'undefined') return false

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) return false
  if (isAdminEmail(user.email)) return true

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError) return false

  return profile?.role === 'admin'
}

export async function GET(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Faltan variables de entorno de Supabase.' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(req.url)
    const entryId = searchParams.get('entryId')

    if (!entryId) {
      return NextResponse.json({ error: 'Falta entryId.' }, { status: 400 })
    }

    const allowed = await canViewPublicData(req, supabaseUrl, supabaseAnonKey)

    if (!allowed) {
      return NextResponse.json(
        { error: 'Las quinielas públicas aún están bloqueadas.' },
        { status: 403 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })

    const [{ data: entry, error: entryError }, { data: predictions, error: predictionsError }] =
      await Promise.all([
        supabase
          .from('entries')
          .select(`
            id,
            name,
            user_id,
            profiles (
              full_name,
              email
            )
          `)
          .eq('id', entryId)
          .single(),
        supabase
          .from('predictions')
          .select('match_id, home_score_predicted, away_score_predicted')
          .eq('entry_id', entryId),
      ])

    if (entryError) {
      console.error('[PUBLIC_ENTRY_DETAIL] Entry error:', entryError.message)
      return NextResponse.json(
        { error: 'No se encontró la quiniela.' },
        { status: 404 }
      )
    }

    if (predictionsError) {
      console.error('[PUBLIC_ENTRY_DETAIL] Predictions error:', predictionsError.message)
      return NextResponse.json(
        { error: 'Error cargando picks de la quiniela.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      entry,
      predictions: predictions ?? [],
    })
  } catch (error) {
    console.error('[PUBLIC_ENTRY_DETAIL] Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor.' },
      { status: 500 }
    )
  }
}