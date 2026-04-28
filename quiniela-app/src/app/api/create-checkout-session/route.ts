import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
   const stripeSecretKey = process.env.STRIPE_SECRET_KEY

    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'Falta STRIPE_SECRET_KEY en variables de entorno.' },
        { status: 500 }
      )
    }

    const { entryId, userEmail } = await req.json()

    if (!entryId || !userEmail) {
      return NextResponse.json(
        { error: 'Faltan datos para crear el pago.' },
        { status: 400 }
      )
    }

    // Validar autenticación del usuario
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('[SECURITY] Intento de checkout sin token de autenticación')
      return NextResponse.json(
        { error: 'Usuario no autenticado.' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Faltan variables de Supabase.' },
        { status: 500 }
      )
    }

    // Crear cliente Supabase con token del usuario autenticado
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    })

    // Obtener usuario autenticado desde el token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      console.warn('[SECURITY] Token inválido o usuario no autenticado:', userError?.message)
      return NextResponse.json(
        { error: 'Token inválido o expirado.' },
        { status: 401 }
      )
    }

    // Validar que entryId pertenece al usuario autenticado
    const { data: entry, error: entryError } = await supabaseClient
      .from('entries')
      .select('user_id')
      .eq('id', entryId)
      .single()

    if (entryError || !entry) {
      console.warn('[SECURITY] EntryId no encontrado o error Supabase:', entryId, entryError?.message)
      return NextResponse.json(
        { error: 'Quiniela no encontrada.' },
        { status: 404 }
      )
    }

    if (entry.user_id !== user.id) {
      console.warn('[SECURITY] Intento de pago para quiniela ajena. UserId:', user.id, 'EntryUserId:', entry.user_id)
      return NextResponse.json(
        { error: 'No tienes permiso para pagar esta quiniela.' },
        { status: 403 }
      )
    }

    // Crear sesión de Stripe
    const stripe = new Stripe(stripeSecretKey)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price: 'price_1TPrVEDoIhX3q8oNDhIB2NTc',
          quantity: 1,
        },
      ],
      customer_email: userEmail,
      client_reference_id: entryId,
      metadata: {
        entry_id: entryId,
      },
      success_url: 'https://www.superquiniela2026.com?payment=success',
      cancel_url: 'https://www.superquiniela2026.com?payment=cancelled',
    })

    console.log('[INFO] Sesión de checkout creada:', { entryId, userId: user.id })
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Error creando checkout session:', error)

    return NextResponse.json(
      { error: 'Error creando sesión de pago.' },
      { status: 500 }
    )
  }
}