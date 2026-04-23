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
}

type OfficialResult = {
  homeScore: string
  awayScore: string
}

type MatchState = {
  isOpen: boolean
  isFinished: boolean
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
type PersonalRankInfo = {
  position: number | null
  total_points: number
  exact_hits: number
  outcome_hits: number
}

const MATCHES: Match[] = groupStageMatches

function DashboardCard({ title, description, badge, onClick }: DashboardCardProps) {
  return (
    <div
  className="rounded-3xl border border-yellow-400/20 bg-white/5 p-5 shadow-xl transition hover:bg-yellow-400/10 hover:border-yellow-400/40 hover:shadow-[0_0_30px_rgba(250,204,21,0.25)]"
>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-xl md:text-2xl font-bold tracking-tight text-yellow-400">
  {title}
</h3>
        {badge && (
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
            {badge}
          </span>
        )}
      </div>

      <p className="mt-3 text-sm leading-6 text-white/65">{description}</p>

      <button
        onClick={onClick}
        className="mt-5 w-full rounded-xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-white/90"
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
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'predictions' },
    loadLeaderboard
  )
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'matches' },
    loadLeaderboard
  )
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'entries' },
    loadLeaderboard
  )
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'profiles' },
    loadLeaderboard
  )
  .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [])

  const currentUserPosition =
    rows.findIndex((row) => row.user_id === currentUser?.id) + 1 || null

  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <button
          onClick={onBack}
          className="mb-6 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/70 transition hover:bg-white/10"
        >
          ← Volver a Menu Principal
        </button>

        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.03] p-6 shadow-2xl md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>

              <h1 className="text-3xl font-bold tracking-tight text-yellow-400 md:text-5xl">
  Tabla General de Resultados
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 md:text-base">
                Ranking general por quiniela, mostrando jugador, nombre de quiniela y puntos acumulados.
              </p>
            </div>

            <div className="grid min-w-[280px] grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                  Quinielas
                </p>
                <p className="mt-2 text-sm font-semibold text-white">{rows.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                  Tu posición
                </p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {currentUserPosition || '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
        {rows.length > 0 && (
  <div className="mt-6 rounded-3xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 via-transparent to-yellow-500/5 p-6 shadow-[0_0_40px_rgba(250,204,21,0.15)]">
    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-yellow-400/40 bg-yellow-400/10 text-3xl shadow-[0_0_25px_rgba(250,204,21,0.4)]">
          🥇
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-yellow-300/70">
            Líder actual
          </p>
          <h2 className="mt-1 text-2xl font-bold text-white">
            {rows[0].full_name || 'Participante'}
          </h2>
          <p className="text-sm text-yellow-300">
            {rows[0].entry_name || 'Quiniela'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:min-w-[220px]">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
            Puntos
          </p>
          <p className="mt-2 text-2xl font-bold text-yellow-400">
            {rows[0].total_points}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
            Exactos
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {rows[0].exact_hits}
          </p>
        </div>
      </div>
    </div>
  </div>
)}

        <div className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
          <div className="grid grid-cols-[90px_1.2fr_1.2fr_150px_150px_120px] border-b border-yellow-500/20 bg-yellow-500/5 px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-yellow-400">
  <div>Posición</div>
  <div>Jugador</div>
  <div>Quiniela</div>
  <div className="text-center">Puntos Totales</div>
  <div className="text-center">Marcadores Exactos</div>
  <div className="text-center">Aciertos</div>
</div>

          {loading ? (
            <div className="px-6 py-10 text-sm text-white/60">Cargando leaderboard...</div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-10">
              <p className="text-lg font-semibold">Todavía no hay puntos calculados</p>
              <p className="mt-2 text-sm leading-6 text-white/65">
                En cuanto captures resultados oficiales y existan picks guardados, aparecerán aquí.
              </p>
            </div>
          ) : (
            rows.map((row, index) => {
              const isCurrentUser = row.user_id === currentUser?.id

              return (
                <div
                  key={row.entry_id ?? `${row.user_id}-${index}`}
                  className={`grid grid-cols-[90px_1.2fr_1.2fr_150px_150px_120px] items-center border-b border-white/10 px-6 py-4 text-sm ${
                    isCurrentUser ? 'bg-emerald-400/10' : 'bg-transparent'
                  }`}
                >
                  <div className="flex items-center justify-center">
  {index === 0 ? (
    <span className="text-3xl md:text-4xl drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]">
      🥇
    </span>
  ) : index === 1 ? (
    <span className="text-3xl md:text-4xl drop-shadow-[0_0_12px_rgba(226,232,240,0.5)]">
      🥈
    </span>
  ) : index === 2 ? (
    <span className="text-3xl md:text-4xl drop-shadow-[0_0_12px_rgba(180,83,9,0.5)]">
      🥉
    </span>
  ) : (
    <span className="text-sm font-bold text-yellow-400">
      #{index + 1}
    </span>
  )}
</div>
                  <div>
                    <p className="font-semibold text-white">{row.full_name || 'Participante'}</p>
                    <p className="text-xs text-white/45">
                      {isCurrentUser ? 'Tu usuario actual' : 'Jugador'}
                    </p>
                  </div>
                  <div className="font-semibold text-white">{row.entry_name || 'Quiniela'}</div>
                  <div className="text-center font-semibold text-white">{row.total_points}</div>
<div className="text-center text-white/80">{row.exact_hits}</div>
<div className="text-center text-white/80">{row.outcome_hits}</div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </main>
  )
}

function PicksScreen({
  activeEntryId,
  predictions,
  setPredictions,
  onBack,
}: {
  activeEntryId: string | null
  predictions: Record<string, Prediction>
  setPredictions: React.Dispatch<React.SetStateAction<Record<string, Prediction>>>
  onBack: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [officialResults, setOfficialResults] = useState<Record<string, OfficialResult>>({})
  const [matchStates, setMatchStates] = useState<Record<string, MatchState>>({})

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
      row.home_score_predicted === 0 ? '' : String(row.home_score_predicted),
    awayScore:
      row.away_score_predicted === 0 ? '' : String(row.away_score_predicted),
  }
})

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

    setPredictions((prev) => ({
      ...prev,
      [matchId]: {
        homeScore: side === 'homeScore' ? value : prev[matchId]?.homeScore ?? '',
        awayScore: side === 'awayScore' ? value : prev[matchId]?.awayScore ?? '',
      },
    }))
  }

  const handleSave = async () => {
    if (!activeEntryId) {
      alert('No hay quiniela activa')
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
        }))

      if (rows.length === 0) {
        alert('No hay pronósticos para guardar')
        setSaving(false)
        return
      }

      const { error } = await supabase
        .from('predictions')
        .upsert(rows, { onConflict: 'entry_id,match_id' })

      if (error) {
        alert(`Error al guardar: ${error.message}`)
      } else {
        alert('Pronósticos guardados 🔥')
      }
    } catch (err) {
      console.error(err)
      alert('Error inesperado al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <button
              onClick={onBack}
              className="mb-4 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/70 transition hover:bg-white/10"
            >
              ← Volver a Menu Principal
            </button>

            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
              Fase de grupos
            </h1>
           <p className="mt-3 max-w-none text-sm leading-6 text-white/70 md:text-base">
  A continuación ingresa tu pronóstico de marcador para cada uno de los partidos. 
  Mucha suerte y no te olvides de darle al botón de guardar!
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
  <p className="mt-3 text-sm font-bold text-red-400 underline">
    La captura de pronósticos ya está cerrada. Todos los marcadores no ingresados se tomarán como “0”.
  </p>
)}
  {isGlobalLock && (
  <p className="mt-3 text-sm font-bold text-red-400 underline">
    La captura de pronósticos ya está cerrada. Todos los marcadores no ingresados se tomarán como “0”.
  </p>
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
                      className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl transition hover:bg-white/[0.07] hover:border-white/20"
  >
                
                      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
                        <div className="min-w-0 flex flex-col justify-center">
                          <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                            {match.kickoff}
                          </p>

                          <div className="mt-4 mx-auto grid w-full max-w-4xl grid-cols-[1fr_120px_1fr] items-center gap-6">
                            <div className="flex items-center justify-center gap-4">
  <div className="overflow-hidden rounded-xl border border-white/10 bg-white/10">
    <Image
      src={match.homeFlagUrl}
      alt={match.homeTeam}
      width={56}
      height={40}
      className="h-10 w-14 object-cover"
    />
  </div>
  <div className="text-left">
    <div className="text-xs uppercase tracking-[0.2em] text-white/40">
      {match.homeCode}
    </div>
    <span className="text-2xl font-bold tracking-tight">{match.homeTeam}</span>
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
    <span className="text-2xl font-bold tracking-tight">
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

                          <div className="flex items-center justify-end pr-4 gap-3">
                            <input
  type="text"
  inputMode="numeric"
  value={current.homeScore}
  placeholder=""
  onChange={(e) =>
    handleChange(match.id, 'homeScore', e.target.value)
  }
  className="h-14 w-16 rounded-2xl border border-white/10 bg-white/10 text-center text-xl font-bold text-white outline-none transition disabled:opacity-30 disabled:cursor-not-allowed"
/>
                            <span className="text-lg font-semibold text-white/50">-</span>
                            <input
  type="text"
  inputMode="numeric"
  value={current.awayScore}
  placeholder=""
  onChange={(e) =>
    handleChange(match.id, 'awayScore', e.target.value)
  }
  className="h-14 w-16 rounded-2xl border border-white/10 bg-white/10 text-center text-xl font-bold text-white outline-none transition disabled:opacity-30 disabled:cursor-not-allowed"
/>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}

                <div className="mt-6 flex justify-end">
  <div className="w-[250px]">
    <button
  onClick={handleSave}
  disabled={saving || isGlobalLock}
      className="w-full rounded-2xl bg-white px-6 py-4 text-base font-bold text-black transition hover:bg-white/90 disabled:opacity-50"
    >
      {saving ? 'Guardando...' : isGlobalLock ? 'Cerrado' : 'Guardar'}
    </button>
  </div>
</div>
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
            row.home_score == null || row.home_score === 0 ? '' : String(row.home_score),
          awayScore:
            row.away_score == null || row.away_score === 0 ? '' : String(row.away_score),
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

    loadMatchesMeta()
    loadUsers()

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
        loadUsers
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

    if (!current || current.homeScore === '' || current.awayScore === '') {
      alert('Falta capturar ambos marcadores')
      return
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

  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <button
          onClick={onBack}
          className="mb-6 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/70 transition hover:bg-white/10"
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

        <div className="mt-8 space-y-8">
          {Object.entries(groupedMatches).map(([groupName, matches]) => (
            <section key={groupName}>
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-2xl font-semibold">{groupName}</h2>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/60">
                  {matches.length} partidos
                </span>
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
                                value={current.homeScore === '0' ? '' : current.homeScore}
                                onChange={(e) =>
                                  updateResult(match.id, 'homeScore', e.target.value)
                                }
                                className="h-14 w-16 rounded-2xl border border-white/10 bg-white/10 text-center text-xl font-bold text-white outline-none transition disabled:opacity-30 disabled:cursor-not-allowed"
                                placeholder=""
                              />
                              <span className="text-lg font-semibold text-white/50">-</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={current.awayScore === '0' ? '' : current.awayScore}
                                onChange={(e) =>
                                  updateResult(match.id, 'awayScore', e.target.value)
                                }
                                className="h-14 w-16 rounded-2xl border border-white/10 bg-white/10 text-center text-xl font-bold text-white outline-none transition disabled:opacity-30 disabled:cursor-not-allowed"
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
          <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-yellow-400">
                Participantes
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Elimina participantes junto con sus quinielas y picks.
              </p>
            </div>

            <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/70">
              {users.length} usuarios
            </span>
          </div>

          {usersLoading ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4 text-white/60">
              Cargando participantes...
            </div>
          ) : users.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4 text-white/60">
              No hay participantes registrados.
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

  useEffect(() => {
  const load = async () => {
    const { data, error } = await supabase
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
      `)

    if (error) {
      console.error(error.message)
      setLoading(false)
      return
    }

    setRows(data ?? [])
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
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [])

  const groupedByMatch = useMemo(() => {
  const grouped: Record<string, any[]> = {}

  rows.forEach((row) => {
    if (!grouped[row.match_id]) grouped[row.match_id] = []
    grouped[row.match_id].push(row)
  })

  const sortedEntries = Object.entries(grouped).sort(([matchIdA], [matchIdB]) => {
    const matchA = MATCHES.find((match) => match.id === matchIdA)
    const matchB = MATCHES.find((match) => match.id === matchIdB)

    const dateA = matchA ? parseKickoffToDate(matchA.kickoff)?.getTime() ?? 0 : 0
    const dateB = matchB ? parseKickoffToDate(matchB.kickoff)?.getTime() ?? 0 : 0

    return dateA - dateB
  })

  return Object.fromEntries(sortedEntries)
}, [rows])

 const getMatchById = (matchId: string) => {
  return MATCHES.find((match) => match.id === matchId)
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

return (
  <main className="min-h-screen bg-black px-6 py-8 text-white md:px-10">
    <div className="mx-auto max-w-7xl">
      <button
        onClick={onBack}
        className="mb-6 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 hover:bg-white/10"
      >
        ← Volver
      </button>

            <div className="relative overflow-hidden rounded-3xl border border-yellow-500/40 bg-black/95 p-8 shadow-[0_0_30px_rgba(234,179,8,0.15)] md:p-10">
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-transparent to-yellow-500/5" />
        <div className="absolute left-0 top-0 h-[2px] w-40 bg-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.8)]" />

        <div className="relative z-10 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-yellow-400 md:text-6xl">
              Todas las Quinielas
            </h1>

            <p className="mt-4 max-w-3xl text-lg text-white/80">
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

              return (
  <section
    key={matchId}
    className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl"
  >
    <div className="mb-8">
  <p className="text-xs uppercase tracking-[0.18em] text-white/45">
    {match?.kickoff}
  </p>

  <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-10">
    <div className="flex items-center justify-end gap-4">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/10">
        <Image
          src={match?.homeFlagUrl ?? '/favicon.ico'}
          alt={match?.homeTeam ?? ''}
          width={64}
          height={44}
          className="h-11 w-16 object-cover"
        />
      </div>

      <div className="text-left">
        <div className="text-sm uppercase tracking-[0.2em] text-emerald-300/80">
          {match?.homeCode}
        </div>
        <span className="text-4xl font-extrabold text-white">
          {match?.homeTeam}
        </span>
      </div>
    </div>

    <div className="flex items-center justify-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xl font-semibold text-white/70">
        VS
      </div>
    </div>

    <div className="flex items-center justify-start gap-4">
      <div className="text-right">
        <div className="text-sm uppercase tracking-[0.2em] text-emerald-300/80">
          {match?.awayCode}
        </div>
        <span className="text-4xl font-extrabold text-white">
          {match?.awayTeam}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/10">
        <Image
          src={match?.awayFlagUrl ?? '/favicon.ico'}
          alt={match?.awayTeam ?? ''}
          width={64}
          height={44}
          className="h-11 w-16 object-cover"
        />
      </div>
    </div>
  </div>
</div>

    <div className="overflow-hidden rounded-2xl border border-white/10">
      <div className="grid grid-cols-[1.5fr_1fr_120px] border-b border-yellow-500/20 bg-yellow-500/5 px-4 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-yellow-400">
        <div>Jugador</div>
        <div>Quiniela</div>
        <div className="text-right">Pick</div>
      </div>

      {picks.map((row, index) => {
  const isMe = row.entries?.profiles?.email === user?.email

  return (
    <div
      key={`${row.entries?.id}-${index}`}
      className={`grid grid-cols-[1.5fr_1fr_120px] items-center border-b px-4 py-5 text-sm last:border-b-0 ${
  isMe
    ? 'bg-emerald-400/10 border-emerald-400/20'
    : 'border-yellow-500/10 bg-emerald-950/40'
}`}
    >
          <div className="flex items-center gap-4">
  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-yellow-500/20 bg-white/5 text-xl text-yellow-400">
    👤
  </div>

  <div>
    <p className="font-semibold text-white">
      {row.entries?.profiles?.full_name || 'Jugador'}
    </p>
    <p className="text-xs text-white/45">
      {row.entries?.profiles?.email || ''}
    </p>
  </div>
</div>

          <div className="font-medium text-white/85">
            {row.entries?.name}
          </div>

          <div
  className={`inline-block rounded-xl px-3 py-1 text-right text-2xl font-bold ${getResultStyle(
    row,
    match
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

  useEffect(() => {
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

    if (!selectedUserId && safeRows.length > 0) {
      setSelectedUserId(safeRows[0].user_id)
    }

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
}, [selectedUserId])

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

    return Array.from(map.values())
  }, [rows])

  const selectedParticipant =
    participants.find((participant) => participant.user_id === selectedUserId) ?? null

  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <button
          onClick={onBack}
          className="mb-6 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 transition hover:bg-white/10"
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
          <section className="mt-8 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
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
                          <p className="mt-1 text-xs text-white/45">
                            {participant.email || 'Sin email visible'}
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
                    {selectedParticipant?.full_name || 'Participante'}
                  </p>
                </div>

                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                  {selectedParticipant?.entries.length ?? 0} registros
                </span>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {selectedParticipant?.entries.map((entry) => (
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
      <main className="min-h-screen bg-black px-6 py-8 text-white md:px-10">
        <div className="mx-auto max-w-7xl">
          <button
            onClick={onBack}
            className="mb-6 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 hover:bg-white/10"
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
      <main className="min-h-screen bg-black px-6 py-8 text-white md:px-10">
        <div className="mx-auto max-w-7xl">
          <button
            onClick={onBack}
            className="mb-6 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 hover:bg-white/10"
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
    <main className="min-h-screen bg-black px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <button
          onClick={onBack}
          className="mb-6 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 transition hover:bg-white/10"
        >
          ← Volver
        </button>

        <section className="relative overflow-hidden rounded-3xl border border-yellow-500/40 bg-black/95 p-8 shadow-[0_0_30px_rgba(234,179,8,0.15)] md:p-10">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-transparent to-yellow-500/5" />
          <div className="absolute left-0 top-0 h-[2px] w-40 bg-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.8)]" />

          <div className="relative z-10 grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-end">
  <div className="max-w-4xl">
    <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-white md:text-6xl xl:text-7xl">
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
                      className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl transition hover:bg-white/[0.07] hover:border-white/20"
                    >
                      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                            {match.kickoff}
                          </p>

                          <div className="mt-4 mx-auto grid w-full max-w-4xl grid-cols-[1fr_120px_1fr] items-center gap-6">
                            <div className="flex items-center justify-center gap-4">
                              <div className="overflow-hidden rounded-xl border border-white/10 bg-white/10">
                                <Image
                                  src={match.homeFlagUrl}
                                  alt={match.homeTeam}
                                  width={56}
                                  height={40}
                                  className="h-10 w-14 object-cover"
                                />
                              </div>

                              <div className="text-left">
                                <div className="text-xs uppercase tracking-[0.2em] text-white/40">
                                  {match.homeCode}
                                </div>
                                <span className="text-2xl font-bold tracking-tight">
                                  {match.homeTeam}
                                </span>
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
                                <span className="text-2xl font-bold tracking-tight">
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
    <div className="flex h-14 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-center text-xl font-bold text-white">
      {prediction.homeScore || '—'}
    </div>

    <span className="text-lg font-semibold text-white/50">-</span>

    <div className="flex h-14 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-center text-xl font-bold text-white">
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
  const [view, setView] = useState<ViewMode>('dashboard')
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
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

if (!profileData) {
  setParticipantProfile(null)
  setParticipantProfileLoading(false)
  return
}

const fullNameParts = (profileData.full_name || '').trim().split(/\s+/).filter(Boolean)
const inferredFirstName = profileData.first_name || fullNameParts.slice(0, -2).join(' ') || fullNameParts[0] || ''
const inferredLastName = profileData.last_name || fullNameParts.slice(-2).join(' ') || ''

setParticipantProfile({
  ...profileData,
  first_name: inferredFirstName,
  last_name: inferredLastName,
  phone: profileData.phone || '',
})

setParticipantProfileLoading(false)
}
async function saveParticipantProfile() {
  if (!user?.id) return

  const fullName = `${participantFirstName} ${participantLastName}`.trim()

  const updates = {
    id: user.id,
    full_name: fullName,
  }

  const { error } = await supabase
    .from('profiles')
    .upsert(updates)

  if (error) {
    console.error('Error guardando perfil:', error.message)
    alert('Error al guardar los datos')
    return
  }

  setParticipantProfile((prev) => ({
    ...(prev ?? {
      id: user.id,
      email: user.email ?? '',
      role: user.role,
    }),
    full_name: fullName,
    first_name: participantFirstName,
    last_name: participantLastName,
    phone: participantPhone,
  }) as ParticipantProfileRow)

  setUser((prev) =>
  prev
    ? {
        ...prev,
        fullName,
        email: prev.email,
        role: prev.role,
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

setUser({
  id: profile.id,
  email: profile.email ?? authUser.email ?? '',
  fullName: profile.full_name ?? authUser.email ?? 'Jugador',
  role: isForcedAdmin ? 'admin' : (profile.role ?? 'player'),
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
        .select('id, name, is_active')
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
  .select('id, name, is_active')
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

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error(err)
    }

    setUser(null)
    setView('dashboard')
    setPredictions({})
    setActiveEntryId(null)
    setEntries([])
    window.location.href = '/login'
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
      .select('id, name, is_active')
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
      .select('id, name, is_active')
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
      .select('id, name, is_active')
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
    .select('id, name, is_active')
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
  if (!user) {
  return (
    <div
      className="relative min-h-screen w-full overflow-hidden bg-black"
      style={{
        backgroundImage: "url('/landing-bg.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/10" />

      <button
  onClick={() => router.push('/login')}
  className="absolute left-1/2 top-[64%] z-20 h-[100px] w-[438px] -translate-x-1/2 rounded-[24px] bg-transparent text-transparent"
>
  Ir a login
</button>
    </div>
  )
}

  if (view === 'picks') {
  return (
    <PicksScreen
      activeEntryId={activeEntryId}
      predictions={predictions}
      setPredictions={setPredictions}
      onBack={() => setView('dashboard')}
    />
  )
}

if (view === 'leaderboard') {
  return <LeaderboardScreen currentUser={user} onBack={() => setView('dashboard')} />
}

if (view === 'public') {
  return (
    <PublicPicksScreen
      user={user}
      onBack={() => setView('dashboard')}
    />
  )
}

if (view === 'public-by-participant') {
  return (
    <PublicPicksByParticipantScreen
      user={user}
      onBack={() => setView('dashboard')}
      onOpenEntry={(entryId) => {
        setSelectedEntryId(entryId)
        setView('entry-detail')
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
            onClick={() => setView('public-by-participant')}
            className="mb-6 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 hover:bg-white/10"
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
      onBack={() => setView('public-by-participant')}
    />
  )
}
if (view === 'participant-data') {
  const isEditingLocked = isParticipantEditLocked

  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-6xl">
        <button
          onClick={() => setView('dashboard')}
          className="mb-6 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 transition hover:bg-white/10"
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
  {saveStatus === 'success' && (
  <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200">
    Datos guardados correctamente ✅
  </div>
)}

{saveStatus === 'error' && (
  <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200">
    Error al guardar los datos ❌
  </div>
)}

  <div className="flex items-center gap-3">
    <button
      type="button"
      disabled={isEditingLocked}
      onClick={() => setIsEditingParticipantProfile((prev) => !prev)}
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
  value={participantFirstName}
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
  value={participantLastName}
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
  value={participantPhone}
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
  return <AdminScreen onBack={() => setView('dashboard')} />
}
  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex justify-end mb-4">
          <button
            onClick={handleLogout}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.03] p-6 shadow-2xl md:p-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] items-center">
            <div>
              <div
  className="relative min-h-[420px] overflow-hidden rounded-3xl border border-white/10 bg-cover bg-center"
  style={{
  backgroundImage: "url('/messi.jpg')",
  backgroundSize: '110%',
  backgroundPosition: 'center',
}}
>
  <div className="relative z-10 h-full p-8 md:p-10">
    <div>
      <h2 className="absolute right-20 top-[250%] -translate-y-1/2 text-3xl md:text-5xl font-bold tracking-tight text-yellow-400">
  Súper Quiniela 2026
</h2>
    </div>

    <div>
    </div>
  </div>
</div>
              
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 w-full max-w-sm">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                Usuario actual
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                {user.fullName ?? 'Usuario'}
              </p>
              <p className="mt-1 text-xs text-white/55">{user.email ?? ''}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/45">
                Rol: {user.role}
              </p>

              <div className="mt-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/45 mb-2">
                  Quiniela activa
                </p>

                <select
                  value={activeEntryId ?? ''}
                  onChange={(e) => handleChangeActiveEntry(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                >
                  {entries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleCreateEntry}
                  className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition hover:bg-white/10"
                >
                  + Nueva quiniela
                </button>
                <button
  onClick={handleDeleteActiveEntry}
  disabled={entries.length <= 1}
  className={`mt-3 w-full rounded-xl border px-3 py-2 text-sm transition ${
    entries.length <= 1
      ? 'cursor-not-allowed border-white/10 bg-white/5 text-white/35'
      : 'border-red-400/20 bg-red-400/10 text-red-200 hover:bg-red-400/15'
  }`}
>
  🗑 Borrar quiniela activa
</button>
              </div>
            </div>
          </div>
        </div>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
  <div className="flex flex-col gap-4">
    <DashboardCard
      title="Mi Quiniela"
      description="Aquí puedes acceder a tu Quiniela y llenar cada uno de tus marcadores. ¡Suerte!"
      badge="Jugador"
      onClick={() => setView('picks')}
    />

    <DashboardCard
      title="Ver todas las Quinielas por partido"
      description="Aqui podras ver lo que puso cada quien en su quiniela."
      badge="Público"
      onClick={() => setView('public')}
    />

    <DashboardCard
      title="Ver todas las Quinielas por participante"
      description="Explora las quinielas agrupadas por participante y abre el detalle completo de cada una."
      badge="Público"
      onClick={() => setView('public-by-participant')}
    />
  </div>

  <div className="flex flex-col gap-4">
    <DashboardCard
      title="Tabla general"
      description="Consulta posiciones, puntos acumulados y aciertos que cada Quiniela y participante."
      badge="Ranking"
      onClick={() => setView('leaderboard')}
    />

    <DashboardCard
      title="Datos del Participante"
      description="Consulta y edita tus datos personales antes de que termine el countdown de tu quiniela."
      badge="Perfil"
      onClick={() => setView('participant-data')}
    />

    <DashboardCard
      title="Panel de Administración"
      description="Solo para administradores, no seas chismoso!"
      badge="Admin"
      onClick={() => setView('admin')}
    />
  </div>
</section>
      </div>
    </main>
  )
}