import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const EXPECTED_AMOUNT_TOTAL = 250000
const EXPECTED_CURRENCY = 'mxn'

export async function POST(req: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!stripeSecretKey || !webhookSecret) {
    return NextResponse.json(
      { error: 'Faltan variables de entorno de Stripe.' },
      { status: 500 }
    )
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[ERROR] Faltan variables privadas de Supabase')
    return NextResponse.json(
      { error: 'Faltan variables privadas de Supabase.' },
      { status: 500 }
    )
  }

  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Falta stripe-signature.' },
      { status: 400 }
    )
  }

  const stripe = new Stripe(stripeSecretKey)
  const body = await req.text()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Firma inválida'
    console.warn('[SECURITY] Webhook Stripe con firma inválida:', message)

    return NextResponse.json({ error: 'Firma inválida.' }, { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const entryId = session.metadata?.entry_id || session.client_reference_id
  const userIdFromMetadata = session.metadata?.user_id

  if (!entryId || typeof entryId !== 'string') {
    console.warn('[SECURITY] Webhook sin entryId válido:', {
      sessionId: session.id,
    })
    return NextResponse.json({ received: true })
  }

  if (session.payment_status !== 'paid') {
    console.warn('[SECURITY] Checkout completado sin payment_status paid:', {
      entryId,
      sessionId: session.id,
      paymentStatus: session.payment_status,
    })
    return NextResponse.json({ received: true })
  }

  if (session.amount_total !== EXPECTED_AMOUNT_TOTAL) {
    console.error('[SECURITY] Monto Stripe inválido:', {
      entryId,
      sessionId: session.id,
      amountTotal: session.amount_total,
      expected: EXPECTED_AMOUNT_TOTAL,
    })
    return NextResponse.json({ received: true })
  }

  if (session.currency !== EXPECTED_CURRENCY) {
    console.error('[SECURITY] Moneda Stripe inválida:', {
      entryId,
      sessionId: session.id,
      currency: session.currency,
      expected: EXPECTED_CURRENCY,
    })
    return NextResponse.json({ received: true })
  }

  const adminSupabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data: existingEntry, error: fetchError } = await adminSupabase
    .from('entries')
    .select('id, payment_status, user_id, payment_reference')
    .eq('id', entryId)
    .single()

  if (fetchError || !existingEntry) {
    console.error('[SECURITY] EntryId no existe en webhook:', {
      entryId,
      error: fetchError?.message,
    })
    return NextResponse.json({ received: true })
  }

  if (userIdFromMetadata && userIdFromMetadata !== existingEntry.user_id) {
    console.error('[SECURITY] Metadata user_id no coincide con entry.user_id:', {
      entryId,
      sessionId: session.id,
    })
    return NextResponse.json({ received: true })
  }

  if (existingEntry.payment_status === 'paid') {
    console.warn('[SECURITY] Webhook duplicado para quiniela ya pagada:', {
      entryId,
      stripeSessionId: session.id,
      previousReference: existingEntry.payment_reference,
    })
    return NextResponse.json({ received: true })
  }

  const { error: updateError, data: updatedEntry } = await adminSupabase
    .from('entries')
    .update({
      payment_status: 'paid',
      payment_amount: EXPECTED_AMOUNT_TOTAL / 100,
      payment_method: 'stripe',
      payment_reference: session.id,
      paid_at: new Date().toISOString(),
    })
    .eq('id', entryId)
    .neq('payment_status', 'paid')
    .select('id, user_id, payment_amount, payment_status, payment_reference')
    .single()

  if (updateError) {
    console.error('[ERROR] Fallo actualizar entrada en webhook:', {
      entryId,
      error: updateError.message,
    })
    return NextResponse.json({ received: true })
  }

  console.log('[INFO] Pago procesado exitosamente:', {
    entryId,
    userId: updatedEntry?.user_id,
    amount: updatedEntry?.payment_amount,
    stripeSessionId: session.id,
  })

  return NextResponse.json({ received: true })
}