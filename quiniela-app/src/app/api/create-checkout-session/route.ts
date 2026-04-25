import { NextResponse } from 'next/server'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    console.log('STRIPE_SECRET_KEY prefix:', stripeSecretKey?.slice(0, 7))

    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'Falta STRIPE_SECRET_KEY en variables de entorno.' },
        { status: 500 }
      )
    }

    const stripe = new Stripe(stripeSecretKey)

    const { entryId, userEmail } = await req.json()

    if (!entryId || !userEmail) {
      return NextResponse.json(
        { error: 'Faltan datos para crear el pago.' },
        { status: 400 }
      )
    }

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

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Error creando checkout session:', error)

    return NextResponse.json(
      { error: 'Error creando sesión de pago.' },
      { status: 500 }
    )
  }
}