import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    const stripePriceId = process.env.STRIPE_PRICE_ID
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'Falta STRIPE_SECRET_KEY en variables de entorno.' },
        { status: 500 }
      )
    }

    if (!stripePriceId) {
      return NextResponse.json(
        { error: 'Falta STRIPE_PRICE_ID en variables de entorno.' },
        { status: 500 }
      )
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Faltan variables de Supabase.' },
        { status: 500 }
      )
    }

    const { entryId } = await req.json()

    if (!entryId || typeof entryId !== 'string') {
      return NextResponse.json(
        { error: 'Faltan datos para crear el pago.' },
        { status: 400 }
      )
    }

    const authHeader = req.headers.get('authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('[SECURITY] Intento de checkout sin token de autenticación')
      return NextResponse.json(
        { error: 'Usuario no autenticado.' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    })

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      console.warn(
        '[SECURITY] Token inválido o usuario no autenticado:',
        userError?.message
      )
      return NextResponse.json(
        { error: 'Token inválido o expirado.' },
        { status: 401 }
      )
    }

    const { data: entry, error: entryError } = await supabaseClient
      .from('entries')
      .select('user_id, payment_status')
      .eq('id', entryId)
      .single()

    if (entryError || !entry) {
      console.warn(
        '[SECURITY] EntryId no encontrado o error Supabase:',
        entryId,
        entryError?.message
      )
      return NextResponse.json(
        { error: 'Quiniela no encontrada.' },
        { status: 404 }
      )
    }

    if (entry.user_id !== user.id) {
      console.warn('[SECURITY] Intento de pago para quiniela ajena.', {
        userId: user.id,
        entryUserId: entry.user_id,
      })

      return NextResponse.json(
        { error: 'No tienes permiso para pagar esta quiniela.' },
        { status: 403 }
      )
    }

    if (entry.payment_status === 'paid') {
      return NextResponse.json(
        { error: 'Esta quiniela ya está pagada.' },
        { status: 409 }
      )
    }

    const stripe = new Stripe(stripeSecretKey)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      customer_email: user.email ?? undefined,
      client_reference_id: entryId,
      metadata: {
        entry_id: entryId,
        user_id: user.id,
      },
      success_url: 'https://www.superquiniela2026.com?payment=success',
      cancel_url: 'https://www.superquiniela2026.com?payment=cancelled',
    })

    console.log('[INFO] Sesión de checkout creada:', {
      entryId,
      userId: user.id,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Error creando checkout session:', error)

    return NextResponse.json(
      { error: 'Error creando sesión de pago.' },
      { status: 500 }
    )
  }
}