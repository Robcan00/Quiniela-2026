'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/supabase'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isRegister, setIsRegister] = useState(false)

  async function upsertProfile(userId: string, userEmail: string) {
    const cleanFirstName = firstName.trim()
    const cleanLastName = lastName.trim()
    const cleanPhone = phone.trim()

    const resolvedFullName =
      `${cleanFirstName} ${cleanLastName}`.trim() ||
      userEmail.split('@')[0].replace(/[._-]+/g, ' ')

    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      email: userEmail,
      full_name: resolvedFullName,
      first_name: cleanFirstName || null,
      last_name: cleanLastName || null,
      phone: cleanPhone || null,
      role: 'player',
    })

    if (error) {
      throw error
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    try {
      if (isRegister) {
        if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
          setError('Por favor ingresa nombres, apellidos y teléfono.')
          setLoading(false)
          return
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })

        if (error) throw error

        if (data.user) {
          await upsertProfile(data.user.id, data.user.email || email)
        }

        setMessage('Cuenta creada. Ahora inicia sesión.')
        setIsRegister(false)
        setFirstName('')
        setLastName('')
        setPhone('')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        if (data.user) {
          await upsertProfile(data.user.id, data.user.email || email)
        }

        router.push('/')
        router.refresh()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ocurrió un error'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl">
        <h1 className="text-2xl font-bold mb-2">
          {isRegister ? 'Crear cuenta' : 'Iniciar sesión'}
        </h1>

        <p className="text-sm text-zinc-400 mb-6">
          {isRegister
            ? 'Registra tu usuario con correo y contraseña'
            : 'Entra con tu correo y contraseña'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <input
                type="text"
                placeholder="Nombres"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
              />

              <input
                type="text"
                placeholder="Apellidos"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
              />

              <input
                type="tel"
                placeholder="Teléfono"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
              />
            </>
          )}

          <input
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-white text-black py-3 font-medium disabled:opacity-50"
          >
            {loading
              ? isRegister
                ? 'Creando cuenta...'
                : 'Entrando...'
              : isRegister
                ? 'Crear cuenta'
                : 'Entrar'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setIsRegister(!isRegister)
            setError('')
            setMessage('')
            setFirstName('')
            setLastName('')
            setPhone('')
          }}
          className="mt-4 w-full text-sm text-zinc-400 hover:text-white"
        >
          {isRegister
            ? 'Ya tengo cuenta'
            : 'No tengo cuenta, quiero registrarme'}
        </button>

        {message && <p className="mt-4 text-sm text-green-400">{message}</p>}
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </div>
    </div>
  )
}