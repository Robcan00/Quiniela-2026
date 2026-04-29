import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { MercadoPagoConfig, Payment } from 'mercadopago'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const EXPECTED_AMOUNT = 2500
const CURRENCY = 'MXN'

export async function POST(req: Request) {
  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!accessToken || !supabaseUrl || !supabaseAnonKey || !serviceKey) {
      return NextResponse.json({ error: 'Faltan variables.' }, { status: 500 })
    }

    const { paymentId, entryId } = await req.json()

    if (!paymentId || !entryId) {
      return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 })
    }

    const authHeader = req.headers.get('authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    }

    const token = authHeader.substring(7)

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
      return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })
    }

    const client = new MercadoPagoConfig({ accessToken })
    const paymentClient = new Payment(client)
    const payment = await paymentClient.get({ id: String(paymentId) })

    if (payment.status !== 'approved') {
      return NextResponse.json({ error: 'Pago no aprobado.' }, { status: 400 })
    }

    if (payment.external_reference !== entryId) {
      return NextResponse.json({ error: 'Referencia inválida.' }, { status: 400 })
    }

    if (Number(payment.transaction_amount) !== EXPECTED_AMOUNT) {
      return NextResponse.json({ error: 'Monto inválido.' }, { status: 400 })
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    const { data: entry, error: entryError } = await adminClient
      .from('entries')
      .select('id, user_id, payment_status')
      .eq('id', entryId)
      .single()

    if (entryError || !entry) {
      return NextResponse.json({ error: 'Quiniela no encontrada.' }, { status: 404 })
    }

    if (entry.user_id !== user.id) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 })
    }

    const providerPaymentId = String(payment.id)

    const { error: paymentLogError } = await adminClient
      .from('payments')
      .upsert(
        {
          entry_id: entryId,
          user_id: user.id,
          provider: 'mercadopago',
          provider_payment_id: providerPaymentId,
          status: payment.status,
          amount: Number(payment.transaction_amount),
          currency: CURRENCY,
          payment_method: payment.payment_method_id ?? payment.payment_type_id ?? null,
          raw_payload: payment,
        },
        { onConflict: 'provider_payment_id' }
      )

    if (paymentLogError) {
      console.error('[MERCADOPAGO_CONFIRM_PAYMENT] Error guardando payment log:', paymentLogError.message)
      return NextResponse.json({ error: paymentLogError.message }, { status: 500 })
    }

    if (entry.payment_status === 'paid') {
      return NextResponse.json({ success: true, alreadyPaid: true })
    }

    const { error: updateError } = await adminClient
      .from('entries')
      .update({
        payment_status: 'paid',
        payment_amount: EXPECTED_AMOUNT,
        payment_method: 'mercadopago',
        payment_reference: providerPaymentId,
        paid_at: new Date().toISOString(),
      })
      .eq('id', entryId)
      .neq('payment_status', 'paid')

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[MERCADOPAGO_CONFIRM_PAYMENT] Error:', error)
    return NextResponse.json({ error: 'Error confirmando pago.' }, { status: 500 })
  }
}