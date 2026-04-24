import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
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
}