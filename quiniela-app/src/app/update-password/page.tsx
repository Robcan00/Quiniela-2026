'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/supabase'

export default function UpdatePasswordPage() {
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [sessionReady, setSessionReady] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const passwordScore = useMemo(() => {
    let score = 0
    if (password.length >= 8) score += 1
    if (/[A-Z]/.test(password)) score += 1
    if (/[0-9]/.test(password)) score += 1
    if (/[^A-Za-z0-9]/.test(password)) score += 1
    return score
  }, [password])

  const passwordStrength = useMemo(() => {
    if (!password) return { label: 'Sin contraseña', className: 'bg-white/10 text-white/50', width: '0%' }
    if (passwordScore <= 1) return { label: 'Débil', className: 'bg-red-400/20 text-red-200', width: '25%' }
    if (passwordScore === 2) return { label: 'Media', className: 'bg-amber-400/20 text-amber-200', width: '50%' }
    if (passwordScore === 3) return { label: 'Buena', className: 'bg-yellow-400/20 text-yellow-200', width: '75%' }
    return { label: 'Fuerte', className: 'bg-emerald-400/20 text-emerald-200', width: '100%' }
  }, [password, passwordScore])

  useEffect(() => {
    const handleRecoverySession = async () => {
      setCheckingSession(true)
      setError('')

      try {
        const hash = window.location.hash
        const query = window.location.search

        if (hash) {
          const params = new URLSearchParams(hash.replace('#', ''))
          const access_token = params.get('access_token')
          const refresh_token = params.get('refresh_token')
          const type = params.get('type')

          if (access_token && refresh_token && type === 'recovery') {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            })

            if (sessionError) throw sessionError

            window.history.replaceState({}, document.title, '/update-password')
            setSessionReady(true)
            setCheckingSession(false)
            return
          }
        }

        if (query) {
          const params = new URLSearchParams(query)
          const code = params.get('code')

          if (code) {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

            if (exchangeError) throw exchangeError

            window.history.replaceState({}, document.title, '/update-password')
            setSessionReady(true)
            setCheckingSession(false)
            return
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession()

        setSessionReady(Boolean(session))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo validar el enlace.'
        setError(msg)
        setSessionReady(false)
      } finally {
        setCheckingSession(false)
      }
    }

    handleRecoverySession()
  }, [])

  const handleUpdatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    setLoading(true)
    setMessage('')
    setError('')

    try {
      if (!sessionReady) {
        setError('El enlace no tiene sesión válida. Solicita un nuevo correo de recuperación.')
        return
      }

      if (password.length < 8) {
        setError('La contraseña debe tener al menos 8 caracteres.')
        return
      }

      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden.')
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) throw updateError

      setMessage('Contraseña actualizada correctamente. Entrando a tu cuenta...')

      setTimeout(() => {
        router.push('/')
        router.refresh()
      }, 1400)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo actualizar la contraseña.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-3xl items-center justify-center">
        <section className="w-full rounded-[2rem] border border-yellow-400/25 bg-white/[0.04] p-6 shadow-[0_0_45px_rgba(250,204,21,0.10)] sm:p-8 md:p-10">
          <div className="text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.32em] text-yellow-400/80">
              Súper Quiniela 2026
            </p>

            <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-3xl border border-yellow-400/30 bg-yellow-400/10 text-3xl shadow-[0_0_28px_rgba(250,204,21,0.16)]">
              🔐
            </div>

            <h1 className="mt-6 text-4xl font-black tracking-tight text-yellow-400 sm:text-5xl">
              Nueva contraseña
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-white/60">
              Crea una nueva contraseña segura. Al actualizarla, entrarás automáticamente a tu cuenta.
            </p>
          </div>

          {checkingSession ? (
            <div className="mt-8 rounded-3xl border border-white/10 bg-black/35 p-6 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-yellow-400" />
              <p className="mt-4 text-sm font-semibold text-white/70">
                Validando enlace de recuperación...
              </p>
            </div>
          ) : (
            <>
              {!sessionReady && (
                <div className="mt-8 rounded-3xl border border-red-400/20 bg-red-400/10 p-5">
                  <p className="text-sm font-bold leading-6 text-red-200">
                    Este enlace no tiene una sesión válida o ya expiró. Vuelve al inicio de sesión y solicita un nuevo correo desde “Olvidé mi contraseña”.
                  </p>
                </div>
              )}

              {sessionReady && (
                <div className="mt-8 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5">
                  <p className="text-sm font-bold leading-6 text-emerald-200">
                    Enlace validado correctamente. Ya puedes crear tu nueva contraseña.
                  </p>
                </div>
              )}

              <form onSubmit={handleUpdatePassword} className="mt-8 space-y-5">
                <div>
                  <input
                    type="password"
                    placeholder="Nueva contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={!sessionReady || loading}
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-4 text-lg font-semibold text-white outline-none transition placeholder:text-white/35 focus:border-yellow-400/40 disabled:cursor-not-allowed disabled:opacity-40"
                  />

                  <div className="mt-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-yellow-400 transition-all"
                      style={{ width: passwordStrength.width }}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${passwordStrength.className}`}>
                      {passwordStrength.label}
                    </span>

                    <p className="text-xs text-white/45">
                      Mínimo 8 caracteres
                    </p>
                  </div>
                </div>

                <input
                  type="password"
                  placeholder="Confirmar contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={!sessionReady || loading}
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-4 text-lg font-semibold text-white outline-none transition placeholder:text-white/35 focus:border-yellow-400/40 disabled:cursor-not-allowed disabled:opacity-40"
                />

                <button
                  type="submit"
                  disabled={!sessionReady || loading}
                  className="w-full rounded-2xl bg-gradient-to-r from-yellow-400 to-yellow-600 px-6 py-4 text-lg font-black text-black shadow-[0_0_28px_rgba(250,204,21,0.22)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                >
                  {loading ? 'Actualizando...' : 'Actualizar contraseña'}
                </button>
              </form>

              {message && (
                <div className="mt-6 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 text-center">
                  <p className="text-sm font-bold text-emerald-200">
                    {message}
                  </p>
                </div>
              )}

              {error && (
                <div className="mt-6 rounded-3xl border border-red-400/20 bg-red-400/10 p-5 text-center">
                  <p className="text-sm font-bold text-red-200">
                    {error}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => router.push('/')}
                className="mt-8 w-full text-sm font-bold text-white/45 transition hover:text-yellow-300"
              >
                Volver al inicio de sesión
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  )
}