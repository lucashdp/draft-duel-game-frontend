'use client'

import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useVerifyMagicLink } from '@/hooks/useAuth'
import { FROM_STORAGE_KEY, isSafeRedirectPath } from '@/lib/auth'

type Status = 'pending' | 'error'

export default function VerifyPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const verify = useVerifyMagicLink()
  const [status, setStatus] = useState<Status>('pending')
  const submitted = useRef(false)

  useEffect(() => {
    if (submitted.current) return
    submitted.current = true

    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      return
    }

    verify.mutate(
      { token },
      {
        onSuccess: () => {
          const from = localStorage.getItem(FROM_STORAGE_KEY)
          localStorage.removeItem(FROM_STORAGE_KEY)
          router.replace(isSafeRedirectPath(from) ? from : '/')
        },
        onError: () => setStatus('error'),
      },
    )
  }, [searchParams, verify, router])

  if (status === 'error') {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Link inválido ou expirado</h1>
        <p className="text-sm text-muted-foreground">
          Solicite um novo link para entrar.
        </p>
        <Link href="/login" className="text-primary underline">
          Solicitar novo link
        </Link>
      </div>
    )
  }

  return (
    <div className="text-center">
      <p className="text-sm text-muted-foreground">Verificando…</p>
    </div>
  )
}
