'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/supabase'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) return
      setReady(Boolean(session))
    }

    checkSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleUpdatePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    setLoading(true)
    setMessage('')
    setError('')

    try {
      if (password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres.')
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

      setMessage('Contraseña actualizada correctamente. Ya puedes iniciar sesión.')
      setPassword('')
      setConfirmPassword('')

      setTimeout(() => {
        router.push('/')
      }, 1800)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo actualizar la contraseña.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 py-10 text-white">
      <div className="w-full max-w-md rounded-3xl border border-yellow-400/20 bg-white/5 p-6 shadow-2xl backdrop-blur md:p-8">
        <div className="mb-6 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-yellow-300/70">
            Súper Quiniela 2026
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-yellow-400">
            Nueva contraseña
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/60">
            Escribe tu nueva contraseña para recuperar el acceso a tu cuenta.
          </p>
        </div>

        {!ready && (
          <div className="mb-5 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-3 text-sm leading-6 text-yellow-100">
            Si abriste esta página sin venir desde el correo de recuperación, primero solicita el enlace desde “Olvidé mi contraseña”.
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <input
            type="password"
            placeholder="Nueva contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition focus:border-yellow-400/40"
          />

          <input
            type="password"
            placeholder="Confirmar contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition focus:border-yellow-400/40"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-to-r from-yellow-400 to-yellow-600 px-5 py-3 font-black text-black shadow-[0_0_25px_rgba(250,204,21,0.22)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Actualizando...' : 'Actualizar contraseña'}
          </button>
        </form>

        {message && (
          <p className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-center text-sm font-semibold text-emerald-200">
            {message}
          </p>
        )}

        {error && (
          <p className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-center text-sm font-semibold text-red-200">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => router.push('/')}
          className="mt-5 w-full text-sm font-semibold text-white/55 transition hover:text-white"
        >
          Volver al inicio de sesión
        </button>
      </div>
    </main>
  )
}
