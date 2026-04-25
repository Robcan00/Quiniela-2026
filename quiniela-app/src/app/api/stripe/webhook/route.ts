import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!stripeSecretKey || !webhookSecret) {
    return NextResponse.json(
      { error: 'Faltan variables de entorno de Stripe.' },
      { status: 500 }
    )
  }

  const stripe = new Stripe(stripeSecretKey)

  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Falta stripe-signature.' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Firma inválida'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const entryId = session.metadata?.entry_id || session.client_reference_id

    if (entryId) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

      if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json(
          { error: 'Faltan variables privadas de Supabase.' },
          { status: 500 }
        )
      }

      const adminSupabase = createClient(supabaseUrl, supabaseServiceKey)

      await adminSupabase
        .from('entries')
        .update({
          payment_status: 'paid',
          payment_amount: session.amount_total ? Math.round(session.amount_total / 100) : 2500,
          payment_method: 'stripe',
          payment_reference: session.id,
          paid_at: new Date().toISOString(),
        })
        .eq('id', entryId)
    }
  }

  return NextResponse.json({ received: true })
}