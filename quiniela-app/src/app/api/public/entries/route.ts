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

    const { data, error } = await supabase
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
      .order('user_id', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      console.error('[PUBLIC_ENTRIES] Error:', error.message)
      return NextResponse.json(
        { error: 'Error cargando quinielas por participante.' },
        { status: 500 }
      )
    }

    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error('[PUBLIC_ENTRIES] Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor.' },
      { status: 500 }
    )
  }
}