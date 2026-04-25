'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase/supabase'
import { groupStageMatches, type Match } from '@/data/groupStageMatches'

type UserState = {
  id: string
  role: 'admin' | 'player'
  fullName?: string
  email?: string
} | null

type ViewMode =
  | 'dashboard'
  | 'picks'
  | 'leaderboard'
  | 'public'
  | 'public-by-participant'
  | 'entry-detail'
  | 'participant-data'
  | 'admin'

type Prediction = {
  homeScore: string
  awayScore: string
  isAutoZero?: boolean
}

type OfficialResult = {
  homeScore: string
  awayScore: string
}

type MatchState = {
  isOpen: boolean
  isFinished: boolean
}

type PublicMatchMetaRow = {
  id: string
  home_score: number | null
  away_score: number | null
  is_open: boolean | null
  is_finished: boolean | null
}

type LeaderboardRow = {
  entry_id?: string
  user_id: string
  entry_name?: string
  full_name: string
  total_points: number
  exact_hits: number
  outcome_hits: number
}
type EntryRow = {
  id: string
  name: string
  is_active: boolean
  payment_status?: PaymentStatus | null
  payment_amount?: number | null
  payment_method?: string | null
  payment_reference?: string | null
  paid_at?: string | null
}
type EntryDetailInfo = {
  id: string
  name: string
  user_id: string
  profiles?: {
    full_name?: string
    email?: string
  } | null
}

type EntryPredictionRow = {
  match_id: string
  home_score_predicted: number | null
  away_score_predicted: number | null
}
type PublicEntryRow = {
  id: string
  name: string
  user_id: string
  profiles?: {
    full_name?: string
    email?: string
  } | null
}

type DashboardCardProps = {
  title: string
  description: string
  badge?: string
  onClick?: () => void
}
type ParticipantProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  role: 'admin' | 'player' | null
}
type AdminUserRow = {
  id: string
  email: string | null
  full_name: string | null
  role: 'admin' | 'player' | null
}

type PaymentStatus = 'pending' | 'partial' | 'paid' | 'exempt'

type AdminPaymentEntryRow = {
  id: string
  name: string
  user_id: string
  payment_status: PaymentStatus | null
  payment_amount: number | null
  payment_method: string | null
  payment_reference: string | null
  paid_at: string | null
  profiles?: {
    full_name?: string | null
    email?: string | null
    phone?: string | null
  } | null
}

type PersonalRankInfo = {
  position: number | null
  total_points: number
  exact_hits: number
  outcome_hits: number
}

const MATCHES: Match[] = groupStageMatches
const PUBLIC_REVEAL_DATE = new Date('2026-06-11T10:00:00-06:00')
const ENTRY_PRICE = 2500
const ADMIN_FEE_PER_ENTRY = 200
const PRIZE_CONTRIBUTION_PER_ENTRY = 2300
const GUARANTEED_PRIZE_POOL = 375000
const PAYMENT_DEADLINE = new Date('2026-06-10T23:59:00-06:00')

function scrollToPageTop() {
  if (typeof window === 'undefined') return

  window.scrollTo({ top: 0, left: 0, behavior: 'instant' })

  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  })

  setTimeout(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, 0)
}

function useScrollToPageTop(deps: React.DependencyList = []) {
  useEffect(() => {
    scrollToPageTop()
  }, deps)
}

function getEmailUserName(email?: string | null) {
  return email?.split('@')[0]?.trim().toLowerCase() || ''
}

function resolveProfileFullName(profile: any, fallbackEmail?: string | null) {
  const fullName = profile?.full_name?.trim?.() || ''
  const firstName = profile?.first_name?.trim?.() || ''
  const lastName = profile?.last_name?.trim?.() || ''
  const combinedName = `${firstName} ${lastName}`.trim()
  const emailUserName = getEmailUserName(profile?.email || fallbackEmail)

  if (combinedName && fullName.toLowerCase() === emailUserName) {
    return combinedName
  }

  return fullName || combinedName || emailUserName || 'Jugador'
}

function getStoredProfile(userId: string) {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(`quiniela-profile-${userId}`)
    return raw ? (JSON.parse(raw) as Partial<ParticipantProfileRow>) : null
  } catch {
    return null
  }
}

function storeProfile(userId: string, profile: Partial<ParticipantProfileRow>) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(`quiniela-profile-${userId}`, JSON.stringify(profile))
  } catch {
    // noop
  }
}



function formatCurrencyMXN(amount: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(amount)
}

function getPaymentStatusLabel(status?: PaymentStatus | null) {
  if (status === 'paid') return 'Pagado'
  if (status === 'partial') return 'Parcial'
  if (status === 'exempt') return 'Exento'
  return 'Pendiente'
}

function getPaymentStatusClass(status?: PaymentStatus | null) {
  if (status === 'paid') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
  if (status === 'partial') return 'border-amber-400/20 bg-amber-400/10 text-amber-200'
  if (status === 'exempt') return 'border-sky-400/20 bg-sky-400/10 text-sky-200'
  return 'border-red-400/20 bg-red-400/10 text-red-200'
}

function PublicRevealLockedCard() {
  return (
    <div className="mt-8 overflow-hidden rounded-3xl border border-yellow-400/25 bg-gradient-to-br from-yellow-400/10 via-white/[0.03] to-transparent p-6 text-center shadow-[0_0_40px_rgba(250,204,21,0.10)] sm:p-8">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-yellow-400/30 bg-yellow-400/10 text-3xl shadow-[0_0_30px_rgba(250,204,21,0.18)]">
        🔒
      </div>

      <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-yellow-400 sm:text-3xl">
        Quinielas bloqueadas
      </h2>

      <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
        Para mantener la competencia justa, las quinielas de los demás participantes estarán ocultas hasta que cierre la captura de pronósticos.
      </p>

      <div className="mx-auto mt-6 max-w-md rounded-2xl border border-white/10 bg-black/30 px-5 py-4">
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
          Se desbloquea el
        </p>
        <p className="mt-2 text-lg font-bold text-white">
          11 de junio de 2026 · 10:00 AM (CDMX)
        </p>
      </div>
    </div>
  )
}

function DashboardCard({ title, description, badge, onClick }: DashboardCardProps) {
  return (
    <div className="flex h-full min-h-[230px] flex-col justify-between rounded-2xl border border-yellow-400/20 bg-white/5 p-4 shadow-xl transition hover:border-yellow-400/40 hover:bg-yellow-400/10 sm:min-h-[240px] md:min-h-[250px]">
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 text-xl font-bold tracking-tight text-yellow-400 md:text-2xl">
            {title}
          </h3>

          {badge && (
            <span className="shrink-0 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
              {badge}
            </span>
          )}
        </div>

        <p className="mt-3 text-sm leading-6 text-white/65">
          {description}
        </p>
      </div>

      <button
        onClick={onClick}
        className="mt-6 w-full rounded-xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-white/90 active:scale-[0.99]"
      >
        Abrir
      </button>
    </div>
  )
}

function parseKickoffToDate(kickoff: string) {
  const clean = kickoff.replace(' (Hora CDMX)', '')
  const [datePart, timePart] = clean.split(' · ')
  if (!datePart || !timePart) return null

  const [dayStr, monthStr, yearStr] = datePart.split(' ')
  const [hourStr, minuteStr] = timePart.split(':')

  const months: Record<string, number> = {
    ene: 0,
    feb: 1,
    mar: 2,
    abr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    ago: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dic: 11,
  }

  const day = Number(dayStr)
  const month = months[monthStr?.toLowerCase()]
  const year = Number(yearStr)
  const hour = Number(hourStr)
  const minute = Number(minuteStr)

  if (
    Number.isNaN(day) ||
    month === undefined ||
    Number.isNaN(year) ||
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    return null
  }

  return new Date(year, month, day, hour, minute)
}

function getTimeLock(kickoff: string) {
  const kickoffDate = parseKickoffToDate(kickoff)
  if (!kickoffDate) return false
  return new Date() >= kickoffDate
}

function getPickStatus(prediction: Prediction, official: OfficialResult) {
  if (
    prediction.homeScore === '' ||
    prediction.awayScore === '' ||
    official.homeScore === '' ||
    official.awayScore === ''
  ) {
    return null
  }

  const ph = Number(prediction.homeScore)
  const pa = Number(prediction.awayScore)
  const oh = Number(official.homeScore)
  const oa = Number(official.awayScore)

  const exact = ph === oh && pa === oa
  const predictedOutcome = ph > pa ? 'home' : ph < pa ? 'away' : 'draw'
  const officialOutcome = oh > oa ? 'home' : oh < oa ? 'away' : 'draw'

  if (exact) {
    return {
      label: '✅ Exacto',
      detail: '3 puntos',
      className: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
    }
  }

  if (predictedOutcome === officialOutcome) {
    return {
      label: '🟡 Acierto',
      detail: '1 punto',
      className: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
    }
  }

  return {
    label: '❌ Fallaste',
    detail: '0 puntos',
    className: 'border-red-400/20 bg-red-400/10 text-red-100',
  }
}

function LeaderboardScreen({
  onBack,
  currentUser,
}: {
  onBack: () => void
  currentUser: UserState
}) {
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [loading, setLoading] = useState(true)

  useScrollToPageTop([])

  useEffect(() => {
    let mounted = true

    const loadLeaderboard = async () => {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .order('total_points', { ascending: false })
        .order('exact_hits', { ascending: false })
        .order('outcome_hits', { ascending: false })

      if (!mounted) return

      if (error) {
        console.error('Error cargando leaderboard:', error.message)
        setRows([])
      } else {
        setRows((data as LeaderboardRow[]) ?? [])
      }

      setLoading(false)
    }

    loadLeaderboard()

    const channel = supabase
      .channel('leaderboard-refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, loadLeaderboard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, loadLeaderboard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, loadLeaderboard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, loadLeaderboard)
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [])

  const currentUserPosition =
    rows.findIndex((row) => row.user_id === currentUser?.id) + 1 || null

  const getRankIcon = (index: number) => {
    if (index === 0) return '🥇'
    if (index === 1) return '🥈'
    if (index === 2) return '🥉'
    return `#${index + 1}`
  }

  const leader = rows[0]

  return (
    <main className="min-h-screen overflow-x-hidden bg-black px-4 py-6 text-white sm:px-6 md:px-10 md:py-8">
      <div className="mx-auto w-full max-w-7xl">
        <button
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white shadow-lg backdrop-blur transition hover:bg-white/20 active:scale-[0.98]"
        >
          ← Volver
        </button>

        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.03] p-5 shadow-2xl sm:p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                Ranking general
              </p>

              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-yellow-400 sm:text-4xl md:text-5xl">
                Tabla General
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65 md:text-base">
                Posiciones por quiniela, puntos acumulados, marcadores exactos y aciertos.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">
                  Quinielas
                </p>
                <p className="mt-2 text-2xl font-bold text-white">{rows.length}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">
                  Tu posición
                </p>
                <p className="mt-2 text-2xl font-bold text-yellow-400">
                  {currentUserPosition ? `#${currentUserPosition}` : '—'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {leader && (
          <section className="mt-5 rounded-3xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 via-transparent to-yellow-500/5 p-5 shadow-[0_0_40px_rgba(250,204,21,0.12)] sm:p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-yellow-400/40 bg-yellow-400/10 text-3xl shadow-[0_0_25px_rgba(250,204,21,0.25)] sm:h-16 sm:w-16">
                  🥇
                </div>

                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-yellow-300/70">
                    Líder actual
                  </p>
                  <h2 className="mt-1 truncate text-xl font-bold text-white sm:text-2xl">
                    {leader.full_name || 'Participante'}
                  </h2>
                  <p className="truncate text-sm font-semibold text-yellow-300">
                    {leader.entry_name || 'Quiniela'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3 md:min-w-[360px]">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-3 sm:p-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                    Puntos
                  </p>
                  <p className="mt-2 text-xl font-bold text-yellow-400 sm:text-2xl">
                    {leader.total_points}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-3 sm:p-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                    Exactos
                  </p>
                  <p className="mt-2 text-xl font-bold text-white sm:text-2xl">
                    {leader.exact_hits}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-3 sm:p-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                    Aciertos
                  </p>
                  <p className="mt-2 text-xl font-bold text-white sm:text-2xl">
                    {leader.outcome_hits}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="mt-6">
          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
              Cargando leaderboard...
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-lg font-semibold">Todavía no hay puntos calculados</p>
              <p className="mt-2 text-sm leading-6 text-white/65">
                En cuanto captures resultados oficiales y existan picks guardados, aparecerán aquí.
              </p>
            </div>
          ) : (
            <>
              {/* MOBILE CARDS */}
              <div className="space-y-3 md:hidden">
                {rows.map((row, index) => {
                  const isCurrentUser = row.user_id === currentUser?.id

                  return (
                    <article
                      key={row.entry_id ?? `${row.user_id}-${index}`}
                      className={`rounded-3xl border p-4 shadow-xl transition duration-200 active:scale-[0.99] ${
                        isCurrentUser
                          ? 'border-emerald-400/30 bg-emerald-400/10'
                          : 'border-white/10 bg-white/5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-3">
                          <div
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-lg font-black ${
                              index <= 2
                                ? 'border-yellow-400/30 bg-yellow-400/10 text-2xl'
                                : 'border-white/10 bg-black/30 text-yellow-400'
                            }`}
                          >
                            {getRankIcon(index)}
                          </div>

                          <div className="min-w-0">
                            <h3 className="truncate text-base font-bold text-white">
                              {row.full_name || 'Participante'}
                            </h3>

                            <p className="mt-1 truncate text-sm text-yellow-300">
                              {row.entry_name || 'Quiniela'}
                            </p>

                            {isCurrentUser && (
                              <span className="mt-3 inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                                Tú
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                            Puntos
                          </p>
                          <p className="mt-1 text-3xl font-black text-yellow-400">
                            {row.total_points}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                            Exactos
                          </p>
                          <p className="mt-1 text-xl font-bold text-white">
                            {row.exact_hits}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                            Aciertos
                          </p>
                          <p className="mt-1 text-xl font-bold text-white">
                            {row.outcome_hits}
                          </p>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>

              {/* DESKTOP TABLE */}
              <div className="hidden overflow-hidden rounded-3xl border border-white/10 bg-white/5 md:block">
                <div className="grid grid-cols-[90px_1.2fr_1.2fr_150px_150px_120px] border-b border-yellow-500/20 bg-yellow-500/5 px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-yellow-400">
                  <div>Posición</div>
                  <div>Jugador</div>
                  <div>Quiniela</div>
                  <div className="text-center">Puntos</div>
                  <div className="text-center">Exactos</div>
                  <div className="text-center">Aciertos</div>
                </div>

                {rows.map((row, index) => {
                  const isCurrentUser = row.user_id === currentUser?.id

                  return (
                    <div
                      key={row.entry_id ?? `${row.user_id}-${index}`}
                      className={`grid grid-cols-[90px_1.2fr_1.2fr_150px_150px_120px] items-center border-b border-white/10 px-6 py-4 text-sm transition duration-200 last:border-b-0 hover:bg-white/[0.06] ${
                        isCurrentUser ? 'bg-emerald-400/10' : 'bg-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-center text-xl font-bold text-yellow-400">
                        {getRankIcon(index)}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">
                          {row.full_name || 'Participante'}
                        </p>
                        <p className="text-xs text-white/45">
                          {isCurrentUser ? 'Tu usuario actual' : 'Jugador'}
                        </p>
                      </div>

                      <div className="truncate font-semibold text-white">
                        {row.entry_name || 'Quiniela'}
                      </div>

                      <div className="text-center text-lg font-black text-yellow-400">
                        {row.total_points}
                      </div>

                      <div className="text-center font-semibold text-white/80">
                        {row.exact_hits}
                      </div>

                      <div className="text-center font-semibold text-white/80">
                        {row.outcome_hits}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  )
}

function PicksScreen({
  activeEntryId,
  activeEntryPaymentStatus,
  predictions,
  setPredictions,
  onBack,
  user,
}: {
  activeEntryId: string | null
  activeEntryPaymentStatus?: PaymentStatus | null
  predictions: Record<string, Prediction>
  setPredictions: React.Dispatch<React.SetStateAction<Record<string, Prediction>>>
  onBack: () => void
  user: UserState
}) {
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  const [autoSaving, setAutoSaving] = useState(false)
const autoSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
const didUserEditRef = useRef(false)
  const [officialResults, setOfficialResults] = useState<Record<string, OfficialResult>>({})
  const [matchStates, setMatchStates] = useState<Record<string, MatchState>>({})
  const autoZeroAppliedRef = useRef<string | null>(null)

  useScrollToPageTop([])

  const [timeLeft, setTimeLeft] = useState<{
  text: string
  level: 'normal' | 'warning' | 'danger'
}>({
  text: '',
  level: 'normal',
})

  useEffect(() => {
    let mounted = true

    const loadPredictions = async () => {
      if (!activeEntryId) {
        setPredictions({})
        return
      }

      const { data, error } = await supabase
        .from('predictions')
        .select('*')
        .eq('entry_id', activeEntryId)

      if (!mounted) return
      if (error) {
        console.error('Error cargando picks:', error.message)
        return
      }

      const formatted: Record<string, Prediction> = {}
      data?.forEach((row) => {
        formatted[row.match_id] = {
          homeScore:
            row.home_score_predicted == null ? '' : String(row.home_score_predicted),
          awayScore:
            row.away_score_predicted == null ? '' : String(row.away_score_predicted),
          isAutoZero: Boolean(row.is_auto_zero),
        }
      })

      const lockDate = new Date('2026-06-11T10:00:00-06:00')
      const isPastDeadline = new Date() >= lockDate
      const shouldAutoFillMissing =
        isPastDeadline && activeEntryId && autoZeroAppliedRef.current !== activeEntryId

      if (shouldAutoFillMissing) {
        const missingRows = MATCHES
          .filter((match) => {
            const prediction = formatted[match.id]
            return !prediction || prediction.homeScore === '' || prediction.awayScore === ''
          })
          .map((match) => ({
            entry_id: activeEntryId,
            match_id: match.id,
            home_score_predicted: 0,
            away_score_predicted: 0,
            is_auto_zero: true,
          }))

        if (missingRows.length > 0) {
          const { error: autoZeroError } = await supabase
            .from('predictions')
            .upsert(missingRows, { onConflict: 'entry_id,match_id' })

          if (autoZeroError) {
            console.error('Error aplicando ceros automáticos:', autoZeroError.message)
          } else {
            missingRows.forEach((row) => {
              formatted[row.match_id] = {
                homeScore: '0',
                awayScore: '0',
                isAutoZero: true,
              }
            })
          }
        }

        autoZeroAppliedRef.current = activeEntryId
      }

      setPredictions(formatted)
    }

    const loadMatchesMeta = async () => {
      const ids = MATCHES.map((m) => m.id)

      const { data, error } = await supabase
        .from('matches')
        .select('id, home_score, away_score, is_open, is_finished')
        .in('id', ids)

      if (!mounted) return
      if (error) {
        console.error('Error cargando metadata de matches:', error.message)
        return
      }

      const officialMap: Record<string, OfficialResult> = {}
      const stateMap: Record<string, MatchState> = {}

      data?.forEach((row) => {
        officialMap[row.id] = {
          homeScore: row.home_score == null ? '' : String(row.home_score),
          awayScore: row.away_score == null ? '' : String(row.away_score),
        }

        stateMap[row.id] = {
          isOpen: row.is_open ?? true,
          isFinished: row.is_finished ?? false,
        }
      })

      setOfficialResults(officialMap)
      setMatchStates(stateMap)
    }

    loadPredictions()
    loadMatchesMeta()

    const channel = supabase
      .channel('picks-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        loadMatchesMeta
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'predictions' },
        loadPredictions
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [activeEntryId, setPredictions])

  useEffect(() => {
  const targetDate = new Date('2026-06-11T10:00:00-06:00')

  const updateCountdown = () => {
    const now = new Date()
    const diff = targetDate.getTime() - now.getTime()

    if (diff <= 0) {
      setTimeLeft({
  text: 'Cerrado',
  level: 'danger',
})
      return
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
    const minutes = Math.floor((diff / (1000 * 60)) % 60)
    const seconds = Math.floor((diff / 1000) % 60)
const totalHoursLeft = diff / (1000 * 60 * 60)

let level: 'normal' | 'warning' | 'danger' = 'normal'

if (totalHoursLeft <= 3) {
  level = 'danger'
} else if (totalHoursLeft <= 24) {
  level = 'warning'
}

setTimeLeft({
  text: `${days}d ${hours}h ${minutes}m ${seconds}s`,
  level,
})
  }

  updateCountdown()
  const interval = setInterval(updateCountdown, 1000)

  return () => clearInterval(interval)
}, [])

  const groupedMatches = useMemo(() => {
  const grouped = MATCHES.reduce<Record<string, Match[]>>((acc, match) => {
    if (!acc[match.group]) acc[match.group] = []
    acc[match.group].push(match)
    return acc
  }, {})

  return Object.fromEntries(
    Object.entries(grouped).sort(([groupA], [groupB]) =>
      groupA.localeCompare(groupB, 'es', { sensitivity: 'base' })
    )
  )
}, [])

  const totalCompleted = Object.values(predictions).filter(
    (item) => item.homeScore !== '' && item.awayScore !== ''
  ).length
const totalMatches = MATCHES.length
const totalPending = totalMatches - totalCompleted
const isComplete = totalPending === 0
const globalDeadline = new Date('2026-06-11T10:00:00-06:00')
const isGlobalLock = new Date() >= globalDeadline

  const handleChange = (
    matchId: string,
    side: 'homeScore' | 'awayScore',
    value: string
  ) => {
    if (value !== '' && !/^\d+$/.test(value)) return

    didUserEditRef.current = true

    setPredictions((prev) => ({
      ...prev,
      [matchId]: {
        homeScore: side === 'homeScore' ? value : prev[matchId]?.homeScore ?? '',
        awayScore: side === 'awayScore' ? value : prev[matchId]?.awayScore ?? '',
        isAutoZero: false,
      },
    }))
  }

  const handleSave = async () => {
  setSaveMessage('')
  setSaveError('')

  if (!activeEntryId) {
    setSaveError('No hay una quiniela activa.')
    return
  }

  setSaving(true)

  try {
    const rows = Object.entries(predictions)
      .filter(([, p]) => p.homeScore !== '' && p.awayScore !== '')
      .map(([matchId, p]) => ({
        entry_id: activeEntryId,
        match_id: matchId,
        home_score_predicted: Number(p.homeScore),
        away_score_predicted: Number(p.awayScore),
        is_auto_zero: false,
      }))

    if (rows.length === 0) {
      setSaveError('No hay pronósticos para guardar.')
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('predictions')
      .upsert(rows, { onConflict: 'entry_id,match_id' })

    if (error) {
      setSaveError(`Error al guardar: ${error.message}`)
      return
    }

    didUserEditRef.current = false
    setSaveMessage('Pronósticos guardados correctamente ✅')

    setTimeout(() => {
      setSaveMessage('')
    }, 3000)
  } catch (err) {
    console.error(err)
    setSaveError('Error inesperado al guardar.')
  } finally {
    setSaving(false)
  }
}
const handleAutoSave = async () => {
  if (!activeEntryId || isGlobalLock) return

  try {
    setAutoSaving(true)
    setSaveError('')

    const rows = Object.entries(predictions)
      .filter(([, p]) => p.homeScore !== '' && p.awayScore !== '')
      .map(([matchId, p]) => ({
        entry_id: activeEntryId,
        match_id: matchId,
        home_score_predicted: Number(p.homeScore),
        away_score_predicted: Number(p.awayScore),
        is_auto_zero: false,
      }))

    if (rows.length === 0) return

    const { error } = await supabase
      .from('predictions')
      .upsert(rows, { onConflict: 'entry_id,match_id' })

    if (error) {
      setSaveError(`Error en guardado automático: ${error.message}`)
      return
    }

    didUserEditRef.current = false
    setSaveMessage('✓ Guardado')

    setTimeout(() => {
      setSaveMessage('')
    }, 1500)
  } catch (err) {
    console.error('Auto-save error:', err)
    setSaveError('Error inesperado en guardado automático.')
  } finally {
    setAutoSaving(false)
  }
}

useEffect(() => {
  if (!activeEntryId || isGlobalLock || !didUserEditRef.current) return

  const hasAnyCompletePrediction = Object.values(predictions).some(
    (prediction) => prediction.homeScore !== '' && prediction.awayScore !== ''
  )

  if (!hasAnyCompletePrediction) return

  if (autoSaveTimeout.current) {
    clearTimeout(autoSaveTimeout.current)
  }

  autoSaveTimeout.current = setTimeout(() => {
    handleAutoSave()
  }, 1200)

  return () => {
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current)
    }
  }
}, [predictions, activeEntryId, isGlobalLock])

  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <button
              onClick={onBack}
              className="mb-6 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white shadow-lg backdrop-blur transition hover:bg-white/20 active:scale-[0.98]"
            >
              ← Volver a Menu Principal
            </button>

            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
              Fase de grupos
            </h1>
           <p className="mt-3 max-w-none text-sm leading-6 text-white/70 md:text-base">
  A continuación ingresa tu pronóstico de marcador para cada uno de los partidos. 
  Mucha suerte. Tus cambios se guardan automáticamente.
</p>

<div className="mt-4 max-w-none rounded-2xl border border-red-400/20 bg-red-400/10 p-4">
  <p className="text-sm leading-6 font-semibold text-red-300">
    ⚠️ Te recuerdo que tienes hasta 2 horas antes de que empiece el partido inaugural.
  </p>
  <p className="mt-2 text-sm leading-6 font-bold text-red-400 underline">
    Después de esta hora, todos los marcadores que no hayas metido automáticamente se tendrán por “0”.
  </p>
</div>
          </div>

          <div className="grid min-w-[320px] gap-3">
  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
    <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
      Progreso de captura
    </p>
    <p className="mt-2 text-2xl font-bold text-white">
      {totalCompleted} de {totalMatches}
    </p>
    <p className="mt-1 text-sm text-white/55">
      partidos guardados
    </p>
  </div>

  <div
    className={`rounded-2xl border p-4 text-sm font-semibold ${
      isComplete
        ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
        : 'border-red-400/20 bg-red-400/10 text-red-200'
    }`}
  >
    {isComplete
      ? '✅ Ya capturaste todos tus pronósticos.'
      : `⚠️ Te faltan ${totalPending} partidos por capturar.`}
  </div>
</div>
        </div>

<div className="mt-6 rounded-3xl border border-yellow-400/30 bg-yellow-400/10 p-5 text-center shadow-[0_0_30px_rgba(250,204,21,0.12)]">
  <p className="text-xs font-bold uppercase tracking-[0.22em] text-yellow-300">
    Pago de quiniela
  </p>

  <h2 className="mt-2 text-2xl font-black text-white md:text-3xl">
    Costo: {formatCurrencyMXN(ENTRY_PRICE)}
  </h2>

  <p className="mt-2 text-sm text-white/65">
    De este monto, {formatCurrencyMXN(PRIZE_CONTRIBUTION_PER_ENTRY)} integran la bolsa y {formatCurrencyMXN(ADMIN_FEE_PER_ENTRY)} son gastos de administración.
  </p>

  {activeEntryPaymentStatus === 'paid' || activeEntryPaymentStatus === 'exempt' ? (
  <div
    className={`mt-5 w-full rounded-2xl border px-6 py-5 text-center shadow-[0_0_28px_rgba(16,185,129,0.16)] ${
      activeEntryPaymentStatus === 'paid'
        ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
        : 'border-sky-400/25 bg-sky-400/10 text-sky-100'
    }`}
  >
    <p className="text-lg font-black md:text-xl">
      {activeEntryPaymentStatus === 'paid' ? '✅ Quiniela pagada' : '🛡️ Quiniela exenta'}
    </p>
    <p className="mt-2 text-sm opacity-80">
      {activeEntryPaymentStatus === 'paid'
        ? 'Tu pago quedó registrado correctamente.'
        : 'Esta quiniela fue marcada como exenta por administración.'}
    </p>
  </div>
) : (
  <button
    type="button"
    onClick={async () => {
      if (!activeEntryId) {
        alert('No se pudo identificar tu quiniela activa.')
        return
      }

      try {
        const res = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entryId: activeEntryId,
            userEmail: user?.email,
          }),
        })

        let data: any = {}

        try {
          data = await res.json()
        } catch {
          data = {}
        }

        if (!res.ok || !data.url) {
          alert(
            data.error ||
              data.message ||
              `Error iniciando el pago. Código: ${res.status}`
          )
          return
        }

        window.location.href = data.url
      } catch (error) {
        console.error('Error iniciando el pago:', error)
        alert('Error iniciando el pago. Revisa la terminal del servidor.')
      }
    }}
    className="mt-5 w-full rounded-2xl bg-gradient-to-r from-yellow-400 to-yellow-600 px-6 py-4 text-base font-black text-black shadow-[0_0_28px_rgba(250,204,21,0.22)] transition hover:scale-[1.01] active:scale-[0.99] md:text-lg"
  >
    💳 Pagar mi quiniela
  </button>
)}
</div>

<div className="mt-6 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.03] p-6 shadow-2xl text-center">
  <p className="text-xs uppercase tracking-[0.22em] text-white/45">
    Cierre de pronósticos
  </p>

  <h2
  className={`mt-2 text-3xl md:text-4xl font-bold ${
    timeLeft.level === 'danger'
      ? 'text-red-500 animate-pulse'
      : timeLeft.level === 'warning'
      ? 'text-amber-400'
      : 'text-white'
  }`}
>
  {timeLeft.text}
</h2>

  <p className="mt-2 text-sm text-white/60">
    11 de junio 2026 · 10:00 AM (CDMX)
  </p>
  {isGlobalLock && (
  <>
    <p className="mt-3 text-sm font-bold text-red-400 underline">
      La captura de pronósticos ya está cerrada. Todos los marcadores no ingresados se tomarán como “0”.
    </p>
    <p className="mt-2 text-xs font-semibold text-red-300">
      Los ceros automáticos aparecerán en rojo para distinguirlos de los ceros capturados manualmente.
    </p>
  </>
)}
</div>
        <div className="mt-8 space-y-8">
          {Object.entries(groupedMatches).map(([groupName, matches]) => (
            <section key={groupName}>
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
  {groupName}
</h2>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/60">
                  {matches.length} partidos
                </span>
              </div>

              <div className="space-y-4">
                {matches.map((match) => {
                  const current = predictions[match.id] ?? {
                    homeScore: '',
                    awayScore: '',
                  }

                  const official = officialResults[match.id] ?? {
                    homeScore: '',
                    awayScore: '',
                  }

                  const state = matchStates[match.id] ?? {
                    isOpen: true,
                    isFinished: false,
                  }

                  const hasOfficialResult =
                    official.homeScore !== '' && official.awayScore !== ''

                  const locked = isGlobalLock || getTimeLock(match.kickoff) || !state.isOpen
                  const status = getPickStatus(current, official)

                  return (
                    <div
                      key={match.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg transition hover:bg-white/[0.06] hover:border-yellow-400/20"
  >
                
                      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
                        <div className="min-w-0 flex flex-col justify-center">
                          <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                            {match.kickoff}
                          </p>

                          <div className="mt-4 grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
                            <div className="flex items-center justify-center gap-4">
  <div className="overflow-hidden rounded-xl border border-white/10 bg-white/10">
    <Image
      src={match.homeFlagUrl}
      alt={match.homeTeam}
      width={56}
      height={40}
      className="h-8 w-10 object-cover sm:h-10 sm:w-14"
    />
  </div>
  <div className="text-left">
    <div className="text-xs uppercase tracking-[0.2em] text-white/40">
      {match.homeCode}
    </div>
    <span className="text-lg sm:text-2xl font-bold tracking-tight">{match.homeTeam}</span>
  </div>
</div>

                            <div className="flex items-center justify-center">
  <div className="text-sm uppercase tracking-[0.3em] text-white/35">
    VS
  </div>
</div>

                            <div className="flex items-center justify-center gap-4">
  <div className="overflow-hidden rounded-xl border border-white/10 bg-white/10">
    <Image
      src={match.awayFlagUrl}
      alt={match.awayTeam}
      width={56}
      height={40}
      className="h-10 w-14 object-cover"
    />
  </div>

  <div className="text-left">
    <div className="text-xs uppercase tracking-[0.2em] text-white/40">
      {match.awayCode}
    </div>
    <span className="text-lg sm:text-2xl font-bold tracking-tight">
      {match.awayTeam}
    </span>
  </div>
</div>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-3">
                           {locked && (
  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-400">
    🔒 {isGlobalLock ? 'Captura cerrada' : 'Partido cerrado'}
  </p>
)}

                            {!state.isOpen && (
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
                                Bloqueado por admin
                              </p>
                            )}

                            {hasOfficialResult && (
                              <div className="inline-flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100">
                                <span className="font-semibold">Resultado oficial:</span>
                                <span>
                                  {official.homeScore} - {official.awayScore}
                                </span>
                              </div>
                            )}

                            {status && (
                              <div
                                className={`inline-flex items-center gap-3 rounded-2xl border px-4 py-2 text-sm ${status.className}`}
                              >
                                <span className="font-semibold">{status.label}</span>
                                <span>{status.detail}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-white/45 text-center pr-2">
                            Tu pronóstico
                          </p>

                          <div className="flex items-center justify-center gap-3">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={current.homeScore}
                              placeholder=""
                              disabled={locked}
                              onChange={(e) =>
                                handleChange(match.id, 'homeScore', e.target.value)
                              }
                              className={`h-12 w-14 rounded-2xl border bg-white/10 text-center text-xl font-bold outline-none transition focus:border-yellow-400/40 focus:bg-white/15 disabled:cursor-not-allowed disabled:opacity-100 sm:h-14 sm:w-16 ${
                                current.isAutoZero
                                  ? 'border-red-400/40 text-red-300 shadow-[0_0_18px_rgba(248,113,113,0.16)]'
                                  : 'border-white/10 text-white'
                              }`}
                            />

                            <span className="text-lg font-semibold text-white/50">-</span>

                            <input
                              type="text"
                              inputMode="numeric"
                              value={current.awayScore}
                              placeholder=""
                              disabled={locked}
                              onChange={(e) =>
                                handleChange(match.id, 'awayScore', e.target.value)
                              }
                              className={`h-12 w-14 rounded-2xl border bg-white/10 text-center text-xl font-bold outline-none transition focus:border-yellow-400/40 focus:bg-white/15 disabled:cursor-not-allowed disabled:opacity-100 sm:h-14 sm:w-16 ${
                                current.isAutoZero
                                  ? 'border-red-400/40 text-red-300 shadow-[0_0_18px_rgba(248,113,113,0.16)]'
                                  : 'border-white/10 text-white'
                              }`}
                            />
                          </div>

                          {current.isAutoZero && (
                            <p className="mt-3 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-red-300">
                              0 automático
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

                <div className="mt-6 flex justify-end">
  <div className="w-[250px]">
    {saveMessage && (
  <div className="mb-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-center text-sm font-semibold text-emerald-200">
    {saveMessage}
  </div>
)}

{saveError && (
  <div className="mb-3 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-center text-sm font-semibold text-red-200">
    {saveError}
  </div>
)}

{autoSaving && (
  <div className="mb-3 flex items-center justify-center gap-2 text-xs text-white/50 animate-pulse">
    <div className="h-2 w-2 rounded-full bg-yellow-400" />
    Guardando...
  </div>
)}
<p className="text-center text-xs text-white/40">
  Tus cambios se guardan automáticamente
</p>
  </div>
</div>
              </div>

<div className="mt-6 flex justify-end">
  <button
    type="button"
    onClick={onBack}
    className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white shadow-lg backdrop-blur transition hover:bg-white/20 active:scale-[0.98]"
  >
    ← Volver al menú principal
  </button>
</div>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}

function AdminScreen({ onBack }: { onBack: () => void }) {
  const [results, setResults] = useState<Record<string, OfficialResult>>({})
  const [matchStates, setMatchStates] = useState<Record<string, MatchState>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [paymentEntries, setPaymentEntries] = useState<AdminPaymentEntryRow[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(true)
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null)

  useScrollToPageTop([])

useEffect(() => {
    let mounted = true

    const loadMatchesMeta = async () => {
      const ids = MATCHES.map((m) => m.id)

      const { data, error } = await supabase
        .from('matches')
        .select('id, home_score, away_score, is_open, is_finished')
        .in('id', ids)

      if (!mounted) return
      if (error) {
        console.error('Error cargando resultados:', error.message)
        return
      }

      const resultMap: Record<string, OfficialResult> = {}
      const stateMap: Record<string, MatchState> = {}

      data?.forEach((row) => {
        resultMap[row.id] = {
          homeScore:
            row.home_score == null ? '' : String(row.home_score),
          awayScore:
            row.away_score == null ? '' : String(row.away_score),
        }

        stateMap[row.id] = {
          isOpen: row.is_open ?? true,
          isFinished: row.is_finished ?? false,
        }
      })

      setResults(resultMap)
      setMatchStates(stateMap)
    }

    const loadUsers = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .order('full_name', { ascending: true })

      if (!mounted) return

      if (error) {
        console.error('Error cargando usuarios admin:', error.message)
        setUsers([])
        setUsersLoading(false)
        return
      }

      setUsers((data as AdminUserRow[]) ?? [])
      setUsersLoading(false)
    }

    const loadPaymentEntries = async () => {
      const { data, error } = await supabase
        .from('entries')
        .select(`
          id,
          name,
          user_id,
          payment_status,
          payment_amount,
          payment_method,
          payment_reference,
          paid_at,
          profiles (
            full_name,
            email,
            phone
          )
        `)
        .order('user_id', { ascending: true })
        .order('name', { ascending: true })

      if (!mounted) return

      if (error) {
        console.error('Error cargando pagos:', error.message)
        setPaymentEntries([])
        setPaymentsLoading(false)
        return
      }

      setPaymentEntries(((data ?? []) as AdminPaymentEntryRow[]).sort((a, b) => {
        const nameA = a.profiles?.full_name || a.profiles?.email || 'Participante'
        const nameB = b.profiles?.full_name || b.profiles?.email || 'Participante'
        const byName = nameA.localeCompare(nameB, 'es', { sensitivity: 'base' })
        if (byName !== 0) return byName
        return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
      }))
      setPaymentsLoading(false)
    }

    loadMatchesMeta()
    loadUsers()
    loadPaymentEntries()

    const channel = supabase
      .channel('admin-matches-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        loadMatchesMeta
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          loadUsers()
          loadPaymentEntries()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entries' },
        loadPaymentEntries
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [])

  const groupedMatches = useMemo(() => {
    const grouped = MATCHES.reduce<Record<string, Match[]>>((acc, match) => {
      if (!acc[match.group]) acc[match.group] = []
      acc[match.group].push(match)
      return acc
    }, {})

    return Object.fromEntries(
      Object.entries(grouped).sort(([groupA], [groupB]) =>
        groupA.localeCompare(groupB, 'es', { sensitivity: 'base' })
      )
    )
  }, [])

  const updateResult = (
    matchId: string,
    side: 'homeScore' | 'awayScore',
    value: string
  ) => {
    if (value !== '' && !/^\d+$/.test(value)) return

    setResults((prev) => ({
      ...prev,
      [matchId]: {
        homeScore: side === 'homeScore' ? value : prev[matchId]?.homeScore ?? '',
        awayScore: side === 'awayScore' ? value : prev[matchId]?.awayScore ?? '',
      },
    }))
  }

  const toggleMatchOpen = async (matchId: string, currentOpen: boolean) => {
    const nextOpen = !currentOpen

    const { error } = await supabase
      .from('matches')
      .update({ is_open: nextOpen })
      .eq('id', matchId)

    if (error) {
      alert(`Error al cambiar estado del partido: ${error.message}`)
      return
    }

    setMatchStates((prev) => ({
      ...prev,
      [matchId]: {
        isOpen: nextOpen,
        isFinished: prev[matchId]?.isFinished ?? false,
      },
    }))
  }

  const saveOfficialResult = async (matchId: string) => {
    const current = results[matchId]

    const saveOfficialResult = async (matchId: string) => {
  const current = results[matchId]

  setSavingId(matchId)

  const homeScore =
    current?.homeScore === '' ? null : Number(current?.homeScore)

  const awayScore =
    current?.awayScore === '' ? null : Number(current?.awayScore)

  const isFinished =
    homeScore !== null && awayScore !== null

  const { error } = await supabase
    .from('matches')
    .update({
      home_score: homeScore,
      away_score: awayScore,
      is_finished: isFinished,
      is_open: !isFinished,
    })
    .eq('id', matchId)

  setSavingId(null)

  if (error) {
    alert(`Error al guardar resultado oficial: ${error.message}`)
  } else {
    setMatchStates((prev) => ({
      ...prev,
      [matchId]: {
        isOpen: !isFinished,
        isFinished,
      },
    }))

    alert('Resultado actualizado ✅')
  }
}

    setSavingId(matchId)

    const { error } = await supabase
      .from('matches')
      .update({
        home_score: Number(current.homeScore),
        away_score: Number(current.awayScore),
        is_finished: true,
        is_open: false,
      })
      .eq('id', matchId)

    setSavingId(null)

    if (error) {
      alert(`Error al guardar resultado oficial: ${error.message}`)
    } else {
      setMatchStates((prev) => ({
        ...prev,
        [matchId]: {
          isOpen: false,
          isFinished: true,
        },
      }))
      alert('Resultado oficial guardado ✅')
    }
  }

  const handleDeleteUser = async (targetUser: AdminUserRow) => {
    const label = targetUser.full_name || targetUser.email || 'este participante'

    const confirmed = window.confirm(
      `¿Seguro que quieres borrar a ${label}? Esto eliminará también sus quinielas y picks.`
    )

    if (!confirmed) return

    setDeletingUserId(targetUser.id)

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', targetUser.id)

    setDeletingUserId(null)

    if (error) {
      alert(`No se pudo borrar el usuario: ${error.message}`)
      return
    }

    setUsers((prev) => prev.filter((u) => u.id !== targetUser.id))
    alert('Participante eliminado correctamente ✅')
  }


  const paymentSummary = useMemo(() => {
    const totalEntries = paymentEntries.length
    const paidEntries = paymentEntries.filter((entry) => entry.payment_status === 'paid').length
    const partialEntries = paymentEntries.filter((entry) => entry.payment_status === 'partial').length
    const exemptEntries = paymentEntries.filter((entry) => entry.payment_status === 'exempt').length
    const pendingEntries = totalEntries - paidEntries - partialEntries - exemptEntries
    const totalCollected = paymentEntries.reduce(
      (sum, entry) => sum + Number(entry.payment_amount ?? 0),
      0
    )
    const adminFees = paidEntries * ADMIN_FEE_PER_ENTRY
    const prizeContribution = paidEntries * PRIZE_CONTRIBUTION_PER_ENTRY
    const prizePool = Math.max(GUARANTEED_PRIZE_POOL, prizeContribution)

    return {
      totalEntries,
      paidEntries,
      partialEntries,
      exemptEntries,
      pendingEntries,
      totalCollected,
      adminFees,
      prizeContribution,
      prizePool,
    }
  }, [paymentEntries])

  const updateEntryPayment = async (
    entryId: string,
    updates: Partial<AdminPaymentEntryRow>
  ) => {
    setUpdatingPaymentId(entryId)

    const { error } = await supabase
      .from('entries')
      .update(updates)
      .eq('id', entryId)

    setUpdatingPaymentId(null)

    if (error) {
      alert(`No se pudo actualizar el pago: ${error.message}`)
      return
    }

    setPaymentEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              ...updates,
            }
          : entry
      )
    )
  }

  const markEntryAsPaid = async (entryId: string) => {
    await updateEntryPayment(entryId, {
      payment_status: 'paid',
      payment_amount: ENTRY_PRICE,
      payment_method: 'manual',
      payment_reference: 'Marcado manualmente por admin',
      paid_at: new Date().toISOString(),
    })
  }

  const markEntryAsPending = async (entryId: string) => {
    await updateEntryPayment(entryId, {
      payment_status: 'pending',
      payment_amount: 0,
      payment_method: null,
      payment_reference: null,
      paid_at: null,
    })
  }

  const markEntryAsExempt = async (entryId: string) => {
    await updateEntryPayment(entryId, {
      payment_status: 'exempt',
      payment_amount: 0,
      payment_method: 'manual',
      payment_reference: 'Exento marcado por admin',
      paid_at: new Date().toISOString(),
    })
  }

  const scrollToAdminSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (!element) return

    element.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  return (
    <main id="admin-top" className="min-h-screen bg-black px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <button
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white shadow-lg backdrop-blur transition hover:bg-white/20 active:scale-[0.98]"
        >
          ← Volver a Menu Principal
        </button>

        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.03] p-6 shadow-2xl md:p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/70">
            <span>🛠️</span>
            <span>Panel admin</span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            Resultados oficiales
          </h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-white/70 md:text-base">
            Captura resultados oficiales y controla apertura/cierre de picks.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => scrollToAdminSection('admin-payments')}
            className="rounded-2xl border border-yellow-400/25 bg-yellow-400/10 px-5 py-4 text-sm font-black text-yellow-100 shadow-lg transition hover:bg-yellow-400/15 active:scale-[0.98]"
          >
            💰 Ir a Bolsa + pagos
          </button>

          <button
            type="button"
            onClick={() => scrollToAdminSection('admin-users')}
            className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-sm font-black text-white shadow-lg transition hover:bg-white/15 active:scale-[0.98]"
          >
            👥 Ir a Usuarios registrados
          </button>
        </div>

        <div className="mt-8 space-y-8">
          {Object.entries(groupedMatches).map(([groupName, matches]) => (
            <section key={groupName}>
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-2xl font-semibold">{groupName}</h2>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/60">
                  {matches.length} partidos
                </span>
              </div>
              <div className="mt-6 flex justify-end">
  <button
    onClick={onBack}
    className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white shadow-lg backdrop-blur transition hover:bg-white/20 active:scale-[0.98]"
  >
    ← Volver a menú principal
  </button>
</div>

              <div className="space-y-4">
                {matches.map((match) => {
                  const current = results[match.id] ?? {
                    homeScore: '',
                    awayScore: '',
                  }

                  const state = matchStates[match.id] ?? {
                    isOpen: true,
                    isFinished: false,
                  }

                  return (
                    <div
                      key={match.id}
                      className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl transition hover:bg-white/[0.07] hover:border-white/20"
                    >
                      <div className="flex flex-col gap-5">
                        <div className="min-w-0 flex flex-col justify-center">
                          <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                            {match.kickoff}
                          </p>

                          <div className="mt-4 mx-auto grid w-full max-w-4xl grid-cols-[minmax(260px,1fr)_120px_minmax(260px,1fr)] items-center gap-6">
                            <div className="flex items-center gap-3">
                              <div className="overflow-hidden rounded-xl border border-white/10 bg-white/10">
                                <Image
                                  src={match.homeFlagUrl}
                                  alt={match.homeTeam}
                                  width={40}
                                  height={28}
                                  className="h-8 w-10 object-cover"
                                />
                              </div>
                              <div>
                                <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                                  {match.homeCode}
                                </div>
                                <span className="text-lg font-semibold">{match.homeTeam}</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-center">
                              <div className="text-sm uppercase tracking-[0.3em] text-white/35">
                                VS
                              </div>
                            </div>

                            <div className="flex items-center justify-center gap-3">
                              <div className="text-right">
                                <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                                  {match.awayCode}
                                </div>
                                <span className="text-lg font-semibold">{match.awayTeam}</span>
                              </div>
                              <div className="overflow-hidden rounded-xl border border-white/10 bg-white/10">
                                <Image
                                  src={match.awayFlagUrl}
                                  alt={match.awayTeam}
                                  width={40}
                                  height={28}
                                  className="h-8 w-10 object-cover"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-white/45">
                              Resultado oficial
                            </p>

                            <div className="flex items-center gap-3">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={current.homeScore}
                                onChange={(e) =>
                                  updateResult(match.id, 'homeScore', e.target.value)
                                }
                                className="h-12 w-12 sm:h-14 sm:w-16 rounded-xl sm:rounded-2xl border border-white/10 bg-white/10 text-center text-lg sm:text-xl font-bold text-white outline-none transition disabled:opacity-30 disabled:cursor-not-allowed"
                                placeholder=""
                              />
                              <span className="text-lg font-semibold text-white/50">-</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={current.awayScore}
                                onChange={(e) =>
                                  updateResult(match.id, 'awayScore', e.target.value)
                                }
                                className="h-12 w-12 sm:h-14 sm:w-16 rounded-xl sm:rounded-2xl border border-white/10 bg-white/10 text-center text-lg sm:text-xl font-bold text-white outline-none transition disabled:opacity-30 disabled:cursor-not-allowed"
                              />
                              <button
                                onClick={() => saveOfficialResult(match.id)}
                                disabled={
                                  savingId === match.id ||
                                  current.homeScore === '' ||
                                  current.awayScore === ''
                                }
                                className={`ml-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                                  current.homeScore === '' || current.awayScore === ''
                                    ? 'bg-white/10 text-white/40 cursor-not-allowed'
                                    : 'bg-white text-black hover:bg-white/90'
                                }`}
                              >
                                {savingId === match.id ? 'Guardando...' : 'Guardar'}
                              </button>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-white/45">
                              Estado del partido
                            </p>

                            <div className="flex items-center gap-3">
                              <span
                                className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${
                                  state.isOpen
                                    ? 'bg-emerald-400/10 text-emerald-200'
                                    : 'bg-red-400/10 text-red-200'
                                }`}
                              >
                                {state.isOpen ? 'Abierto' : 'Cerrado'}
                              </span>

                              <button
                                onClick={() => toggleMatchOpen(match.id, state.isOpen)}
                                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                              >
                                {state.isOpen ? 'Cerrar picks' : 'Abrir picks'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
          <section id="admin-payments" className="scroll-mt-8 mt-8 rounded-3xl border border-yellow-400/30 bg-gradient-to-br from-yellow-400/10 via-white/[0.03] to-black p-6 shadow-xl md:p-8">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="inline-flex rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.24em] text-yellow-200">
                  Bolsa + pagos
                </div>

                <h2 className="mt-4 text-3xl font-black tracking-tight text-yellow-400 md:text-5xl">
                  Control de pagos por quiniela
                </h2>

                <p className="mt-3 max-w-4xl text-sm leading-6 text-white/70 md:text-base">
                  Cada quiniela cuesta {formatCurrencyMXN(ENTRY_PRICE)}. De cada pago,
                  {formatCurrencyMXN(ADMIN_FEE_PER_ENTRY)} se quedan como gastos de administración
                  y {formatCurrencyMXN(PRIZE_CONTRIBUTION_PER_ENTRY)} integran la bolsa.
                </p>

                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                  Fecha límite de pago: 10 de junio de 2026 · 11:59 PM (CDMX)
                </p>
              </div>

              <div className="rounded-3xl border border-yellow-400/25 bg-black/35 p-5 xl:min-w-[320px] xl:text-right">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">
                  Bolsa final
                </p>
                <p className="mt-2 text-4xl font-black text-yellow-400">
                  {formatCurrencyMXN(paymentSummary.prizePool)}
                </p>
                <p className="mt-2 text-xs text-white/45">
                  Garantizada: {formatCurrencyMXN(GUARANTEED_PRIZE_POOL)}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Quinielas</p>
                <p className="mt-2 text-2xl font-bold text-white">{paymentSummary.totalEntries}</p>
              </div>

              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/70">Pagadas</p>
                <p className="mt-2 text-2xl font-bold text-emerald-100">{paymentSummary.paidEntries}</p>
              </div>

              <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-red-200/70">Pendientes</p>
                <p className="mt-2 text-2xl font-bold text-red-100">{paymentSummary.pendingEntries}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Recaudado</p>
                <p className="mt-2 text-2xl font-bold text-white">{formatCurrencyMXN(paymentSummary.totalCollected)}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Gastos admin</p>
                <p className="mt-2 text-2xl font-bold text-white">{formatCurrencyMXN(paymentSummary.adminFees)}</p>
              </div>
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-yellow-400">
                    Quinielas y pagos
                  </h3>
                  <p className="mt-2 text-sm text-white/60">
                    Marca cada quiniela como pagada, pendiente o exenta.
                  </p>
                </div>

                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/70">
                  {paymentEntries.length} quinielas
                </span>
              </div>

              {paymentsLoading ? (
                <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4 text-white/60">
                  Cargando pagos...
                </div>
              ) : paymentEntries.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4 text-white/60">
                  Todavía no hay quinielas registradas.
                </div>
              ) : (
                <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
                  <div className="hidden grid-cols-[1.2fr_1fr_120px_130px_240px] border-b border-yellow-500/20 bg-yellow-500/5 px-4 py-4 text-xs font-bold uppercase tracking-[0.18em] text-yellow-400 lg:grid">
                    <div>Participante</div>
                    <div>Quiniela</div>
                    <div>Estatus</div>
                    <div className="text-right">Pagado</div>
                    <div className="text-right">Acciones</div>
                  </div>

                  <div className="divide-y divide-white/10">
                    {paymentEntries.map((entry) => {
                      const isUpdating = updatingPaymentId === entry.id
                      const pendingAmount = Math.max(ENTRY_PRICE - Number(entry.payment_amount ?? 0), 0)

                      return (
                        <div
                          key={entry.id}
                          className="grid gap-4 px-4 py-5 text-sm lg:grid-cols-[1.2fr_1fr_120px_130px_240px] lg:items-center"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-white">
                              {entry.profiles?.full_name || 'Participante'}
                            </p>
                            <p className="mt-1 truncate text-xs text-white/45">
                              {entry.profiles?.email || 'Sin email'}
                              {entry.profiles?.phone ? ` · ${entry.profiles.phone}` : ''}
                            </p>
                          </div>

                          <div className="min-w-0">
                            <p className="font-semibold text-white/85">{entry.name}</p>
                            {entry.payment_status !== 'paid' && entry.payment_status !== 'exempt' && (
                              <p className="mt-1 text-xs font-semibold text-red-200">
                                Pendiente: {formatCurrencyMXN(pendingAmount)}
                              </p>
                            )}
                          </div>

                          <div>
                            <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${getPaymentStatusClass(entry.payment_status)}`}>
                              {getPaymentStatusLabel(entry.payment_status)}
                            </span>
                          </div>

                          <div className="text-left lg:text-right">
                            <p className="font-bold text-white">
                              {formatCurrencyMXN(Number(entry.payment_amount ?? 0))}
                            </p>
                            <p className="mt-1 text-xs text-white/45">
                              {entry.paid_at ? new Date(entry.paid_at).toLocaleDateString('es-MX') : 'Sin fecha'}
                            </p>
                          </div>

                          <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => markEntryAsPaid(entry.id)}
                              className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200 transition hover:bg-emerald-400/15 disabled:opacity-40"
                            >
                              Pagado
                            </button>

                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => markEntryAsPending(entry.id)}
                              className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-200 transition hover:bg-red-400/15 disabled:opacity-40"
                            >
                              Pendiente
                            </button>

                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => markEntryAsExempt(entry.id)}
                              className="rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-xs font-bold text-sky-200 transition hover:bg-sky-400/15 disabled:opacity-40"
                            >
                              Exento
                            </button>
                            <button
  type="button"
  disabled={isUpdating}
  onClick={async () => {
    const confirmDelete = window.confirm(
      `¿Borrar la quiniela "${entry.name}"? Esto eliminará también sus picks.`
    )
    if (!confirmDelete) return

    // borrar predictions primero (seguro)
    await supabase.from('predictions').delete().eq('entry_id', entry.id)

    const { error } = await supabase
      .from('entries')
      .delete()
      .eq('id', entry.id)

    if (error) {
      alert('Error al borrar quiniela: ' + error.message)
      return
    }

    // refrescar UI
    setPaymentEntries((prev) => prev.filter((e) => e.id !== entry.id))
  }}
  className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/15"
>
  Borrar quiniela
</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 grid gap-3 border-t border-white/10 pt-6 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => scrollToAdminSection('admin-top')}
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15 active:scale-[0.98]"
              >
                ↑ Ir arriba
              </button>

              <button
                type="button"
                onClick={onBack}
                className="rounded-2xl border border-yellow-400/25 bg-yellow-400/10 px-5 py-3 text-sm font-bold text-yellow-100 transition hover:bg-yellow-400/15 active:scale-[0.98]"
              >
                ← Regresar al dashboard
              </button>
            </div>

            <div id="admin-users" className="scroll-mt-8 mt-10 border-t border-white/10 pt-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-yellow-400">
                    Usuarios registrados
                  </h3>
                  <p className="mt-2 text-sm text-white/60">
                    Esta tabla solo sirve para borrar usuarios junto con sus quinielas y picks.
                  </p>
                </div>

                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/70">
                  {users.length} usuarios
                </span>
              </div>

              {usersLoading ? (
                <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4 text-white/60">
                  Cargando usuarios...
                </div>
              ) : users.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4 text-white/60">
                  No hay usuarios registrados.
                </div>
              ) : (
                <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
                  <div className="grid grid-cols-[1.4fr_1fr_120px_140px] border-b border-yellow-500/20 bg-yellow-500/5 px-4 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-yellow-400">
                    <div>Participante</div>
                    <div>Email</div>
                    <div>Rol</div>
                    <div className="text-right">Acción</div>
                  </div>

                  {users.map((adminUser) => (
                    <div
                      key={adminUser.id}
                      className="grid grid-cols-[1.4fr_1fr_120px_140px] items-center border-b border-white/10 px-4 py-4 text-sm last:border-b-0"
                    >
                      <div className="font-semibold text-white">
                        {adminUser.full_name || 'Sin nombre'}
                      </div>

                      <div className="text-white/70">
                        {adminUser.email || 'Sin email'}
                      </div>

                      <div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                            adminUser.role === 'admin'
                              ? 'bg-yellow-400/10 text-yellow-300'
                              : 'bg-white/10 text-white/70'
                          }`}
                        >
                          {adminUser.role || 'player'}
                        </span>
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={() => handleDeleteUser(adminUser)}
                          disabled={deletingUserId === adminUser.id}
                          className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                            deletingUserId === adminUser.id
                              ? 'cursor-not-allowed bg-white/10 text-white/35'
                              : 'bg-red-400/10 text-red-200 hover:bg-red-400/15'
                          }`}
                        >
                          {deletingUserId === adminUser.id ? 'Borrando...' : 'Borrar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8 grid gap-3 border-t border-white/10 pt-6 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => scrollToAdminSection('admin-top')}
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15 active:scale-[0.98]"
              >
                ↑ Ir arriba
              </button>

              <button
                type="button"
                onClick={() => scrollToAdminSection('admin-payments')}
                className="rounded-2xl border border-yellow-400/25 bg-yellow-400/10 px-5 py-3 text-sm font-bold text-yellow-100 transition hover:bg-yellow-400/15 active:scale-[0.98]"
              >
                💰 Ir a Bolsa + pagos
              </button>

              <button
                type="button"
                onClick={onBack}
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15 active:scale-[0.98]"
              >
                ← Regresar al dashboard
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

function PublicPicksScreen({
  onBack,
  user,
}: {
  onBack: () => void
  user: UserState
}) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [publicMatchMeta, setPublicMatchMeta] = useState<Record<string, PublicMatchMetaRow>>({})
  const canView = user?.role === 'admin' || new Date() >= PUBLIC_REVEAL_DATE

  useScrollToPageTop([])

  useEffect(() => {
  if (!canView) {
    setLoading(false)
    return
  }

  let mounted = true

  const load = async () => {
    const [{ data: picksData, error: picksError }, { data: matchesData, error: matchesError }] =
      await Promise.all([
        supabase
          .from('predictions')
          .select(`
            match_id,
            home_score_predicted,
            away_score_predicted,
            entries (
              id,
              name,
              user_id,
              profiles (
                full_name,
                email
              )
            )
          `),
        supabase
          .from('matches')
          .select('id, home_score, away_score, is_open, is_finished')
          .in('id', MATCHES.map((match) => match.id)),
      ])

    if (!mounted) return

    if (picksError) {
      console.error(picksError.message)
      setLoading(false)
      return
    }

    if (matchesError) {
      console.error(matchesError.message)
    }

    const matchMetaMap: Record<string, PublicMatchMetaRow> = {}

    ;((matchesData ?? []) as PublicMatchMetaRow[]).forEach((matchRow) => {
      matchMetaMap[matchRow.id] = matchRow
    })

    setPublicMatchMeta(matchMetaMap)
    setRows(picksData ?? [])
    setLoading(false)
  }

  load()

  const channel = supabase
    .channel('public-picks-refresh')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profiles' },
      load
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'predictions' },
      load
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'matches' },
      load
    )
    .subscribe()

  return () => {
    mounted = false
    supabase.removeChannel(channel)
  }
}, [canView])

  const groupedByMatch = useMemo(() => {
  const grouped: Record<string, any[]> = {}

  rows.forEach((row) => {
    if (!grouped[row.match_id]) grouped[row.match_id] = []
    grouped[row.match_id].push(row)
  })

  const isFinished = (matchId: string) => {
    const meta = publicMatchMeta[matchId]

    // IMPORTANTE:
    // Para la vista pública, un partido solo baja al final cuando el admin lo cierra.
    // Si tiene marcador pero sigue abierto, permanece en su posición original.
    return meta?.is_open === false
  }

  const allVisibleMatchesFinished =
    Object.keys(grouped).length > 0 && Object.keys(grouped).every((matchId) => isFinished(matchId))

  const sortedEntries = Object.entries(grouped).sort(([matchIdA], [matchIdB]) => {
    const matchA = MATCHES.find((match) => match.id === matchIdA)
    const matchB = MATCHES.find((match) => match.id === matchIdB)

    const dateA = matchA ? parseKickoffToDate(matchA.kickoff)?.getTime() ?? 0 : 0
    const dateB = matchB ? parseKickoffToDate(matchB.kickoff)?.getTime() ?? 0 : 0

    if (!allVisibleMatchesFinished) {
      const finishedA = isFinished(matchIdA)
      const finishedB = isFinished(matchIdB)

      if (finishedA !== finishedB) {
        return finishedA ? 1 : -1
      }
    }

    return dateA - dateB
  })

  return Object.fromEntries(sortedEntries)
}, [rows, publicMatchMeta])

 const getMatchById = (matchId: string) => {
  return MATCHES.find((match) => match.id === matchId)
}

const getPublicMatchMeta = (matchId: string) => {
  return publicMatchMeta[matchId] ?? null
}

const isPublicMatchFinished = (matchId: string) => {
  const meta = getPublicMatchMeta(matchId)

  // Solo se considera jugado/cerrado para ordenar cuando el admin cerró el partido.
  return meta?.is_open === false
}

const getResultStyle = (row: any, match: any) => {
  if (match?.home_score == null || match?.away_score == null) {
  return 'text-emerald-300'
}

  const ph = row.home_score_predicted
  const pa = row.away_score_predicted
  const oh = match.home_score
  const oa = match.away_score

  if (ph === oh && pa === oa) {
    return 'bg-emerald-400/20 text-emerald-300'
  }

  const predicted = ph > pa ? 'home' : ph < pa ? 'away' : 'draw'
  const official = oh > oa ? 'home' : oh < oa ? 'away' : 'draw'

  if (predicted === official) {
    return 'bg-amber-400/20 text-amber-300'
  }

  return 'bg-red-400/20 text-red-300'
}

if (!canView) {
  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <button
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white shadow-lg backdrop-blur transition hover:bg-white/20 active:scale-[0.98]"
        >
          ← Volver
        </button>

        <div className="relative overflow-hidden rounded-3xl border border-yellow-500/40 bg-black/95 p-8 shadow-[0_0_30px_rgba(234,179,8,0.15)] md:p-10">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-transparent to-yellow-500/5" />
          <div className="absolute left-0 top-0 h-[2px] w-40 bg-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.8)]" />

          <div className="relative z-10">
            <h1 className="text-4xl font-extrabold tracking-tight text-yellow-400 md:text-6xl">
              Todas las Quinielas
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-white/80">
              Consulta todas las Quinielas y ve lo que pusieron los participantes en cada partido.
            </p>
          </div>
        </div>

        <PublicRevealLockedCard />
      </div>
    </main>
  )
}

return (
  <main className="min-h-screen overflow-x-hidden bg-black px-4 py-6 text-white sm:px-6 md:px-10 md:py-8">
    <div className="mx-auto w-full max-w-7xl">
      <button
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white shadow-lg backdrop-blur transition hover:bg-white/20 active:scale-[0.98]"
      >
        ← Volver
      </button>

            <div className="relative overflow-hidden rounded-3xl border border-yellow-500/40 bg-black/95 p-5 shadow-[0_0_30px_rgba(234,179,8,0.15)] sm:p-6 md:p-10">
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-transparent to-yellow-500/5" />
        <div className="absolute left-0 top-0 h-[2px] w-40 bg-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.8)]" />

        <div className="relative z-10 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-yellow-400 sm:text-4xl md:text-6xl">
              Todas las Quinielas
            </h1>

            <p className="mt-4 max-w-3xl text-base leading-7 text-white/80 md:text-lg">
              Consulta todas las Quinielas y ve lo que pusieron los participantes en cada partido.
            </p>
          </div>

          <div className="hidden h-24 w-24 items-center justify-center rounded-full border border-yellow-500/40 bg-yellow-500/10 shadow-[0_0_40px_rgba(234,179,8,0.35)] md:flex">
            <img
  src="/people-icon.png"
  alt="Usuarios"
  className="h-40 w-40 object-contain drop-shadow-[0_0_12px_rgba(250,204,21,0.65)] animate-pulse"
/>
          </div>
        </div>
      </div>

        {loading ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
            Cargando...
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {Object.entries(groupedByMatch).map(([matchId, picks]) => {
              const match = getMatchById(matchId)
              const matchMeta = getPublicMatchMeta(matchId)
              const matchFinished = isPublicMatchFinished(matchId)
              const matchForScoring = {
                ...(match ?? {}),
                home_score: matchMeta?.home_score ?? null,
                away_score: matchMeta?.away_score ?? null,
              }

              return (
  <section
    key={matchId}
    className="w-full overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl sm:p-5 md:p-6"
  >
    <div className="mb-8">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <p className="text-xs uppercase tracking-[0.18em] text-white/45">
      {match?.kickoff}
    </p>

    <span
      className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
        matchFinished
          ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
          : 'border-yellow-400/20 bg-yellow-400/10 text-yellow-200'
      }`}
    >
      {matchFinished ? 'Jugado' : 'Por jugarse'}
    </span>
  </div>

  <div className="mt-6 grid grid-cols-[minmax(0,1fr)_52px_minmax(0,1fr)] items-center gap-2 sm:gap-4 md:grid-cols-[1fr_auto_1fr] md:gap-10">
    <div className="flex min-w-0 flex-col items-center justify-end gap-2 text-center sm:flex-row sm:gap-3 md:gap-4">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/10">
        <Image
          src={match?.homeFlagUrl ?? '/favicon.ico'}
          alt={match?.homeTeam ?? ''}
          width={64}
          height={44}
          className="h-8 w-12 object-cover sm:h-10 sm:w-14 md:h-11 md:w-16"
        />
      </div>

      <div className="text-left">
        <div className="text-sm uppercase tracking-[0.2em] text-emerald-300/80">
          {match?.homeCode}
        </div>
        <span className="block max-w-full break-words text-xl font-extrabold leading-tight text-white sm:text-2xl md:text-4xl">
          {match?.homeTeam}
        </span>
      </div>
    </div>

    <div className="flex items-center justify-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-white/70 sm:h-14 sm:w-14 sm:text-base md:h-16 md:w-16 md:text-xl">
        VS
      </div>
    </div>

    <div className="flex min-w-0 flex-col-reverse items-center justify-start gap-2 text-center sm:flex-row sm:gap-3 md:gap-4">
      <div className="text-center sm:text-right">
        <div className="text-sm uppercase tracking-[0.2em] text-emerald-300/80">
          {match?.awayCode}
        </div>
        <span className="block max-w-full break-words text-xl font-extrabold leading-tight text-white sm:text-2xl md:text-4xl">
          {match?.awayTeam}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/10">
        <Image
          src={match?.awayFlagUrl ?? '/favicon.ico'}
          alt={match?.awayTeam ?? ''}
          width={64}
          height={44}
          className="h-8 w-12 object-cover sm:h-10 sm:w-14 md:h-11 md:w-16"
        />
      </div>
    </div>
  </div>
</div>

    <div className="w-full overflow-hidden rounded-2xl border border-white/10">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.72fr)_70px] border-b border-yellow-500/20 bg-yellow-500/5 px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-yellow-400 sm:px-4 sm:text-xs md:grid-cols-[1.5fr_1fr_120px] md:py-4 md:text-sm">
        <div>Jugador</div>
        <div>Quiniela</div>
        <div className="text-right">Pick</div>
      </div>

      {picks.map((row, index) => {
  const isMe = row.entries?.profiles?.email === user?.email

  return (
    <div
      key={`${row.entries?.id}-${index}`}
      className={`grid grid-cols-[minmax(0,1fr)_minmax(0,0.72fr)_70px] items-center gap-2 border-b px-3 py-4 text-xs last:border-b-0 sm:px-4 sm:text-sm md:grid-cols-[1.5fr_1fr_120px] md:gap-0 md:py-5 ${
  isMe
    ? 'bg-emerald-400/10 border-emerald-400/20'
    : 'border-yellow-500/10 bg-emerald-950/40'
}`}
    >
          <div className="min-w-0 pr-1">
  <p className="truncate text-xs font-semibold leading-tight text-white sm:text-sm md:text-base">
    {row.entries?.profiles?.full_name || 'Jugador'}
  </p>
</div>

          <div className="min-w-0 truncate pr-1 text-xs font-medium leading-tight text-white/85 sm:text-sm">
            {row.entries?.name}
          </div>

          <div
  className={`inline-block rounded-lg px-1.5 py-1 text-right text-base font-bold leading-tight sm:text-lg md:rounded-xl md:px-3 md:text-2xl ${getResultStyle(
    row,
    matchForScoring
  )}`}
>
  {row.home_score_predicted} - {row.away_score_predicted}
</div>
    </div>
  )
})}
    </div>
  </section>
)
})}
          </div>
        )}
      </div>
    </main>
  )
}
function PublicPicksByParticipantScreen({
  onBack,
  user,
  onOpenEntry,
}: {
  onBack: () => void
  user: UserState
  onOpenEntry: (entryId: string) => void
}) {
  const [rows, setRows] = useState<PublicEntryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const canView = user?.role === 'admin' || new Date() >= PUBLIC_REVEAL_DATE

  useScrollToPageTop([])

  useEffect(() => {
  if (!canView) {
    setLoading(false)
    return
  }

  let mounted = true

  const load = async () => {
    const { data, error } = await supabase
      .from('entries')
      .select(`
        id,
        name,
        user_id,
        profiles (
          full_name,
          email
        )
      `)
      .order('user_id', { ascending: true })
      .order('name', { ascending: true })

    if (!mounted) return

    if (error) {
      console.error('Error cargando quinielas por participante:', error.message)
      setRows([])
      setLoading(false)
      return
    }

    const safeRows = ((data ?? []) as PublicEntryRow[]).sort((a, b) => {
      const nameA =
        a.profiles?.full_name?.trim() ||
        a.profiles?.email?.trim() ||
        'Participante'
      const nameB =
        b.profiles?.full_name?.trim() ||
        b.profiles?.email?.trim() ||
        'Participante'

      const byParticipant = nameA.localeCompare(nameB, 'es', {
        sensitivity: 'base',
      })

      if (byParticipant !== 0) return byParticipant

      return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    })

    setRows(safeRows)
    setLoading(false)
  }

  load()

  const channel = supabase
    .channel('participants-refresh')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profiles' },
      load
    )
    .subscribe()

  return () => {
    mounted = false
    supabase.removeChannel(channel)
  }
}, [selectedUserId, canView])

  const participants = useMemo(() => {
    const map = new Map<
      string,
      {
        user_id: string
        full_name: string
        email: string
        entries: PublicEntryRow[]
      }
    >()

    rows.forEach((row) => {
      const current = map.get(row.user_id)

      if (current) {
        current.entries.push(row)
        return
      }

      map.set(row.user_id, {
        user_id: row.user_id,
        full_name: row.profiles?.full_name || 'Participante',
        email: row.profiles?.email || '',
        entries: [row],
      })
    })

    return Array.from(map.values()).sort((a, b) =>
      a.full_name.localeCompare(b.full_name, 'es', { sensitivity: 'base' })
    )
  }, [rows])

  const selectedParticipant =
    participants.find((participant) => participant.user_id === selectedUserId) ?? null

  const desktopSelectedParticipant = selectedParticipant ?? participants[0] ?? null

  if (!canView) {
    return (
      <main className="min-h-screen bg-black px-6 py-8 text-white md:px-10">
        <div className="mx-auto max-w-7xl">
          <button
            onClick={onBack}
            className="mb-6 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white shadow-lg backdrop-blur transition hover:bg-white/20 active:scale-[0.98]"
          >
            ← Volver
          </button>

          <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.03] p-6 shadow-2xl md:p-8">
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
              Vista pública
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-yellow-400 md:text-5xl">
              Quinielas por participante
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65 md:text-base">
              Explora todas las quinielas agrupadas por participante.
            </p>
          </section>

          <PublicRevealLockedCard />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <button
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white shadow-lg backdrop-blur transition hover:bg-white/20 active:scale-[0.98]"
        >
          ← Volver
        </button>

        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.03] p-6 shadow-2xl md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                Vista pública
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-yellow-400 md:text-5xl">
                Quinielas por participante
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65 md:text-base">
                Explora todas las quinielas agrupadas por participante.
              </p>
            </div>

            <div className="grid min-w-[220px] grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                  Participantes
                </p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {participants.length}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                  Quinielas
                </p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {rows.length}
                </p>
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
            Cargando participantes...
          </div>
        ) : participants.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-lg font-semibold text-white">
              Aún no hay quinielas registradas
            </p>
            <p className="mt-2 text-sm leading-6 text-white/65">
              Cuando existan quinielas en la tabla <code>entries</code>, aparecerán aquí agrupadas por participante.
            </p>
          </div>
        ) : (
          <>
          <section className="mt-8 lg:hidden">
            {!selectedParticipant ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-yellow-400">
                    Participantes
                  </h2>

                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                    {participants.length}
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  {participants.map((participant) => {
                    const isMe = participant.email && participant.email === user?.email

                    return (
                      <button
                        key={participant.user_id}
                        type="button"
                        onClick={() => setSelectedUserId(participant.user_id)}
                        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-left transition hover:border-yellow-400/20 hover:bg-white/[0.06] active:scale-[0.99]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">
                              {participant.full_name}
                            </p>
                          </div>

                          {isMe && (
                            <span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                              Tú
                            </span>
                          )}
                        </div>

                        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-yellow-300">
                          {participant.entries.length} quiniela{participant.entries.length === 1 ? '' : 's'}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl">
                <button
                  type="button"
                  onClick={() => setSelectedUserId(null)}
                  className="mb-5 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/15 active:scale-[0.98]"
                >
                  ← Volver a participantes
                </button>

                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-yellow-400">
                      Quinielas del participante
                    </h2>

                    <p className="mt-1 truncate text-sm text-white/70">
                      {selectedParticipant.full_name}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                    {selectedParticipant.entries.length}
                  </span>
                </div>

                <div className="mt-6 grid gap-4">
                  {selectedParticipant.entries.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => onOpenEntry(entry.id)}
                      className="rounded-3xl border border-yellow-400/20 bg-gradient-to-br from-white/8 to-white/[0.03] p-5 text-left shadow-lg transition hover:border-yellow-400/40 hover:bg-yellow-400/10 active:scale-[0.99]"
                    >
                      <p className="text-lg font-bold text-white">{entry.name}</p>
                      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-yellow-300">
                        Ver quiniela
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="mt-8 hidden gap-6 lg:grid lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-yellow-400">
                  Participantes
                </h2>

                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                  {participants.length}
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {participants.map((participant) => {
                  const isSelected = participant.user_id === selectedUserId
                  const isMe = participant.email && participant.email === user?.email

                  return (
                    <button
                      key={participant.user_id}
                      type="button"
                      onClick={() => setSelectedUserId(participant.user_id)}
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                        isSelected
                          ? 'border-yellow-400/40 bg-yellow-400/10 shadow-[0_0_30px_rgba(250,204,21,0.10)]'
                          : 'border-white/10 bg-black/30 hover:border-yellow-400/20 hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {participant.full_name}
                          </p>

                        </div>

                        {isMe && (
                          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                            Tú
                          </span>
                        )}
                      </div>

                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-yellow-300">
                        {participant.entries.length} quiniela{participant.entries.length === 1 ? '' : 's'}
                      </p>
                    </button>
                  )
                })}
              </div>
            </aside>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-yellow-400">
                    Quinielas del participante
                  </h2>

                  <p className="mt-1 text-sm text-white/55">
                    {desktopSelectedParticipant?.full_name || 'Participante'}
                  </p>
                </div>

                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                  {desktopSelectedParticipant?.entries.length ?? 0} registros
                </span>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {desktopSelectedParticipant?.entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onOpenEntry(entry.id)}
                    className="rounded-3xl border border-yellow-400/20 bg-gradient-to-br from-white/8 to-white/[0.03] p-5 text-left shadow-lg transition hover:border-yellow-400/40 hover:bg-yellow-400/10 hover:shadow-[0_0_30px_rgba(250,204,21,0.15)]"
                  >
                    <p className="text-lg font-bold text-white">{entry.name}</p>
                    <p className="mt-2 text-sm leading-6 text-white/60">
                      En la siguiente fase, esta tarjeta abrirá el detalle completo de la quiniela.
                    </p>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-yellow-300">
                      Ver detalle
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </section>
          </>
        )}
      </div>
    </main>
  )
}
function EntryDetailScreen({
  entryId,
  onBack,
}: {
  entryId: string
  onBack: () => void
}) {
  const [entryInfo, setEntryInfo] = useState<EntryDetailInfo | null>(null)
  const [predictionsMap, setPredictionsMap] = useState<Record<string, Prediction>>({})
  const [officialResults, setOfficialResults] = useState<Record<string, OfficialResult>>({})
  const [matchStates, setMatchStates] = useState<Record<string, MatchState>>({})
  const [loading, setLoading] = useState(true)

  useScrollToPageTop([entryId])

  useEffect(() => {
    let mounted = true

    const loadAll = async () => {
      setLoading(true)

      const [{ data: entryData, error: entryError }, { data: picksData, error: picksError }, { data: matchesData, error: matchesError }] =
        await Promise.all([
          supabase
            .from('entries')
            .select(`
              id,
              name,
              user_id,
              profiles (
                full_name,
                email
              )
            `)
            .eq('id', entryId)
            .single(),
          supabase
            .from('predictions')
            .select('match_id, home_score_predicted, away_score_predicted')
            .eq('entry_id', entryId),
          supabase
            .from('matches')
            .select('id, home_score, away_score, is_open, is_finished')
            .in('id', MATCHES.map((match) => match.id)),
        ])

      if (!mounted) return

      if (entryError) {
        console.error('Error cargando detalle de quiniela:', entryError.message)
        setEntryInfo(null)
      } else {
        setEntryInfo((entryData as EntryDetailInfo) ?? null)
      }

      if (picksError) {
        console.error('Error cargando predictions de la quiniela:', picksError.message)
        setPredictionsMap({})
      } else {
        const formatted: Record<string, Prediction> = {}

        ;((picksData ?? []) as EntryPredictionRow[]).forEach((row) => {
          formatted[row.match_id] = {
            homeScore:
              row.home_score_predicted == null ? '' : String(row.home_score_predicted),
            awayScore:
              row.away_score_predicted == null ? '' : String(row.away_score_predicted),
          }
        })

        setPredictionsMap(formatted)
      }

      if (matchesError) {
        console.error('Error cargando metadata de matches en detalle:', matchesError.message)
        setOfficialResults({})
        setMatchStates({})
      } else {
        const officialMap: Record<string, OfficialResult> = {}
        const stateMap: Record<string, MatchState> = {}

        ;(matchesData ?? []).forEach((row: any) => {
          officialMap[row.id] = {
            homeScore: row.home_score == null ? '' : String(row.home_score),
            awayScore: row.away_score == null ? '' : String(row.away_score),
          }

          stateMap[row.id] = {
            isOpen: row.is_open ?? true,
            isFinished: row.is_finished ?? false,
          }
        })

        setOfficialResults(officialMap)
        setMatchStates(stateMap)
      }

      setLoading(false)
    }

    loadAll()

    const channel = supabase
      .channel(`entry-detail-${entryId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'predictions' },
        loadAll
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        loadAll
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entries' },
        loadAll
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [entryId])

  const groupedMatches = useMemo(() => {
    const grouped = MATCHES.reduce<Record<string, Match[]>>((acc, match) => {
      if (!acc[match.group]) acc[match.group] = []
      acc[match.group].push(match)
      return acc
    }, {})

    return Object.fromEntries(
      Object.entries(grouped).sort(([groupA], [groupB]) =>
        groupA.localeCompare(groupB, 'es', { sensitivity: 'base' })
      )
    )
  }, [])

  const summary = useMemo(() => {
    let completed = 0
    let exact = 0
    let outcome = 0
    let totalPoints = 0

    MATCHES.forEach((match) => {
      const prediction = predictionsMap[match.id] ?? { homeScore: '', awayScore: '' }
      const official = officialResults[match.id] ?? { homeScore: '', awayScore: '' }

      if (prediction.homeScore !== '' && prediction.awayScore !== '') {
        completed += 1
      }

      const status = getPickStatus(prediction, official)

      if (!status) return

      if (status.label.includes('Exacto')) {
        exact += 1
        totalPoints += 3
        return
      }

      if (status.label.includes('Acierto')) {
        outcome += 1
        totalPoints += 1
      }
    })

    return {
      completed,
      pending: MATCHES.length - completed,
      exact,
      outcome,
      totalPoints,
    }
  }, [officialResults, predictionsMap])

  if (loading) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-black px-4 py-6 text-white sm:px-6 md:px-10 md:py-8">
        <div className="mx-auto w-full max-w-7xl">
          <button
            onClick={onBack}
            className="mb-6 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white shadow-lg backdrop-blur transition hover:bg-white/20 active:scale-[0.98]"
          >
            ← Volver
          </button>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
            Cargando detalle de quiniela...
          </div>
        </div>
      </main>
    )
  }

  if (!entryInfo) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-black px-4 py-6 text-white sm:px-6 md:px-10 md:py-8">
        <div className="mx-auto w-full max-w-7xl">
          <button
            onClick={onBack}
            className="mb-6 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white shadow-lg backdrop-blur transition hover:bg-white/20 active:scale-[0.98]"
          >
            ← Volver
          </button>

          <div className="rounded-3xl border border-red-400/20 bg-red-400/10 p-6">
            <p className="text-lg font-semibold text-white">
              No se encontró la quiniela
            </p>
            <p className="mt-2 text-sm leading-6 text-white/70">
              La quiniela seleccionada ya no existe o no pudo cargarse.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-black px-4 py-6 text-white sm:px-6 md:px-10 md:py-8">
      <div className="mx-auto w-full max-w-7xl">
        <button
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white shadow-lg backdrop-blur transition hover:bg-white/20 active:scale-[0.98]"
        >
          ← Volver
        </button>

        <section className="relative overflow-hidden rounded-3xl border border-yellow-500/40 bg-black/95 p-5 shadow-[0_0_30px_rgba(234,179,8,0.15)] sm:p-6 md:p-10">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-transparent to-yellow-500/5" />
          <div className="absolute left-0 top-0 h-[2px] w-40 bg-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.8)]" />

          <div className="relative z-10 grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-end">
  <div className="max-w-4xl">
    <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-6xl xl:text-7xl">
  <span className="text-yellow-400/80 font-semibold">
    Quiniela de:
  </span>{' '}
  {entryInfo.profiles?.full_name || 'Participante'}
</h1>

    <p className="mt-4 inline-flex rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-yellow-300">
      {entryInfo.name}
    </p>

    <p className="mt-5 max-w-2xl text-sm leading-7 text-white/60 md:text-base">
      Consulta todos los picks capturados de esta quiniela, su estatus frente al resultado oficial y el rendimiento acumulado del participante.
    </p>
  </div>

  <div className="grid grid-cols-2 gap-3">
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
        Puntos Totales
      </p>
      <p className="mt-2 text-2xl font-bold text-white">
        {summary.totalPoints}
      </p>
    </div>

    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
        Capturados
      </p>
      <p className="mt-2 text-2xl font-bold text-white">
        {summary.completed}/{MATCHES.length}
      </p>
    </div>

    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
      <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/70">
        Marcadores Exactos
      </p>
      <p className="mt-2 text-2xl font-bold text-emerald-100">
        {summary.exact}
      </p>
    </div>

    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
      <p className="text-[11px] uppercase tracking-[0.22em] text-amber-200/70">
        Aciertos
      </p>
      <p className="mt-2 text-2xl font-bold text-amber-100">
        {summary.outcome}
      </p>
    </div>
  </div>
</div>
        </section>

        <div className="mt-8 space-y-8">
          {Object.entries(groupedMatches).map(([groupName, matches]) => (
            <section key={groupName}>
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-2xl font-semibold text-white md:text-3xl">
                  {groupName}
                </h2>

                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/60">
                  {matches.length} partidos
                </span>
              </div>

              <div className="space-y-4">
                {matches.map((match) => {
                  const prediction = predictionsMap[match.id] ?? {
                    homeScore: '',
                    awayScore: '',
                  }

                  const official = officialResults[match.id] ?? {
                    homeScore: '',
                    awayScore: '',
                  }

                  const state = matchStates[match.id] ?? {
                    isOpen: true,
                    isFinished: false,
                  }

                  const status = getPickStatus(prediction, official)
                  const hasPrediction =
                    prediction.homeScore !== '' && prediction.awayScore !== ''
                  const hasOfficial =
                    official.homeScore !== '' && official.awayScore !== ''
                    const badgeTone = !hasPrediction
  ? 'border-red-400/20 bg-red-400/10 text-red-200'
  : !hasOfficial
    ? 'border-white/10 bg-white/10 text-white/70'
    : status?.label.includes('Exacto')
      ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
      : status?.label.includes('Acierto')
        ? 'border-amber-400/20 bg-amber-400/10 text-amber-100'
        : 'border-red-400/20 bg-red-400/10 text-red-200'

const badgeLabel = !hasPrediction
  ? 'Sin pick'
  : !hasOfficial
    ? 'Pendiente'
    : status?.label || 'Fallaste'

const badgeDetail = !hasPrediction
  ? 'No capturado'
  : !hasOfficial
    ? 'Esperando resultado oficial'
    : status?.detail || 'Sin puntos'

                  return (
                    <div
                      key={match.id}
                      className="w-full overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl transition hover:bg-white/[0.07] hover:border-white/20 sm:p-5"
                    >
                      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                            {match.kickoff}
                          </p>

                          <div className="mt-4 mx-auto grid w-full max-w-4xl grid-cols-[minmax(0,1fr)_42px_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] sm:gap-4 md:grid-cols-[1fr_120px_1fr] md:gap-6">
                            <div className="flex min-w-0 flex-col items-center justify-center gap-2 text-center sm:flex-row sm:gap-3 md:gap-4">
                              <div className="overflow-hidden rounded-xl border border-white/10 bg-white/10">
                                <Image
                                  src={match.homeFlagUrl}
                                  alt={match.homeTeam}
                                  width={56}
                                  height={40}
                                  className="h-8 w-12 object-cover sm:h-10 sm:w-14"
                                />
                              </div>

                              <div className="min-w-0 text-center sm:text-left">
                                <div className="text-xs uppercase tracking-[0.2em] text-white/40">
                                  {match.homeCode}
                                </div>
                                <span className="block max-w-full break-words text-lg font-bold leading-tight tracking-tight sm:text-xl md:text-2xl">
                                  {match.homeTeam}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-center">
                              <div className="text-xs uppercase tracking-[0.18em] text-white/35 sm:text-sm sm:tracking-[0.3em]">
                                VS
                              </div>
                            </div>

                            <div className="flex min-w-0 flex-col items-center justify-center gap-2 text-center sm:flex-row sm:gap-3 md:gap-4">
                              <div className="overflow-hidden rounded-xl border border-white/10 bg-white/10">
                                <Image
                                  src={match.awayFlagUrl}
                                  alt={match.awayTeam}
                                  width={56}
                                  height={40}
                                  className="h-8 w-12 object-cover sm:h-10 sm:w-14"
                                />
                              </div>

                              <div className="min-w-0 text-center sm:text-left">
                                <div className="text-xs uppercase tracking-[0.2em] text-white/40">
                                  {match.awayCode}
                                </div>
                                <span className="block max-w-full break-words text-lg font-bold leading-tight tracking-tight sm:text-xl md:text-2xl">
                                  {match.awayTeam}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
  <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
    <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
      Pick de la quiniela
    </p>
    <p className="mt-2 text-lg font-bold text-white">
      {hasPrediction ? `${prediction.homeScore} - ${prediction.awayScore}` : '—'}
    </p>
  </div>

  <div
    className={`rounded-2xl border px-4 py-3 ${
      hasOfficial
        ? 'border-emerald-400/20 bg-emerald-400/10'
        : 'border-white/10 bg-black/25'
    }`}
  >
    <p
      className={`text-[11px] uppercase tracking-[0.18em] ${
        hasOfficial ? 'text-emerald-200/70' : 'text-white/45'
      }`}
    >
      Resultado oficial
    </p>

    <p
      className={`mt-2 text-lg font-bold ${
        hasOfficial ? 'text-emerald-100' : 'text-white/55'
      }`}
    >
      {hasOfficial ? `${official.homeScore} - ${official.awayScore}` : 'Pendiente'}
    </p>
  </div>

  <div className={`rounded-2xl border px-4 py-3 ${badgeTone}`}>
    <p className="text-[11px] uppercase tracking-[0.18em] opacity-80">
      Estado
    </p>
    <p className="mt-2 text-lg font-bold">
      {badgeLabel}
    </p>
    <p className="mt-1 text-sm opacity-90">
      {badgeDetail}
    </p>
  </div>
</div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
  <p className="mb-3 text-center text-xs uppercase tracking-[0.2em] text-white/45">
    Pronóstico de esta quiniela
  </p>

  <div className="flex items-center justify-center gap-3">
    <div className="flex h-12 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-center text-lg font-bold text-white sm:h-14 sm:w-16 sm:text-xl">
      {prediction.homeScore || '—'}
    </div>

    <span className="text-lg font-semibold text-white/50">-</span>

    <div className="flex h-12 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-center text-lg font-bold text-white sm:h-14 sm:w-16 sm:text-xl">
      {prediction.awayScore || '—'}
    </div>
  </div>

  <div className={`mt-4 rounded-2xl border px-4 py-3 text-center ${badgeTone}`}>
    <p className="text-xs uppercase tracking-[0.18em] opacity-80">
      {badgeLabel}
    </p>
    <p className="mt-1 text-sm font-semibold">
      {badgeDetail}
    </p>
  </div>
</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<UserState>(null)

  const canViewPublic =
    user?.role === 'admin' ||
    new Date() >= PUBLIC_REVEAL_DATE

  const [landingEmail, setLandingEmail] = useState('')
const [landingPassword, setLandingPassword] = useState('')
const [landingFirstName, setLandingFirstName] = useState('')
const [landingLastName, setLandingLastName] = useState('')
const [landingPhone, setLandingPhone] = useState('')
const [landingLoading, setLandingLoading] = useState(false)
const [landingMessage, setLandingMessage] = useState('')
const [landingError, setLandingError] = useState('')
const [landingIsRegister, setLandingIsRegister] = useState(false)
  const [view, setView] = useState<ViewMode>('dashboard')
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  useScrollToPageTop([view, selectedEntryId])
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({})
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null)
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [participantProfile, setParticipantProfile] = useState<ParticipantProfileRow | null>(null)
const [participantProfileLoading, setParticipantProfileLoading] = useState(false)
const [isEditingParticipantProfile, setIsEditingParticipantProfile] = useState(false)
const [participantFirstName, setParticipantFirstName] = useState('')
const [participantLastName, setParticipantLastName] = useState('')
const [participantPhone, setParticipantPhone] = useState('')
const participantEditDeadline = new Date('2026-06-11T10:00:00-06:00')
const isParticipantEditLocked = new Date() >= participantEditDeadline
const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
const [personalRank, setPersonalRank] = useState<PersonalRankInfo>({
  position: null,
  total_points: 0,
  exact_hits: 0,
  outcome_hits: 0,
})
const [personalRankLoading, setPersonalRankLoading] = useState(false)
const creatingDefaultEntryRef = useRef<string | null>(null)

const openView = (nextView: ViewMode) => {
  scrollToPageTop()
  setView(nextView)
}

async function upsertLandingProfile(userId: string, userEmail: string) {
  const cleanFirstName = landingFirstName.trim()
  const cleanLastName = landingLastName.trim()
  const cleanPhone = landingPhone.trim()

  const { data: existingProfile, error: readError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (readError) throw readError

  if (existingProfile) {
    return
  }

  const resolvedFullName =
    `${cleanFirstName} ${cleanLastName}`.trim() ||
    userEmail.split('@')[0].replace(/[._-]+/g, ' ')

  const { error } = await supabase.from('profiles').insert({
    id: userId,
    email: userEmail,
    full_name: resolvedFullName,
    first_name: cleanFirstName || null,
    last_name: cleanLastName || null,
    phone: cleanPhone || null,
    role: 'player',
  })

  if (error) throw error
}

async function handleLandingAuth(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault()

  setLandingLoading(true)
  setLandingMessage('')
  setLandingError('')

  try {
    if (landingIsRegister) {
      if (
        !landingFirstName.trim() ||
        !landingLastName.trim() ||
        !landingPhone.trim()
      ) {
        setLandingError('Por favor ingresa nombres, apellidos y teléfono.')
        setLandingLoading(false)
        return
      }

      const { data, error } = await supabase.auth.signUp({
        email: landingEmail,
        password: landingPassword,
      })

      if (error) throw error

      if (data.user) {
        await upsertLandingProfile(data.user.id, data.user.email || landingEmail)
      }

      setLandingMessage('Cuenta creada. Ahora inicia sesión.')
      setLandingIsRegister(false)
      setLandingFirstName('')
      setLandingLastName('')
      setLandingPhone('')
      setLandingPassword('')
      return
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: landingEmail,
      password: landingPassword,
    })

    if (error) throw error

    // IMPORTANTE:
    // En login NO actualizamos profiles, porque eso puede pisar los datos personales
    // que el participante ya guardó previamente.
    router.refresh()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ocurrió un error'
    setLandingError(msg)
  } finally {
    setLandingLoading(false)
  }
}


async function handleForgotPassword() {
  const email = landingEmail.trim()

  setLandingMessage('')
  setLandingError('')

  if (!email) {
    setLandingError('Escribe tu correo primero para recuperar tu contraseña.')
    return
  }

  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/update-password`
      : 'https://www.superquiniela2026.com/update-password'

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  })

  if (error) {
    setLandingError(error.message)
    return
  }

  setLandingMessage('Te mandamos un correo para restablecer tu contraseña.')
}

async function loadParticipantProfile(userId: string) {
  setParticipantProfileLoading(true)

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('Error cargando perfil del participante:', error.message)
    setParticipantProfile(null)
    setParticipantProfileLoading(false)
    return
  }

 const profileData = (data as ParticipantProfileRow | null) ?? null
 const storedProfile = getStoredProfile(userId)

if (!profileData && !storedProfile) {
  setParticipantProfile(null)
  setParticipantProfileLoading(false)
  return
}

let resolvedProfile = {
  ...(profileData ?? {}),
  ...(storedProfile ?? {}),
  id: userId,
} as ParticipantProfileRow

const emailUserName = getEmailUserName(resolvedProfile.email)
const storedFullName = storedProfile?.full_name?.trim?.() || ''
const dbFullName = profileData?.full_name?.trim?.() || ''

if (
  storedProfile &&
  storedFullName &&
  (!dbFullName || dbFullName.toLowerCase() === emailUserName)
) {
  const { data: repairedProfile, error: repairError } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        email: storedProfile.email ?? resolvedProfile.email ?? null,
        full_name: storedProfile.full_name ?? null,
        first_name: storedProfile.first_name ?? null,
        last_name: storedProfile.last_name ?? null,
        phone: storedProfile.phone ?? null,
        role: storedProfile.role ?? resolvedProfile.role ?? 'player',
      },
      { onConflict: 'id' }
    )
    .select('*')
    .single()

  if (!repairError && repairedProfile) {
    resolvedProfile = repairedProfile as ParticipantProfileRow
  }
}

const fullNameParts = (resolvedProfile.full_name || '').trim().split(/\s+/).filter(Boolean)
const inferredFirstName =
  resolvedProfile.first_name ||
  (fullNameParts.length > 2 ? fullNameParts.slice(0, -2).join(' ') : fullNameParts[0]) ||
  ''
const inferredLastName =
  resolvedProfile.last_name ||
  (fullNameParts.length > 2 ? fullNameParts.slice(-2).join(' ') : fullNameParts.slice(1).join(' ')) ||
  ''

const resolvedFullName = resolveProfileFullName(
  {
    ...resolvedProfile,
    first_name: inferredFirstName,
    last_name: inferredLastName,
  },
  resolvedProfile.email
)

setParticipantProfile({
  ...resolvedProfile,
  full_name: resolvedFullName,
  first_name: inferredFirstName,
  last_name: inferredLastName,
  phone: resolvedProfile.phone || '',
})

setParticipantProfileLoading(false)
}
async function saveParticipantProfile() {
  if (!user?.id) return

  const cleanFirstName = participantFirstName.trim()
  const cleanLastName = participantLastName.trim()
  const cleanPhone = participantPhone.trim()
  const fullName = `${cleanFirstName} ${cleanLastName}`.trim()

  if (!cleanFirstName || !cleanLastName) {
    setSaveStatus('error')
    alert('Ingresa nombres y apellidos antes de guardar.')
    return
  }

  const nextProfile = {
    id: user.id,
    email: user.email ?? null,
    full_name: fullName,
    first_name: cleanFirstName,
    last_name: cleanLastName,
    phone: cleanPhone || null,
    role: user.role,
  }

  storeProfile(user.id, nextProfile)

  const { data: savedProfile, error } = await supabase
    .from('profiles')
    .upsert(nextProfile, { onConflict: 'id' })
    .select('*')
    .single()

  if (error) {
    console.error('Error guardando perfil:', error.message)
    setSaveStatus('error')
    alert(`Error al guardar los datos: ${error.message}`)
    return
  }

  const safeProfile = savedProfile as ParticipantProfileRow
  const resolvedFullName = resolveProfileFullName(safeProfile, user.email) || fullName

  setParticipantProfile({
    ...safeProfile,
    full_name: resolvedFullName,
    first_name: safeProfile.first_name || cleanFirstName,
    last_name: safeProfile.last_name || cleanLastName,
    phone: safeProfile.phone || cleanPhone,
  })

  setParticipantFirstName(safeProfile.first_name || cleanFirstName)
  setParticipantLastName(safeProfile.last_name || cleanLastName)
  setParticipantPhone(safeProfile.phone || cleanPhone)

  setUser((prev) =>
    prev
      ? {
          ...prev,
          fullName: resolvedFullName,
          email: safeProfile.email ?? prev.email,
          role: safeProfile.role === 'admin' ? 'admin' : prev.role,
        }
      : prev
  )

  setIsEditingParticipantProfile(false)
  setSaveStatus('success')

  setTimeout(() => {
    setSaveStatus('idle')
  }, 3000)
}
async function loadPersonalRank(userId: string) {
  setPersonalRankLoading(true)

  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .order('total_points', { ascending: false })
    .order('exact_hits', { ascending: false })
    .order('outcome_hits', { ascending: false })

  if (error) {
    console.error('Error cargando ranking personal:', error.message)
    setPersonalRank({
      position: null,
      total_points: 0,
      exact_hits: 0,
      outcome_hits: 0,
    })
    setPersonalRankLoading(false)
    return
  }

  const rows = (data as LeaderboardRow[]) ?? []
  const userRows = rows.filter((row) => row.user_id === userId)

  if (userRows.length === 0) {
    setPersonalRank({
      position: null,
      total_points: 0,
      exact_hits: 0,
      outcome_hits: 0,
    })
    setPersonalRankLoading(false)
    return
  }

  const bestRow = userRows[0]
  const position =
    rows.findIndex(
      (row) =>
        row.user_id === bestRow.user_id &&
        row.entry_id === bestRow.entry_id
    ) + 1

  setPersonalRank({
    position: position || null,
    total_points: bestRow.total_points ?? 0,
    exact_hits: bestRow.exact_hits ?? 0,
    outcome_hits: bestRow.outcome_hits ?? 0,
  })

  setPersonalRankLoading(false)
}
useEffect(() => {
  if (!user?.id) {
    setParticipantProfile(null)
    setPersonalRank({
      position: null,
      total_points: 0,
      exact_hits: 0,
      outcome_hits: 0,
    })
    return
  }

  loadParticipantProfile(user.id)
  loadPersonalRank(user.id)
}, [user?.id])

useEffect(() => {
  setParticipantFirstName(participantProfile?.first_name || '')
  setParticipantLastName(participantProfile?.last_name || '')
  setParticipantPhone(participantProfile?.phone || '')
}, [participantProfile])

useEffect(() => {
  if (isParticipantEditLocked && isEditingParticipantProfile) {
    setIsEditingParticipantProfile(false)
  }
}, [isParticipantEditLocked, isEditingParticipantProfile])
useEffect(() => {
  if (!user?.id) return

  const refreshRank = () => {
    loadPersonalRank(user.id)
  }

  const channel = supabase
    .channel(`personal-rank-${user.id}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'predictions' },
      refreshRank
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'matches' },
      refreshRank
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'entries' },
      refreshRank
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [user?.id])

  useEffect(() => {
    let mounted = true

    const loadUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) return

      if (!session?.user) {
        setUser(null)
        return
      }

      const authUser = session.user

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (!mounted) return

      if (error) {
        console.error('Error cargando profile:', error.message)
        setUser({
          id: authUser.id,
          email: authUser.email ?? '',
          fullName: authUser.email ?? 'Jugador',
          role: 'player',
        })
        return
      }

      const resolvedEmail = (profile.email ?? authUser.email ?? '').toLowerCase()
const isForcedAdmin = resolvedEmail === 'rcantoral@cantoralabogados.com'

const storedProfile = getStoredProfile(profile.id)
let resolvedProfile = {
  ...profile,
  ...(storedProfile ?? {}),
}

const emailUserName = getEmailUserName(resolvedProfile.email ?? authUser.email)
const storedFullName = storedProfile?.full_name?.trim?.() || ''
const currentFullName = profile.full_name?.trim?.() || ''

if (
  storedProfile &&
  storedFullName &&
  (!currentFullName || currentFullName.toLowerCase() === emailUserName)
) {
  const { data: repairedProfile, error: repairError } = await supabase
    .from('profiles')
    .upsert(
      {
        id: profile.id,
        email: storedProfile.email ?? profile.email ?? authUser.email ?? null,
        full_name: storedProfile.full_name ?? null,
        first_name: storedProfile.first_name ?? null,
        last_name: storedProfile.last_name ?? null,
        phone: storedProfile.phone ?? null,
        role: isForcedAdmin ? 'admin' : storedProfile.role ?? profile.role ?? 'player',
      },
      { onConflict: 'id' }
    )
    .select('*')
    .single()

  if (!repairError && repairedProfile) {
    resolvedProfile = repairedProfile
  }
}

setUser({
  id: profile.id,
  email: resolvedProfile.email ?? authUser.email ?? '',
  fullName: resolveProfileFullName(resolvedProfile, authUser.email),
  role: isForcedAdmin ? 'admin' : (resolvedProfile.role ?? 'player'),
})
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadUser()
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const loadOrCreateEntry = async () => {
      if (!user?.id) {
        setActiveEntryId(null)
        setEntries([])
        return
      }

      const { data, error } = await supabase
        .from('entries')
        .select('id, name, is_active, payment_status, payment_amount, payment_method, payment_reference, paid_at')
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      if (error) {
        console.error('Error cargando quinielas:', error.message)
        return
      }

      if (data) {
        setEntries(data as EntryRow[])
      }

      const active = data?.find((e) => e.is_active)

if (active) {
  setActiveEntryId(active.id)
  return
}

if ((data?.length ?? 0) > 0) {
  setActiveEntryId(data?.[0]?.id ?? null)
  return
}

if (creatingDefaultEntryRef.current === user.id) {
  return
}

creatingDefaultEntryRef.current = user.id

const nextNumber = 1

const { data: inserted, error: insertError } = await supabase
  .from('entries')
  .insert([
    {
      user_id: user.id,
      name: `Mi quiniela ${nextNumber}`,
      is_active: true,
    },
  ])
  .select('id, name, is_active, payment_status, payment_amount, payment_method, payment_reference, paid_at')
  .single()

creatingDefaultEntryRef.current = null

      if (insertError) {
  creatingDefaultEntryRef.current = null
  console.error('Error creando quiniela activa:', insertError.message)
  return
}

      setActiveEntryId(inserted.id)
      setEntries([...(data ?? []), inserted as EntryRow])
    }

    loadOrCreateEntry()
  }, [user])

  useEffect(() => {
    if (!user?.id) return

    const refreshEntries = async () => {
      const { data, error } = await supabase
        .from('entries')
        .select('id, name, is_active, payment_status, payment_amount, payment_method, payment_reference, paid_at')
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      if (error) {
        console.error('Error refrescando quinielas:', error.message)
        return
      }

      const nextEntries = (data as EntryRow[]) ?? []
      setEntries(nextEntries)

      const active = nextEntries.find((entry) => entry.is_active)
      if (active) {
        setActiveEntryId(active.id)
      } else if (!activeEntryId && nextEntries.length > 0) {
        setActiveEntryId(nextEntries[0].id)
      }
    }

    const channel = supabase
      .channel(`entries-payment-refresh-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'entries',
          filter: `user_id=eq.${user.id}`,
        },
        refreshEntries
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, activeEntryId])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error(err)
    }

    setUser(null)
    openView('dashboard')
    setPredictions({})
    setActiveEntryId(null)
    setEntries([])
    window.location.href = '/'
  }

  const handleCreateEntry = async () => {
    if (!user?.id) return

    const nextEntryNumber = entries.length + 1
    const defaultName = `Mi quiniela ${nextEntryNumber}`
    const name = prompt('Nombre de la nueva quiniela', defaultName)

    if (!name) return

    const { data, error } = await supabase
      .from('entries')
      .insert([
        {
          user_id: user.id,
          name,
          is_active: true,
        },
      ])
      .select('id, name, is_active, payment_status, payment_amount, payment_method, payment_reference, paid_at')
      .single()

    if (error) {
      alert(error.message)
      return
    }

    await supabase
      .from('entries')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .neq('id', data.id)

    const { data: entriesData, error: refreshError } = await supabase
      .from('entries')
      .select('id, name, is_active, payment_status, payment_amount, payment_method, payment_reference, paid_at')
      .eq('user_id', user.id)
      .order('name', { ascending: true })

    if (refreshError) {
      alert(refreshError.message)
      return
    }

    setActiveEntryId(data.id)
    setEntries((entriesData as EntryRow[]) ?? [])
  }

  const handleChangeActiveEntry = async (entryId: string) => {
    if (!user?.id) return

    const previousId = activeEntryId
    setActiveEntryId(entryId)

    const { error: deactivateError } = await supabase
      .from('entries')
      .update({ is_active: false })
      .eq('user_id', user.id)

    if (deactivateError) {
      console.error(deactivateError.message)
      setActiveEntryId(previousId ?? null)
      return
    }

    const { error: activateError } = await supabase
      .from('entries')
      .update({ is_active: true })
      .eq('id', entryId)

    if (activateError) {
      console.error(activateError.message)
      setActiveEntryId(previousId ?? null)
      return
    }

    const { data } = await supabase
      .from('entries')
      .select('id, name, is_active, payment_status, payment_amount, payment_method, payment_reference, paid_at')
      .eq('user_id', user.id)
      .order('name', { ascending: true })

    if (data) {
      setEntries(data as EntryRow[])
    }

    setPredictions({})
  }
  const handleDeleteActiveEntry = async () => {
  if (!user?.id || !activeEntryId) return

  if (entries.length <= 1) {
    alert('Debes conservar al menos una quiniela.')
    return
  }

  const activeEntry = entries.find((entry) => entry.id === activeEntryId)
  const confirmed = window.confirm(
    `¿Seguro que quieres borrar la quiniela "${activeEntry?.name || 'actual'}"?`
  )

  if (!confirmed) return

  const { error } = await supabase
    .from('entries')
    .delete()
    .eq('id', activeEntryId)

  if (error) {
    alert(`No se pudo borrar la quiniela: ${error.message}`)
    return
  }

  const remainingEntries = entries.filter((entry) => entry.id !== activeEntryId)

  const nextActiveId = remainingEntries[0]?.id ?? null

  if (nextActiveId) {
    await supabase
      .from('entries')
      .update({ is_active: false })
      .eq('user_id', user.id)

    await supabase
      .from('entries')
      .update({ is_active: true })
      .eq('id', nextActiveId)
  }

  const { data: refreshedEntries, error: refreshError } = await supabase
    .from('entries')
    .select('id, name, is_active, payment_status, payment_amount, payment_method, payment_reference, paid_at')
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  if (refreshError) {
    alert(`La quiniela se borró, pero hubo un error al refrescar: ${refreshError.message}`)
    return
  }

  setEntries((refreshedEntries as EntryRow[]) ?? [])
  setActiveEntryId(nextActiveId)
  setPredictions({})
}
  const activeEntry = entries.find((entry) => entry.id === activeEntryId) ?? null
  const activeEntryPaymentStatus = activeEntry?.payment_status ?? 'pending'
  const activeEntryPaymentAmount = Number(activeEntry?.payment_amount ?? 0)
  const activeEntryPendingAmount = Math.max(ENTRY_PRICE - activeEntryPaymentAmount, 0)

  if (!user) {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-black text-white">
      <div className="absolute inset-0 z-0 flex items-start justify-center overflow-hidden">
        <img
          src="/landing-bg.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none w-full min-w-full select-none object-top md:h-full md:w-auto md:min-w-0 md:max-w-none md:object-contain"
        />
      </div>

      <div className="absolute inset-0 z-10 bg-black/25" />
      <div className="absolute inset-x-0 bottom-0 z-10 h-[46vh] bg-gradient-to-t from-black via-black/85 to-transparent" />

<section className="relative z-20 flex min-h-screen w-full flex-col items-center justify-end px-6 pb-20 text-center md:px-16 md:pb-0">
        <div className="w-full max-w-3xl md:translate-y-[8px]">
          <p className="mx-auto mb-4 w-full max-w-[360px] bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-700 bg-clip-text text-base font-bold leading-relaxed text-transparent drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] sm:max-w-xl sm:text-lg md:max-w-2xl md:text-xl md:leading-snug">
            Tu pasión. Tus números. Tu suerte. <br />
            Vive la emoción del fútbol como nunca antes, con nuestra ya tradicional quiniela.
          </p>

          <form
            onSubmit={handleLandingAuth}
            className="mx-auto w-full max-w-md rounded-2xl border border-yellow-400/20 bg-black/70 p-6 shadow-2xl backdrop-blur-xl md:max-w-[430px] md:p-5"
          >
            <h2 className="mb-2 text-xl font-bold text-white md:text-2xl">
              {landingIsRegister ? 'Crear cuenta' : 'Iniciar sesión'}
            </h2>

            <p className="mb-6 text-sm text-white/60 md:mb-4">
              {landingIsRegister
                ? 'Registra tu usuario con tus datos'
                : 'Entra con tu correo y contraseña'}
            </p>

            {landingIsRegister && (
              <>
                <input
                  type="text"
                  placeholder="Nombres"
                  value={landingFirstName}
                  onChange={(e) => setLandingFirstName(e.target.value)}
                  className="mb-4 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none"
                />

                <input
                  type="text"
                  placeholder="Apellidos"
                  value={landingLastName}
                  onChange={(e) => setLandingLastName(e.target.value)}
                  className="mb-4 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none"
                />

                <input
                  type="tel"
                  placeholder="Teléfono"
                  value={landingPhone}
                  onChange={(e) => setLandingPhone(e.target.value)}
                  className="mb-4 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none"
                />
              </>
            )}

            <input
              type="email"
              placeholder="tu@email.com"
              value={landingEmail}
              onChange={(e) => setLandingEmail(e.target.value)}
              required
              className="mb-4 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none"
            />

            <input
              type="password"
              placeholder="Contraseña"
              value={landingPassword}
              onChange={(e) => setLandingPassword(e.target.value)}
              required
              className="mb-4 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none"
            />

            <button
              type="submit"
              disabled={landingLoading}
              className="w-full rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-600 py-3 font-bold text-black shadow-[0_0_25px_rgba(250,204,21,0.25)] transition hover:scale-[1.02] disabled:opacity-50"
            >
              {landingLoading
                ? landingIsRegister
                  ? 'Creando cuenta...'
                  : 'Entrando...'
                : landingIsRegister
                  ? 'Crear cuenta'
                  : 'Entrar'}
            </button>

            {!landingIsRegister && (
              <button
                type="button"
                onClick={handleForgotPassword}
                className="mt-3 w-full text-sm font-semibold text-yellow-300 transition hover:text-yellow-200"
              >
                Olvidé mi contraseña
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setLandingIsRegister(!landingIsRegister)
                setLandingError('')
                setLandingMessage('')
                setLandingFirstName('')
                setLandingLastName('')
                setLandingPhone('')
              }}
              className="mt-4 w-full text-sm text-white/60 hover:text-white"
            >
              {landingIsRegister
                ? 'Ya tengo cuenta, quiero iniciar sesión'
                : 'No tengo cuenta, quiero registrarme'}
            </button>

            {landingMessage && (
              <p className="mt-4 text-center text-sm text-emerald-300">
                {landingMessage}
              </p>
            )}

            {landingError && (
              <p className="mt-4 text-center text-sm text-red-300">
                {landingError}
              </p>
            )}
          </form>
        </div>
      </section>
    </main>
  )
}

  if (view === 'picks') {
  return (
    <PicksScreen
      activeEntryId={activeEntryId}
      activeEntryPaymentStatus={activeEntryPaymentStatus}
      predictions={predictions}
      setPredictions={setPredictions}
      onBack={() => openView('dashboard')}
      user={user}
    />
  )
}

if (view === 'leaderboard') {
  return <LeaderboardScreen currentUser={user} onBack={() => openView('dashboard')} />
}

if (view === 'public') {
  return (
    <PublicPicksScreen
      user={user}
      onBack={() => openView('dashboard')}
    />
  )
}

if (view === 'public-by-participant') {
  return (
    <PublicPicksByParticipantScreen
      user={user}
      onBack={() => openView('dashboard')}
      onOpenEntry={(entryId) => {
        setSelectedEntryId(entryId)
        openView('entry-detail')
      }}
    />
  )
}

if (view === 'entry-detail') {
  if (!selectedEntryId) {
    return (
      <main className="min-h-screen bg-black px-6 py-8 text-white md:px-10">
        <div className="mx-auto max-w-5xl">
          <button
            onClick={() => openView('public-by-participant')}
            className="mb-6 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white shadow-lg backdrop-blur transition hover:bg-white/20 active:scale-[0.98]"
          >
            ← Volver
          </button>

          <div className="rounded-3xl border border-red-400/20 bg-red-400/10 p-6">
            <p className="text-lg font-semibold text-white">
              No hay una quiniela seleccionada
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <EntryDetailScreen
      entryId={selectedEntryId}
      onBack={() => openView('public-by-participant')}
    />
  )
}
if (view === 'participant-data') {
  const isEditingLocked = isParticipantEditLocked

  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-6xl">
        <button
          onClick={() => openView('dashboard')}
          className="mb-6 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white shadow-lg backdrop-blur transition hover:bg-white/20 active:scale-[0.98]"
        >
          ← Volver
        </button>

        <section className="rounded-3xl border border-yellow-500/20 bg-white/5 p-8 shadow-xl">
          <h1 className="text-3xl font-bold text-yellow-400 md:text-5xl">
            Datos del Participante
          </h1>

          <p className="mt-3 text-sm text-white/65">
  Aquí podrás ver y editar tus datos personales hasta el cierre oficial de captura.
</p>

<p className="mt-2 text-xs uppercase tracking-[0.18em] text-white/45">
  Cierre de edición: 11 de junio 2026 · 10:00 AM (CDMX)
</p>

        </section>
<section className="mt-8 grid gap-4 md:grid-cols-4">
  <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl">
    <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
      Tu posición
    </p>
    <p className="mt-2 text-3xl font-bold text-yellow-400">
      {personalRankLoading ? '...' : personalRank.position ?? '—'}
    </p>
  </div>

  <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl">
    <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
      Puntos Totales
    </p>
    <p className="mt-2 text-3xl font-bold text-white">
      {personalRankLoading ? '...' : personalRank.total_points}
    </p>
  </div>

  <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 shadow-xl">
    <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/70">
      Marcadores Exactos
    </p>
    <p className="mt-2 text-3xl font-bold text-emerald-100">
      {personalRankLoading ? '...' : personalRank.exact_hits}
    </p>
  </div>

  <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 shadow-xl">
    <p className="text-[11px] uppercase tracking-[0.22em] text-amber-200/70">
      Aciertos
    </p>
    <p className="mt-2 text-3xl font-bold text-amber-100">
      {personalRankLoading ? '...' : personalRank.outcome_hits}
    </p>
  </div>
</section>
        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <h2 className="text-xl font-bold text-yellow-400">
    Información personal
  </h2>

{saveStatus === 'error' && (
  <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200">
    Error al guardar los datos ❌
  </div>
)}

  <div className="flex items-center gap-3">
    <button
      type="button"
      disabled={isEditingLocked}
      onClick={() => {
  const next = !isEditingParticipantProfile
  setIsEditingParticipantProfile(next)

  if (next) {
    // Cuando entra en modo edición → limpiar campos
    setParticipantFirstName('')
    setParticipantLastName('')
    setParticipantPhone('')
  }
}}
      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
        isEditingLocked
          ? 'cursor-not-allowed border border-white/10 bg-white/5 text-white/35'
          : isEditingParticipantProfile
            ? 'border border-white/15 bg-white/10 text-white hover:bg-white/15'
            : 'border border-yellow-400/30 bg-yellow-400/10 text-yellow-200 hover:bg-yellow-400/15'
      }`}
    >
      {isEditingParticipantProfile ? 'Cancelar' : 'Editar datos'}
    </button>

    {isEditingParticipantProfile && !isEditingLocked && (
      <button
        type="button"
        onClick={saveParticipantProfile}
        className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/15"
      >
        Guardar cambios
      </button>
    )}
  </div>
</div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <input
  value={
    isEditingParticipantProfile
      ? `${participantFirstName} ${participantLastName}`.trim()
      : participantProfile?.full_name || user?.fullName || ''
  }
  readOnly
  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white"
/>

            <input
              value={participantProfile?.email || user?.email || ''}
              readOnly
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white"
            />

            <input
  value={isEditingParticipantProfile ? participantFirstName : participantProfile?.first_name || ''}
  onChange={(e) => setParticipantFirstName(e.target.value)}
  readOnly={!isEditingParticipantProfile || isEditingLocked}
  placeholder="Nombres"
  className={`w-full rounded-2xl border px-4 py-3 text-white outline-none transition ${
    isEditingParticipantProfile && !isEditingLocked
      ? 'border-yellow-400/30 bg-black/40 focus:border-yellow-400/50'
      : 'border-white/10 bg-black/30'
  }`}
 />

            <input
  value={isEditingParticipantProfile ? participantLastName : participantProfile?.last_name || ''}
  onChange={(e) => setParticipantLastName(e.target.value)}
  readOnly={!isEditingParticipantProfile || isEditingLocked}
  placeholder="Apellidos"
  className={`w-full rounded-2xl border px-4 py-3 text-white outline-none transition ${
    isEditingParticipantProfile && !isEditingLocked
      ? 'border-yellow-400/30 bg-black/40 focus:border-yellow-400/50'
      : 'border-white/10 bg-black/30'
  }`}
 />

            <input
 value={isEditingParticipantProfile ? participantPhone : participantProfile?.phone || ''}
  onChange={(e) => setParticipantPhone(e.target.value)}
  readOnly={!isEditingParticipantProfile || isEditingLocked}
  placeholder="Teléfono"
  className={`w-full rounded-2xl border px-4 py-3 text-white outline-none transition ${
    isEditingParticipantProfile && !isEditingLocked
      ? 'border-yellow-400/30 bg-black/40 focus:border-yellow-400/50'
      : 'border-white/10 bg-black/30'
  }`}
 />

            <input
              value={participantProfile?.role || user?.role || ''}
              readOnly
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white"
            />
          </div>
        </section>
      </div>
    </main>
  )
}

if (view === 'admin') {
  if (user?.role !== 'admin') {
    return (
      <main className="min-h-screen bg-black px-6 py-8 text-white md:px-10">
        <div className="mx-auto max-w-5xl">
          <button
            onClick={() => openView('dashboard')}
            className="mb-6 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white shadow-lg backdrop-blur transition hover:bg-white/20 active:scale-[0.98]"
          >
            ← Volver
          </button>

          <div className="rounded-3xl border border-red-400/20 bg-red-400/10 p-6">
            <p className="text-lg font-semibold text-white">
              No tienes acceso a esta sección.
            </p>
          </div>
        </div>
      </main>
    )
  }

  return <AdminScreen onBack={() => openView('dashboard')} />
}
  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/[0.04] to-yellow-400/[0.04] p-4 shadow-2xl sm:p-5 md:p-6">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-yellow-400/30 bg-yellow-400/10 text-2xl shadow-[0_0_25px_rgba(250,204,21,0.16)]">
                ⚽
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-yellow-300/70">
                  Súper Quiniela 2026
                </p>
                <h1 className="truncate text-lg font-extrabold tracking-tight text-white sm:text-xl md:text-2xl">
                  Hola, {user.fullName ?? 'Usuario'}
                </h1>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full rounded-2xl border border-red-400/20 bg-red-400/10 px-6 py-3 text-base font-semibold text-red-200 shadow-lg transition hover:bg-red-400/20 active:scale-[0.98] sm:w-auto"
            >
              🚪 Cerrar sesión
            </button>
          </div>

          <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-stretch">
            <div
              className="relative min-h-[230px] overflow-hidden rounded-3xl border border-white/10 bg-cover bg-center shadow-xl sm:min-h-[280px] md:min-h-[420px]"
              style={{
                backgroundImage: "url('/messi.jpg')",
                backgroundPosition: 'center',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" />
              <div className="absolute left-0 top-0 h-[2px] w-40 bg-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.8)]" />

              <div className="relative z-10 flex h-full min-h-[230px] flex-col justify-end p-6 sm:min-h-[280px] md:min-h-[420px] md:p-10">
                <p className="mb-3 inline-flex w-fit rounded-full border border-yellow-400/25 bg-yellow-400/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-yellow-200">
                  Mundial 2026
                </p>

                <h2 className="text-3xl font-black tracking-tight text-yellow-400 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] sm:text-4xl md:text-6xl">
                  Súper Quiniela 2026
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 md:text-base">
                  Administra tus quinielas, revisa rankings y vive el torneo con toda la intensidad.
                </p>
              </div>
            </div>

            <aside className="flex h-full flex-col justify-between rounded-3xl border border-white/10 bg-black/35 p-5 shadow-xl backdrop-blur">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                      Usuario actual
                    </p>
                    <p className="mt-2 truncate text-base font-bold text-white">
                      {user.fullName ?? 'Usuario'}
                    </p>
                    <p className="mt-1 truncate text-xs text-white/55">{user.email ?? ''}</p>
                  </div>

                  <span className="shrink-0 rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-yellow-200">
                    {user.role}
                  </span>
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="mb-2 text-[11px] uppercase tracking-[0.22em] text-white/45">
                    Quiniela activa
                  </p>

                  <select
                    value={activeEntryId ?? ''}
                    onChange={(e) => handleChangeActiveEntry(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm font-semibold text-white outline-none transition focus:border-yellow-400/40"
                  >
                    {entries.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                        Estatus de pago
                      </p>
                      <p className="mt-2 text-sm font-bold text-white">
                        {getPaymentStatusLabel(activeEntryPaymentStatus)}
                      </p>
                    </div>

                    <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getPaymentStatusClass(activeEntryPaymentStatus)}`}>
                      {getPaymentStatusLabel(activeEntryPaymentStatus)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                        Pagado
                      </p>
                      <p className="mt-1 text-sm font-bold text-white">
                        {formatCurrencyMXN(activeEntryPaymentAmount)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                        Pendiente
                      </p>
                      <p className="mt-1 text-sm font-bold text-white">
                        {activeEntryPaymentStatus === 'paid' || activeEntryPaymentStatus === 'exempt'
                          ? formatCurrencyMXN(0)
                          : formatCurrencyMXN(activeEntryPendingAmount)}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs leading-5 text-white/50">
                    Límite de pago: 10 de junio de 2026 · 11:59 PM (CDMX).
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <button
                  onClick={handleCreateEntry}
                  className="w-full rounded-2xl border border-yellow-400/25 bg-yellow-400/10 px-4 py-3 text-sm font-bold text-yellow-100 transition hover:bg-yellow-400/15 active:scale-[0.99]"
                >
                  + Nueva quiniela
                </button>

                <button
                  onClick={handleDeleteActiveEntry}
                  disabled={entries.length <= 1}
                  className={`w-full rounded-2xl border px-4 py-3 text-sm font-bold transition active:scale-[0.99] ${
                    entries.length <= 1
                      ? 'cursor-not-allowed border-white/10 bg-white/5 text-white/35'
                      : 'border-red-400/20 bg-red-400/10 text-red-200 hover:bg-red-400/15'
                  }`}
                >
                  🗑 Borrar quiniela activa
                </button>
              </div>
            </aside>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
          {user.role === 'admin' && (
            <div className="order-1 md:order-7 md:col-span-2">
              <DashboardCard
                title="Panel de Administración"
                description="Solo para administradores"
                badge="Admin"
                onClick={() => openView('admin')}
              />
            </div>
          )}

          <div className={`${user.role === 'admin' ? 'order-7' : 'order-1'} md:order-1 md:contents`}>
            <DashboardCard
              title="Reglamento Oficial"
              description="Consulta las reglas, el sistema de puntos, las fechas importantes y los premios de la quiniela."
              badge="Info"
              onClick={() => router.push('/rules')}
            />
          </div>

          <div className={`${user.role === 'admin' ? 'order-3' : 'order-3'} md:order-2 md:contents`}>
            <DashboardCard
              title="Tabla general"
              description="Consulta posiciones, puntos acumulados y aciertos que cada Quiniela y participante."
              badge="Ranking"
              onClick={() => openView('leaderboard')}
            />
          </div>

          <div className={`${user.role === 'admin' ? 'order-2' : 'order-2'} md:order-3 md:contents`}>
            <DashboardCard
              title="Mi Quiniela"
              description="Aquí puedes acceder a tu Quiniela y llenar cada uno de tus marcadores. ¡Suerte!"
              badge="Jugador"
              onClick={() => openView('picks')}
            />
          </div>

          <div className={`${user.role === 'admin' ? 'order-6' : 'order-6'} md:order-4 md:contents`}>
            <DashboardCard
              title="Datos del Participante"
              description="Consulta y edita tus datos personales antes de que termine el countdown de tu quiniela."
              badge="Perfil"
              onClick={() => openView('participant-data')}
            />
          </div>

          <div className={`${user.role === 'admin' ? 'order-4' : 'order-4'} md:order-5 md:contents`}>
            <DashboardCard
              title="Ver todas las Quinielas por partido"
              description="Aqui podras ver lo que puso cada quien en su quiniela."
              badge="Público"
              onClick={() => openView('public')}
            />
          </div>

          <div className={`${user.role === 'admin' ? 'order-5' : 'order-5'} md:order-6 md:contents`}>
            <DashboardCard
              title="Ver todas las Quinielas por participante"
              description="Explora las quinielas agrupadas por participante y abre el detalle completo de cada una."
              badge="Público"
              onClick={() => openView('public-by-participant')}
            />
          </div>
        </section>
      </div>
    </main>
  )
}