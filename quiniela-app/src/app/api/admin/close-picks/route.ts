import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function requireAdmin(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return { ok: false as const, error: 'Faltan variables de entorno.', status: 500 }
  }

  const authHeader = req.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false as const, error: 'No autorizado.', status: 401 }
  }

  const token = authHeader.substring(7)

  if (!token || token === 'null' || token === 'undefined') {
    return { ok: false as const, error: 'Token inválido.', status: 401 }
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
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
  } = await userClient.auth.getUser()

  if (userError || !user) {
    return { ok: false as const, error: 'Sesión inválida.', status: 401 }
  }

  const { data: profile, error: profileError } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || profile?.role !== 'admin') {
    return { ok: false as const, error: 'No tienes permisos de administrador.', status: 403 }
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })

  return { ok: true as const, adminClient }
}

export async function POST(req: Request) {
  try {
    const adminCheck = await requireAdmin(req)

    if (!adminCheck.ok) {
      return NextResponse.json(
        { error: adminCheck.error },
        { status: adminCheck.status }
      )
    }

    const { data, error } = await adminCheck.adminClient
      .from('predictions')
      .select('id, home_score_predicted, away_score_predicted')
      .or('home_score_predicted.is.null,away_score_predicted.is.null')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const incompletePredictions = data ?? []
    let updated = 0

    for (const prediction of incompletePredictions) {
      const { error: updateError } = await adminCheck.adminClient
        .from('predictions')
        .update({
          home_score_predicted: prediction.home_score_predicted ?? 0,
          away_score_predicted: prediction.away_score_predicted ?? 0,
        })
        .eq('id', prediction.id)

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        )
      }

      updated += 1
    }

    return NextResponse.json({
      success: true,
      updated,
    })
  } catch {
    return NextResponse.json(
      { error: 'Error cerrando picks.' },
      { status: 500 }
    )
  }
}