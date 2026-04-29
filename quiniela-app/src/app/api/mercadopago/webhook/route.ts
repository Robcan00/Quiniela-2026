import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { MercadoPagoConfig, Payment } from 'mercadopago'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const EXPECTED_AMOUNT = 2500

export async function POST(req: Request) {
  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!accessToken || !supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Config error' }, { status: 500 })
    }

    const body = await req.json()

    const paymentId =
      body?.data?.id ||
      body?.id ||
      body?.resource?.split?.('/').pop?.()

    if (!paymentId) {
      return NextResponse.json({ received: true })
    }

    const client = new MercadoPagoConfig({
      accessToken,
    })

    const paymentClient = new Payment(client)
    const payment = await paymentClient.get({ id: paymentId })

    if (payment.status !== 'approved') {
      return NextResponse.json({ received: true })
    }

    const entryId = payment.external_reference

    if (!entryId || typeof entryId !== 'string') {
      console.error('[MERCADOPAGO_WEBHOOK] Pago aprobado sin external_reference:', paymentId)
      return NextResponse.json({ received: true })
    }

    if (Number(payment.transaction_amount) !== EXPECTED_AMOUNT) {
      console.error('[MERCADOPAGO_WEBHOOK] Monto inválido:', {
        paymentId,
        received: payment.transaction_amount,
        expected: EXPECTED_AMOUNT,
      })

      return NextResponse.json({ received: true })
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    const { data: entry, error: entryError } = await supabase
      .from('entries')
      .select('id, user_id, payment_status, payment_reference')
      .eq('id', entryId)
      .single()

    if (entryError || !entry) {
      console.error('[MERCADOPAGO_WEBHOOK] Entry no encontrada:', entryId)
      return NextResponse.json({ received: true })
    }

    if (entry.payment_status === 'paid') {
      return NextResponse.json({ received: true })
    }

    const { error: updateError } = await supabase
      .from('entries')
      .update({
        payment_status: 'paid',
        payment_amount: EXPECTED_AMOUNT,
        payment_method: 'mercadopago',
        payment_reference: String(payment.id),
        paid_at: new Date().toISOString(),
      })
      .eq('id', entryId)
      .neq('payment_status', 'paid')

    if (updateError) {
      console.error('[MERCADOPAGO_WEBHOOK] Error actualizando entry:', updateError.message)
      return NextResponse.json({ received: true })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[MERCADOPAGO_WEBHOOK] Error:', error)
    return NextResponse.json({ received: true })
  }
}