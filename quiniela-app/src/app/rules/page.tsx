'use client'

import type { ComponentType, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Target,
  Users,
  Star,
  Clock3,
  ClipboardCheck,
  BarChart3,
  Wallet,
  Landmark,
  CalendarClock,
  Trophy,
  CheckCircle2,
  XCircle,
  CircleDollarSign,
  Scale,
  BadgeDollarSign,
  Handshake,
  Sparkles,
} from 'lucide-react'

type IconType = ComponentType<{ className?: string }>

function NumberBadge({ number }: { number: string }) {
  return (
    <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl border border-[#4a3910] bg-[#111827]/90 px-2 text-sm font-black text-[#f0c24e] shadow-[0_0_0_1px_rgba(240,194,78,0.06)]">
      {number}
    </span>
  )
}

function SectionCard({
  number,
  title,
  icon: Icon,
  children,
  className = '',
}: {
  number: string
  title: string
  icon: IconType
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-[28px] border border-white/10 bg-[rgba(7,13,24,0.82)] shadow-[0_18px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl ${className}`}
    >
      <div className="p-5 md:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#f0c24e]/20 bg-gradient-to-br from-[#1a2436] to-[#0b1320] text-[#f0c24e] shadow-[0_0_20px_rgba(240,194,78,0.18)]">
            <Icon className="h-7 w-7 stroke-[2.2]" />
          </div>

          <NumberBadge number={number} />

          <h2 className="text-xl font-black uppercase tracking-tight text-white md:text-[30px] md:leading-none">
            {title}
          </h2>
        </div>

        <div className="space-y-4 text-[16px] leading-7 text-zinc-100 md:text-[17px]">
          {children}
        </div>
      </div>
    </section>
  )
}

function DotList({
  items,
  color = 'bg-[#f0c24e]',
}: {
  items: ReactNode[]
  color?: string
}) {
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className={`mt-[11px] h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function OrderedRule({
  n,
  children,
}: {
  n: string
  children: ReactNode
}) {
  return (
    <li className="flex gap-3">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0c24e] text-sm font-black text-black">
        {n}
      </span>
      <span className="pt-[2px]">{children}</span>
    </li>
  )
}

function ScoreRow({
  icon,
  title,
  description,
  points,
  tone,
}: {
  icon: ReactNode
  title: string
  description: string
  points: string
  tone: 'green' | 'yellow' | 'red'
}) {
  const styles = {
    green: 'border-green-500/35 bg-green-500/5 text-green-400',
    yellow: 'border-yellow-500/35 bg-yellow-500/5 text-yellow-300',
    red: 'border-red-500/35 bg-red-500/5 text-red-400',
  }

  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-[22px] border p-4 md:p-5 ${styles[tone]}`}
    >
      <div className="flex items-start gap-4">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div>
          <div className="text-lg font-black uppercase tracking-tight">{title}</div>
          <div className="mt-1 text-sm leading-6 text-zinc-100 md:text-[15px]">
            {description}
          </div>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="text-4xl font-black leading-none">{points}</div>
        <div className="mt-1 text-sm font-bold uppercase tracking-wide">puntos</div>
      </div>
    </div>
  )
}

function StatPill({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
      <div className="text-sm text-zinc-400">{label}</div>
      <div className="mt-1 text-base font-bold text-white md:text-lg">{value}</div>
    </div>
  )
}

export default function RulesPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#07101c] text-white">
      <div className="relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(240,194,78,0.16),transparent_24%),radial-gradient(circle_at_80%_0%,rgba(240,194,78,0.16),transparent_24%),linear-gradient(180deg,#050b14_0%,#07101c_30%,#08111f_100%)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.85)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.85)_1px,transparent_1px)] [background-size:34px_34px]" />

        <div className="pointer-events-none absolute left-[-160px] top-[80px] h-[320px] w-[420px] rotate-[-10deg] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0.09)_18%,rgba(255,255,255,0.04)_34%,transparent_62%)] blur-[8px]" />
        <div className="pointer-events-none absolute right-[-140px] top-[70px] h-[320px] w-[420px] rotate-[10deg] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0.09)_18%,rgba(255,255,255,0.04)_34%,transparent_62%)] blur-[8px]" />

        <div className="pointer-events-none absolute left-[12%] top-[130px] h-2 w-2 rounded-full bg-[#f0c24e]/80 shadow-[0_0_20px_rgba(240,194,78,0.6)]" />
        <div className="pointer-events-none absolute left-[20%] top-[220px] h-1.5 w-6 rotate-12 rounded-full bg-[#f0c24e]/55" />
        <div className="pointer-events-none absolute left-[28%] top-[120px] h-1.5 w-4 -rotate-12 rounded-full bg-[#f0c24e]/55" />
        <div className="pointer-events-none absolute right-[18%] top-[140px] h-2 w-2 rounded-full bg-[#f0c24e]/80 shadow-[0_0_20px_rgba(240,194,78,0.6)]" />
        <div className="pointer-events-none absolute right-[28%] top-[210px] h-1.5 w-6 -rotate-12 rounded-full bg-[#f0c24e]/55" />
        <div className="pointer-events-none absolute right-[34%] top-[110px] h-1.5 w-4 rotate-12 rounded-full bg-[#f0c24e]/55" />

        <div className="relative mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-2xl border border-[#f0c24e]/15 bg-black/25 px-4 py-2.5 text-sm font-bold text-[#f0c24e] shadow-[0_12px_30px_rgba(0,0,0,0.25)] transition hover:border-[#f0c24e]/35 hover:bg-white/5"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>

          <div className="relative mt-4 overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,24,0.78)_0%,rgba(9,14,24,0.55)_100%)] px-4 pb-8 pt-8 shadow-[0_25px_90px_rgba(0,0,0,0.4)] sm:px-8 lg:px-10">
            <div className="absolute inset-x-0 bottom-0 h-24 bg-[radial-gradient(ellipse_at_center,rgba(240,194,78,0.18)_0%,rgba(240,194,78,0.08)_28%,transparent_62%)]" />

            <div className="grid items-center gap-8 lg:grid-cols-[1fr_280px]">
              <div className="text-center lg:text-left">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-[#f0c24e]/20 bg-[#111a29] text-[#f0c24e] shadow-[0_0_40px_rgba(240,194,78,0.16)] lg:mx-0">
                  <Trophy className="h-10 w-10 stroke-[2.2]" />
                </div>

                <h1 className="text-[44px] font-black uppercase leading-[0.95] tracking-tight text-white sm:text-[58px] lg:text-[72px]">
                  Reglamento Oficial
                </h1>

                <p className="mt-2 text-[40px] font-black uppercase leading-[0.95] tracking-tight text-[#f0c24e] sm:text-[54px] lg:text-[76px]">
                  Superquiniela Mundial 2026
                </p>

                <p className="mx-auto mt-6 max-w-4xl text-base leading-7 text-zinc-200 sm:text-lg lg:mx-0 lg:max-w-3xl lg:text-[28px] lg:leading-10">
                  Conoce las reglas de la competencia, el sistema de puntos, las fechas
                  importantes, las cuotas y la forma en que se repartirán los premios.
                </p>
              </div>

              <div className="relative hidden h-full min-h-[280px] lg:block">
                <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(240,194,78,0.16)_0%,rgba(240,194,78,0.05)_32%,transparent_65%)] blur-xl" />
                <div className="absolute bottom-0 right-0 left-0 flex items-end justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-[#f0c24e]/10 blur-3xl" />
                    <Trophy className="relative h-[260px] w-[260px] text-[#f0c24e] drop-shadow-[0_0_20px_rgba(240,194,78,0.45)]" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-7 rounded-[30px] border border-[#f0c24e]/20 bg-gradient-to-br from-[#171f2e] to-[#0b1320] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] md:p-6">
            <div className="flex items-center justify-center gap-2 text-center">
              <Sparkles className="h-5 w-5 text-[#f0c24e]" />
              <h2 className="text-xl font-black text-[#f0c24e] md:text-2xl">
                Reglas clave
              </h2>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <StatPill label="Cierre de picks" value="11 jun 2026 · 10:00 AM" />
              <StatPill label="Pago límite" value="10 jun 2026 · 10:00 AM" />
              <StatPill label="Costo por quiniela" value="$2,700 MXN" />
              <StatPill label="Bolsa mínima garantizada" value="$500,000 MXN" />
            </div>
          </div>

          <div className="mt-7 grid gap-6 lg:grid-cols-2">
            <SectionCard number="1" title="Objetivo" icon={Target}>
              <p>
                La Superquiniela Mundial 2026 es una competencia en la que los
                participantes realizan pronósticos sobre los resultados de los
                partidos de la <span className="font-black text-[#f0c24e]">fase de grupos</span> del
                Mundial 2026, acumulando puntos de acuerdo con la precisión de sus
                predicciones.
              </p>
              <p>El objetivo es obtener la mayor cantidad de puntos durante dicha fase.</p>
            </SectionCard>

            <SectionCard number="2" title="Participantes" icon={Users}>
              <DotList
                items={[
                  <>
                    Para participar, es necesario registrarse en la plataforma{' '}
                    <span className="font-black text-[#f0c24e]">www.superquiniela2026.com</span>.
                  </>,
                  <>Cada participante puede registrar una o varias quinielas activas.</>,
                  <>Cada quiniela compite de forma independiente.</>,
                ]}
              />
            </SectionCard>

            <SectionCard number="3" title="Sistema de puntos" icon={Star}>
              <div className="space-y-4">
                <ScoreRow
                  tone="green"
                  icon={<CheckCircle2 className="h-8 w-8 stroke-[2.5]" />}
                  title="Marcador exacto"
                  description="Si el participante acierta el marcador exacto."
                  points="+3"
                />
                <ScoreRow
                  tone="yellow"
                  icon={<Trophy className="h-8 w-8 stroke-[2.5]" />}
                  title="Resultado correcto"
                  description="Si el participante acierta al equipo ganador o al empate, sin acertar el marcador exacto."
                  points="+1"
                />
                <ScoreRow
                  tone="red"
                  icon={<XCircle className="h-8 w-8 stroke-[2.5]" />}
                  title="Resultado incorrecto"
                  description="Si no acierta ni el marcador ni el resultado."
                  points="0"
                />
              </div>

            </SectionCard>

            <SectionCard number="4" title="Deadline de picks" icon={Clock3}>
              <p>
                Todos los picks deberán registrarse antes de las{' '}
                <span className="font-black text-[#ff6a57]">
                  10:00 AM (hora de la CDMX) del 11 de junio de 2026
                </span>
                , es decir, dos horas antes del inicio del primer partido del torneo.
              </p>

              <div className="rounded-[22px] border border-red-500/35 bg-red-500/5 p-4 md:p-5">
                <div className="text-sm font-black uppercase tracking-wide text-red-400">
                  Reglas aplicables después del deadline:
                </div>
                <ul className="mt-3 space-y-2 text-zinc-100">
                  <li>❌ No se pueden modificar picks.</li>
                  <li>❌ No se pueden agregar nuevos picks.</li>
                  <li>❌ No pueden ingresar nuevos participantes.</li>
                  <li>❌ No se pueden agregar nuevas quinielas.</li>
                </ul>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4 text-zinc-100">
                Cualquier marcador no registrado antes del deadline se considerará como <span className="font-black text-white">0 puntos</span>.
              </div>
            </SectionCard>

            <SectionCard number="5" title="Registro de resultados" icon={ClipboardCheck}>
              <DotList
                items={[
                  <>Los resultados oficiales de cada partido serán cargados por el administrador.</>,
                  <>Una vez cargados, los puntos se calcularán automáticamente.</>,
                  <>La Tabla General se actualizará en tiempo real.</>,
                ]}
              />
            </SectionCard>

            <SectionCard number="6" title="Tabla General" icon={BarChart3}>
              <p>Los participantes se ordenarán conforme a los siguientes criterios:</p>
              <ol className="space-y-3">
                <OrderedRule n="1">Total de puntos.</OrderedRule>
                <OrderedRule n="2">Número de aciertos exactos.</OrderedRule>
              </ol>
            </SectionCard>

            <SectionCard number="7" title="Cuota de ingreso" icon={Wallet}>
              <p>
                La cuota de ingreso por cada quiniela es de <span className="font-black text-[#6fe58b]">$2,700.00 MXN</span>, de los cuales <span className="font-bold text-white">$2,500.00 MXN</span> integrarán la bolsa acumulada y <span className="font-bold text-white">$200.00 MXN</span> se destinarán a gastos de organización, implementación y administración.
              </p>

              <div className="rounded-[22px] border border-green-500/35 bg-green-500/5 p-5">
                <div className="text-sm uppercase tracking-wide text-zinc-300">Cuota por quiniela</div>
                <div className="mt-1 text-4xl font-black text-[#6fe58b]">$2,700.00 MXN</div>
              </div>
            </SectionCard>

            <SectionCard number="8" title="Bolsa mínima garantizada" icon={Landmark}>
              <div className="rounded-[22px] border border-[#f0c24e]/35 bg-[#f0c24e]/5 p-5 text-center">
                <div className="text-sm uppercase tracking-wide text-zinc-400">Bolsa mínima garantizada</div>
                <div className="mt-2 text-4xl font-black text-[#f0c24e]">$500,000.00 MXN</div>
              </div>

              <div className="rounded-[22px] border border-[#f0c24e]/25 bg-gradient-to-br from-[#f0c24e]/10 via-white/[0.03] to-transparent p-5 shadow-lg">
                <span className="inline-block rounded-full bg-[#f0c24e]/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#f0c24e]">
                  Importante
                </span>

                <h3 className="mt-3 text-sm font-black uppercase tracking-[0.18em] text-[#f0c24e]">
                  ¿Qué significa bolsa garantizada?
                </h3>

                <p className="mt-3 text-sm leading-6 text-zinc-100">
                  La bolsa garantizada representa el monto mínimo que se repartirá entre los ganadores, independientemente del número de participantes inscritos en la quiniela.
                </p>
              </div>
            </SectionCard>

            <SectionCard number="9" title="Fecha límite de pago" icon={CalendarClock} className="lg:col-span-2">
              <div className="rounded-[22px] border border-red-500/35 bg-red-500/5 p-5">
                <div className="text-base font-black uppercase tracking-wide text-red-400">Deadline de pago</div>
                <div className="mt-1 text-2xl font-black text-white">10:00 AM (hora de la CDMX)</div>
                <div className="text-zinc-100">10 de junio de 2026</div>
              </div>

              <p>
                Antes de esa fecha, cada jugador deberá cubrir la cuota de ingreso correspondiente al número de quinielas registradas.
              </p>

              <div className="rounded-[22px] border border-white/10 bg-white/5 p-5">
                <div className="grid gap-2 text-zinc-100 sm:grid-cols-2">
                  <div>1 quiniela</div>
                  <div className="font-bold">$2,700.00 MXN</div>
                  <div>2 quinielas</div>
                  <div className="font-bold">$5,400.00 MXN</div>
                  <div>3 quinielas</div>
                  <div className="font-bold">$10,800.00 MXN</div>
                  <div>Y así sucesivamente</div>
                  <div className="font-bold">Pago proporcional</div>
                </div>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-white/5 p-5">
                <DotList
                  color="bg-[#94a3b8]"
                  items={[
                    <>Las quinielas que no estén debidamente pagadas al cumplirse el deadline serán descalificadas y no podrán recibir premio alguno.</>,
                    <>Si un jugador registra más de una quiniela y no cubre todas las cuotas, se tomarán como válidas únicamente las quinielas pagadas, en orden cronológico. Las restantes quedarán descalificadas.</>,
                  ]}
                />
              </div>
            </SectionCard>

            <SectionCard number="10" title="Premios" icon={CircleDollarSign} className="lg:col-span-2">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[22px] border border-[#f0c24e]/35 bg-[#f0c24e]/5 p-5 text-center">
                  <div className="text-4xl">🥇</div>
                  <div className="mt-2 text-lg font-black text-white">Primer lugar</div>
                  <div className="mt-1 text-4xl font-black text-[#f0c24e]">70%</div>
                  <div className="text-zinc-300">de la bolsa acumulada</div>
                </div>

                <div className="rounded-[22px] border border-white/10 bg-white/5 p-5 text-center">
                  <div className="text-4xl">🥈</div>
                  <div className="mt-2 text-lg font-black text-white">Segundo lugar</div>
                  <div className="mt-1 text-4xl font-black text-white">20%</div>
                  <div className="text-zinc-300">de la bolsa acumulada</div>
                </div>

                <div className="rounded-[22px] border border-orange-500/35 bg-orange-500/5 p-5 text-center">
                  <div className="text-4xl">🥉</div>
                  <div className="mt-2 text-lg font-black text-white">Tercer lugar</div>
                  <div className="mt-1 text-4xl font-black text-orange-300">10%</div>
                  <div className="text-zinc-300">de la bolsa acumulada</div>
                </div>
              </div>

              <div className="mt-4 rounded-[22px] border border-white/10 bg-white/5 p-5">
                <div className="mb-3 flex items-center gap-2 text-lg font-black text-white">
                  <Scale className="h-5 w-5 text-[#f0c24e]" />
                  Desempates
                </div>

                <ol className="space-y-3">
                  <OrderedRule n="1">Mayor número de marcadores exactos.</OrderedRule>
                  <OrderedRule n="2">Mayor número de resultados correctos.</OrderedRule>
                </ol>
              </div>

              <div className="mt-4 rounded-[22px] border border-white/10 bg-white/5 p-5">
                <div className="text-lg font-black text-white">Ejemplo</div>
                <p className="mt-3 text-zinc-100">
                  Si las quinielas A, B y C empatan en primer lugar, se aplicarán los criterios de desempate. Si la quiniela C obtiene más marcadores exactos, quedará en primer lugar y recibirá el 70% de la bolsa acumulada; la quiniela A quedará en segundo lugar y recibirá el 20%; y la quiniela B quedará en tercer lugar y recibirá el 10%.
                </p>
                <p className="mt-3 text-zinc-100">
                  Las demás quinielas recorrerán sus posiciones conforme al resultado final del desempate.
                </p>
              </div>

              <div className="mt-4 rounded-[22px] border border-green-500/35 bg-green-500/5 p-5 text-zinc-100">
                Los premios se entregarán mediante transferencia electrónica o en efectivo dentro de las 72 horas siguientes a la conclusión de la fase de grupos del Mundial, previa coordinación con los ganadores.
              </div>
            </SectionCard>

            <SectionCard number="11" title="Aceptación de reglas" icon={Handshake} className="lg:col-span-2">
              <p>
                La participación en la Superquiniela Mundial 2026 implica la aceptación total del presente reglamento.
              </p>
            </SectionCard>
          </div>

          <div className="mt-8 rounded-[28px] border border-[#f0c24e]/20 bg-gradient-to-r from-[#111927] to-[#0b1320] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#f0c24e]/25 bg-[#131c2b] text-[#f0c24e]">
                  <BadgeDollarSign className="h-7 w-7" />
                </div>
                <div>
                  <div className="text-xl font-black text-[#f0c24e]">
                    Gracias por ser parte de la Superquiniela Mundial 2026
                  </div>
                  <div className="text-zinc-300">
                    Juega con responsabilidad y disfruta la emoción del Mundial.
                  </div>
                </div>
              </div>

              <div className="text-[#f0c24e]">
                <Trophy className="h-10 w-10" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}