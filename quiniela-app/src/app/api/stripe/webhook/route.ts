import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { log } from '@/lib/server/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const EXPECTED_AMOUNT_TOTAL = 250000
const EXPECTED_CURRENCY = 'mxn'

export async function POST(req: Request) {
  const endpoint = '/api/stripe/webhook'

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!stripeSecretKey || !webhookSecret) {
    log('error', {
      event: 'stripe_env_missing',
      endpoint,
      method: 'POST',
      result: 'error',
      status: 500,
      payload: {
        missingStripeSecretKey: !stripeSecretKey,
        missingWebhookSecret: !webhookSecret,
      },
    })

    return NextResponse.json(
      { error: 'Faltan variables de entorno de Stripe.' },
      { status: 500 }
    )
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    log('error', {
      event: 'supabase_env_missing',
      endpoint,
      method: 'POST',
      result: 'error',
      status: 500,
      payload: {
        missingSupabaseUrl: !supabaseUrl,
        missingServiceRoleKey: !supabaseServiceKey,
      },
    })

    return NextResponse.json(
      { error: 'Faltan variables privadas de Supabase.' },
      { status: 500 }
    )
  }

  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    log('warn', {
      event: 'stripe_webhook_missing_signature',
      endpoint,
      method: 'POST',
      result: 'unauthorized',
      status: 400,
    })

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
    log('warn', {
      event: 'stripe_webhook_invalid_signature',
      endpoint,
      method: 'POST',
      result: 'unauthorized',
      status: 400,
      error: err,
    })

    return NextResponse.json({ error: 'Firma inválida.' }, { status: 400 })
  }

  const adminSupabase = createClient(supabaseUrl, supabaseServiceKey)

  log('info', {
    event: 'stripe_webhook_received',
    endpoint,
    method: 'POST',
    result: 'success',
    status: 200,
    payload: {
      stripeEventId: event.id,
      stripeEventType: event.type,
    },
  })

  const { error: insertEventError } = await adminSupabase
    .from('stripe_webhook_events')
    .insert({
      id: event.id,
      type: event.type,
      status: 'processing',
      raw_event: event as unknown as Record<string, unknown>,
    })

  if (insertEventError) {
    const isDuplicate =
      insertEventError.code === '23505' ||
      insertEventError.message.toLowerCase().includes('duplicate')

    if (isDuplicate) {
      log('warn', {
        event: 'stripe_webhook_duplicate_ignored',
        endpoint,
        method: 'POST',
        result: 'success',
        status: 200,
        payload: {
          stripeEventId: event.id,
          stripeEventType: event.type,
        },
      })

      return NextResponse.json({ received: true, duplicate: true })
    }

    log('error', {
      event: 'stripe_webhook_event_insert_failed',
      endpoint,
      method: 'POST',
      result: 'error',
      status: 500,
      payload: {
        stripeEventId: event.id,
        stripeEventType: event.type,
      },
      error: insertEventError,
    })

    return NextResponse.json({ received: true })
  }

  try {
    if (event.type !== 'checkout.session.completed') {
      await adminSupabase
        .from('stripe_webhook_events')
        .update({
          status: 'ignored',
          processed_at: new Date().toISOString(),
        })
        .eq('id', event.id)

      return NextResponse.json({ received: true })
    }

    const session = event.data.object as Stripe.Checkout.Session
    const entryId = session.metadata?.entry_id || session.client_reference_id
    const userIdFromMetadata = session.metadata?.user_id

    if (!entryId || typeof entryId !== 'string') {
      throw new Error(`Webhook sin entryId válido. Session: ${session.id}`)
    }

    if (session.payment_status !== 'paid') {
      throw new Error(
        `Checkout completado sin payment_status paid. Entry: ${entryId}, status: ${session.payment_status}`
      )
    }

    if (session.amount_total !== EXPECTED_AMOUNT_TOTAL) {
      throw new Error(
        `Monto inválido. Entry: ${entryId}, recibido: ${session.amount_total}, esperado: ${EXPECTED_AMOUNT_TOTAL}`
      )
    }

    if (session.currency !== EXPECTED_CURRENCY) {
      throw new Error(
        `Moneda inválida. Entry: ${entryId}, recibida: ${session.currency}, esperada: ${EXPECTED_CURRENCY}`
      )
    }

    const { data: existingEntry, error: fetchError } = await adminSupabase
      .from('entries')
      .select('id, payment_status, user_id, payment_reference')
      .eq('id', entryId)
      .single()

    if (fetchError || !existingEntry) {
      throw new Error(`EntryId no existe en webhook: ${entryId}`)
    }

    if (userIdFromMetadata && userIdFromMetadata !== existingEntry.user_id) {
      throw new Error(`Metadata user_id no coincide con entry.user_id. Entry: ${entryId}`)
    }

    if (existingEntry.payment_status === 'paid') {
      log('warn', {
        event: 'stripe_entry_already_paid',
        endpoint,
        method: 'POST',
        result: 'success',
        status: 200,
        userId: existingEntry.user_id,
        payload: {
          stripeEventId: event.id,
          entryId,
          stripeSessionId: session.id,
          previousReference: existingEntry.payment_reference,
        },
      })

      await adminSupabase
        .from('stripe_webhook_events')
        .update({
          status: 'duplicate_entry_already_paid',
          processed_at: new Date().toISOString(),
        })
        .eq('id', event.id)

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
      throw updateError
    }

    log('info', {
      event: 'stripe_payment_processed_successfully',
      endpoint,
      method: 'POST',
      result: 'success',
      status: 200,
      userId: updatedEntry?.user_id,
      payload: {
        stripeEventId: event.id,
        entryId,
        amount: updatedEntry?.payment_amount,
        stripeSessionId: session.id,
      },
    })

    await adminSupabase
      .from('stripe_webhook_events')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', event.id)

    return NextResponse.json({ received: true })
  } catch (error) {
    log('error', {
      event: 'stripe_webhook_processing_error',
      endpoint,
      method: 'POST',
      result: 'error',
      status: 500,
      payload: {
        stripeEventId: event.id,
        stripeEventType: event.type,
      },
      error,
    })

    await adminSupabase
      .from('stripe_webhook_events')
      .update({
        status: 'error',
        processed_at: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', event.id)

    return NextResponse.json({ received: true })
  }
}