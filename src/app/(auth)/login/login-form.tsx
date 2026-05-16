'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { z } from 'zod'
import { useRequestMagicLink } from '@/hooks/useAuth'
import { FROM_STORAGE_KEY, isSafeRedirectPath } from '@/lib/auth'

const emailSchema = z.string().email()

export default function LoginForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const requestLink = useRequestMagicLink()

  useEffect(() => {
    const from = searchParams.get('from')
    if (isSafeRedirectPath(from)) {
      localStorage.setItem(FROM_STORAGE_KEY, from)
    } else {
      // Don't let a stale `from` from an earlier visit leak into this login.
      localStorage.removeItem(FROM_STORAGE_KEY)
    }
  }, [searchParams])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setValidationError(null)
    const parsed = emailSchema.safeParse(email)
    if (!parsed.success) {
      setValidationError('Email inválido')
      return
    }
    requestLink.mutate(
      { email: parsed.data },
      {
        onSettled: () => setSubmitted(true),
      },
    )
  }

  if (submitted) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Confira seu email</h1>
        <p className="text-sm text-muted-foreground">
          Enviamos um link para <strong>{email}</strong>. O link expira em 15 minutos.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
        />
        {validationError ? (
          <p className="mt-1 text-sm text-red-600">{validationError}</p>
        ) : null}
      </div>
      <button
        type="submit"
        disabled={requestLink.isPending}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {requestLink.isPending ? 'Enviando…' : 'Enviar link'}
      </button>
    </form>
  )
}
