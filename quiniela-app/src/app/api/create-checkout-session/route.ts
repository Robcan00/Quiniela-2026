import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { MercadoPagoConfig, Preference } from 'mercadopago'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ENTRY_PRICE = 2500

export async function POST(req: Request) {
  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.superquiniela2026.com'

    if (!accessToken || !supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Faltan variables de entorno.' },
        { status: 500 }
      )
    }

    const { entryId } = await req.json()

    if (!entryId || typeof entryId !== 'string') {
      return NextResponse.json(
        { error: 'Falta entryId.' },
        { status: 400 }
      )
    }

    const authHeader = req.headers.get('authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    }

    const token = authHeader.substring(7)

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

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Sesión inválida o expirada.' },
        { status: 401 }
      )
    }

    const { data: entry, error: entryError } = await supabase
      .from('entries')
      .select('id, user_id, payment_status')
      .eq('id', entryId)
      .single()

    if (entryError || !entry) {
      return NextResponse.json(
        { error: 'Quiniela no encontrada.' },
        { status: 404 }
      )
    }

    if (entry.user_id !== user.id) {
      return NextResponse.json(
        { error: 'No puedes pagar una quiniela ajena.' },
        { status: 403 }
      )
    }

    if (entry.payment_status === 'paid') {
      return NextResponse.json(
        { error: 'Esta quiniela ya está pagada.' },
        { status: 409 }
      )
    }

    const client = new MercadoPagoConfig({
      accessToken,
    })

    const preference = new Preference(client)

    const result = await preference.create({
      body: {
        items: [
          {
            id: entryId,
            title: 'Súper Quiniela Mundial 2026',
            quantity: 1,
            unit_price: ENTRY_PRICE,
            currency_id: 'MXN',
          },
        ],
        payer: {
          email: user.email ?? undefined,
        },
        external_reference: entryId,
        notification_url: `${siteUrl}/api/mercadopago/webhook`,
        back_urls: {
          success: `${siteUrl}?payment=success`,
          failure: `${siteUrl}?payment=failed`,
          pending: `${siteUrl}?payment=pending`,
        },
        auto_return: 'approved',
      },
    })

    return NextResponse.json({
      url: result.init_point,
    })
  } catch (error) {
    console.error('[MERCADOPAGO_CHECKOUT] Error:', error)

    return NextResponse.json(
      { error: 'Error creando pago con Mercado Pago.' },
      { status: 500 }
    )
  }
}