import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.URL
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function getBearerToken(req: Request) {
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return null
  return authHeader.replace('Bearer ', '').trim()
}

function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Faltan variables de entorno de Supabase para admin.')
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function getSupabaseAuthClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Faltan variables públicas de Supabase para validar sesión.')
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function requireAdmin(req: Request) {
  const token = getBearerToken(req)

  if (!token) {
    return { ok: false as const, error: 'No autorizado.', status: 401 }
  }

  const authClient = getSupabaseAuthClient()
  const adminClient = getSupabaseAdmin()

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(token)

  if (userError || !user) {
    return { ok: false as const, error: 'Sesión inválida o expirada.', status: 401 }
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, email, role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    return { ok: false as const, error: profileError.message, status: 500 }
  }

  const email = (profile?.email || user.email || '').toLowerCase()
  const isAdmin = profile?.role === 'admin' || email === 'rcantoral@cantoralabogados.com'

  if (!isAdmin) {
    return { ok: false as const, error: 'No tienes permisos de administrador.', status: 403 }
  }

  return { ok: true as const, adminClient, user }
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

    const { entryId } = await req.json()

    if (!entryId || typeof entryId !== 'string') {
      return NextResponse.json({ error: 'Falta entryId.' }, { status: 400 })
    }

    const { error: predictionsError } = await adminCheck.adminClient
      .from('predictions')
      .delete()
      .eq('entry_id', entryId)

    if (predictionsError) {
      return NextResponse.json({ error: predictionsError.message }, { status: 500 })
    }

    const { error: entryError } = await adminCheck.adminClient
      .from('entries')
      .delete()
      .eq('id', entryId)

    if (entryError) {
      return NextResponse.json({ error: entryError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error inesperado borrando quiniela.'
    console.error('delete-entry error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
