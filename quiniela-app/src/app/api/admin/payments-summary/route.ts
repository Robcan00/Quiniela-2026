import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ENTRY_PRICE = 2500
const ADMIN_FEE = 200
const GUARANTEED_PRIZE = 300000
const ADMIN_EMAIL = 'rcantoral@cantoralabogados.com'

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '').trim()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: 'Faltan variables de entorno de Supabase.' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey)

    let userId: string | null = null
    let userEmail = ''

    try {
      const base64Payload = token.split('.')[1]
      const decoded = JSON.parse(Buffer.from(base64Payload, 'base64').toString())

      userId = decoded.sub
      userEmail = (decoded.email || '').toLowerCase()
    } catch {
      return NextResponse.json(
        { error: 'Token inválido.' },
        { status: 401 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Token inválido.' },
        { status: 401 }
      )
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    const isAdmin = profile?.role === 'admin' || userEmail === ADMIN_EMAIL

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: entriesData, error: entriesError } = await supabaseAdmin
      .from('entries')
      .select('id, payment_status, payment_amount')

    if (entriesError) {
      return NextResponse.json({ error: entriesError.message }, { status: 500 })
    }

    const entries = entriesData ?? []

    const totalEntries = entries.length
    const paidEntries = entries.filter((entry) => entry.payment_status === 'paid').length
    const exemptEntries = entries.filter((entry) => entry.payment_status === 'exempt').length
    const pendingEntries = entries.filter(
      (entry) =>
        entry.payment_status !== 'paid' &&
        entry.payment_status !== 'exempt'
    ).length

    const totalCollected = entries.reduce(
      (sum, entry) => sum + Number(entry.payment_amount ?? 0),
      0
    )

    const adminFees = paidEntries * ADMIN_FEE
    const realPrizePool = totalCollected - adminFees
    const prizePool = realPrizePool

    const { data: recentPaymentsData, error: recentPaymentsError } =
      await supabaseAdmin
        .from('payments')
        .select(
          'id, entry_id, user_id, provider, provider_payment_id, status, amount, currency, payment_method, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(10)

    return NextResponse.json({
      totalEntries,
      paidEntries,
      pendingEntries,
      exemptEntries,
      totalCollected,
      mercadopagoCollected: totalCollected,
      adminFees,
      prizeContribution: realPrizePool,
      prizePool,
      guaranteedPrizePool: GUARANTEED_PRIZE,
      expectedTotal: totalEntries * ENTRY_PRICE,
      approvedPaymentsCount: paidEntries,
      recentPayments: recentPaymentsError ? [] : recentPaymentsData ?? [],
    })
  } catch (err) {
    console.error('payments-summary error:', err)

    const message =
      err instanceof Error ? err.message : 'Error interno desconocido'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}