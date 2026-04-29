import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ADMIN_EMAIL = 'rcantoral@cantoralabogados.com'

function getBearerToken(req: Request) {
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return null
  return authHeader.replace('Bearer ', '').trim()
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Faltan variables de entorno de Supabase para admin.')
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
    },
  })
}

function getSupabaseAuthClient(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Faltan variables públicas de Supabase.')
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })
}

async function requireAdmin(req: Request) {
  const token = getBearerToken(req)

  if (!token || token === 'null' || token === 'undefined') {
    return { ok: false as const, error: 'No autorizado.', status: 401 }
  }

  const authClient = getSupabaseAuthClient(token)

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser()

  if (userError || !user) {
    return { ok: false as const, error: 'Sesión inválida o expirada.', status: 401 }
  }

  const { data: profile, error: profileError } = await authClient
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .single()

  if (profileError) {
    return { ok: false as const, error: profileError.message, status: 500 }
  }

  const email = (profile?.email || user.email || '').toLowerCase()

  const isAdmin =
    profile?.role === 'admin' || email === ADMIN_EMAIL

  if (!isAdmin) {
    return {
      ok: false as const,
      error: 'No tienes permisos de administrador.',
      status: 403,
    }
  }

  const adminClient = getSupabaseAdmin()

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

    let body: any

    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { error: 'Body inválido.' },
        { status: 400 }
      )
    }

    const { userId } = body

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'userId inválido.' },
        { status: 400 }
      )
    }

    // 🔥 Leer entradas del usuario
    const { data: userEntries, error: entriesReadError } =
      await adminCheck.adminClient
        .from('entries')
        .select('id')
        .eq('user_id', userId)

    if (entriesReadError) {
      return NextResponse.json(
        { error: entriesReadError.message },
        { status: 500 }
      )
    }

    const entryIds = (userEntries ?? []).map((e) => e.id)

    // 🔥 Borrar predictions
    if (entryIds.length > 0) {
      const { error: predictionsError } =
        await adminCheck.adminClient
          .from('predictions')
          .delete()
          .in('entry_id', entryIds)

      if (predictionsError) {
        return NextResponse.json(
          { error: predictionsError.message },
          { status: 500 }
        )
      }

      const { error: entriesDeleteError } =
        await adminCheck.adminClient
          .from('entries')
          .delete()
          .eq('user_id', userId)

      if (entriesDeleteError) {
        return NextResponse.json(
          { error: entriesDeleteError.message },
          { status: 500 }
        )
      }
    }

    // 🔥 Borrar profile
    const { error: profileDeleteError } =
      await adminCheck.adminClient
        .from('profiles')
        .delete()
        .eq('id', userId)

    if (profileDeleteError) {
      return NextResponse.json(
        { error: profileDeleteError.message },
        { status: 500 }
      )
    }

    // 🔥 Borrar usuario en Auth
    const { error: authDeleteError } =
      await adminCheck.adminClient.auth.admin.deleteUser(userId)

    if (
      authDeleteError &&
      !authDeleteError.message.toLowerCase().includes('not found')
    ) {
      console.warn(
        'Usuario borrado de tablas, pero no de Auth:',
        authDeleteError.message
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Error inesperado borrando usuario.'

    console.error('delete-user error:', message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}