import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

    const authHeader = req.headers.get('authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Usuario no autenticado.' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    if (!token || token === 'null' || token === 'undefined') {
      return NextResponse.json(
        { error: 'Token inválido.' },
        { status: 401 }
      )
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
      return NextResponse.json(
        { error: 'Token inválido o expirado.' },
        { status: 401 }
      )
    }

    const { data: profile, error: profileError } = await userClient
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 })
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })

    const { data, error } = await adminClient
      .from('entries')
      .select(`
        id,
        name,
        user_id,
        payment_status,
        payment_amount,
        payment_method,
        payment_reference,
        paid_at,
        profiles (
          full_name,
          email,
          phone
        )
      `)
      .order('user_id', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      console.error('[ADMIN_PAYMENTS] Error cargando pagos:', error.message)
      return NextResponse.json(
        { error: 'Error cargando pagos.' },
        { status: 500 }
      )
    }

    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error('[ADMIN_PAYMENTS] Error interno:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor.' },
      { status: 500 }
    )
  }
}