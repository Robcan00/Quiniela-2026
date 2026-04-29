import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ENTRY_PRICE = 2500

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // 🔐 Validar usuario
    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    // 🔐 Obtener perfil
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    const isAdmin =
      profile?.role === 'admin' ||
      user.email === 'rcantoral@cantoralabogados.com'

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { entryId, paymentStatus } = body

    if (!entryId || !['paid', 'pending', 'exempt'].includes(paymentStatus)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    let updateData: any = {}

    if (paymentStatus === 'paid') {
      updateData = {
        payment_status: 'paid',
        payment_amount: ENTRY_PRICE,
        payment_method: 'manual_admin',
        payment_reference: `Marcado manualmente por admin: ${user.email}`,
        paid_at: new Date().toISOString(),
      }
    }

    if (paymentStatus === 'pending') {
      updateData = {
        payment_status: 'pending',
        payment_amount: 0,
        payment_method: null,
        payment_reference: null,
        paid_at: null,
      }
    }

    if (paymentStatus === 'exempt') {
      updateData = {
        payment_status: 'exempt',
        payment_amount: 0,
        payment_method: 'manual_admin',
        payment_reference: `Exento marcado por admin: ${user.email}`,
        paid_at: new Date().toISOString(),
      }
    }

    // 🧾 Update entry
    const { data: entry, error } = await supabaseAdmin
      .from('entries')
      .update(updateData)
      .eq('id', entryId)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 💰 AUDITORÍA (solo si es paid)
    if (paymentStatus === 'paid') {
      await supabaseAdmin.from('payments').insert({
        entry_id: entryId,
        user_id: entry.user_id,
        provider: 'admin_manual',
        provider_payment_id: `manual_${Date.now()}`,
        status: 'approved',
        amount: ENTRY_PRICE,
        currency: 'MXN',
        payment_method: 'manual_admin',
      })
    }

    return NextResponse.json({
      success: true,
      entry,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}