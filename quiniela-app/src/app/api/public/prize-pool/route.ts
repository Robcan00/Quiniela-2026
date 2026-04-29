import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const GUARANTEED_PRIZE = 300000
const ADMIN_FEE = 200

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: 'Faltan variables de entorno de Supabase.' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey)

    const { data: entriesData, error } = await supabaseAdmin
      .from('entries')
      .select('payment_status, payment_amount')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const entries = entriesData ?? []

    const paidEntries = entries.filter(
      (entry) => entry.payment_status === 'paid'
    ).length

    const totalCollected = entries.reduce(
      (sum, entry) => sum + Number(entry.payment_amount ?? 0),
      0
    )

    const adminFees = paidEntries * ADMIN_FEE
    const realPrizePool = Math.max(totalCollected - adminFees, 0)

    const displayPrizePool = Math.max(GUARANTEED_PRIZE, realPrizePool)

    return NextResponse.json({
      guaranteedPrizePool: GUARANTEED_PRIZE,
      realPrizePool,
      displayPrizePool,
      paidEntries,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('public prize-pool error:', err)

    const message =
      err instanceof Error ? err.message : 'Error interno desconocido'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}