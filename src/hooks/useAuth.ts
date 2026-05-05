'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { User } from '@/types/domain'

export function useAuth() {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ['me'],
    queryFn: () => api.get<User>('/me').catch(() => null),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  return { user: user ?? null, isLoading }
}

export function useInvalidateAuth() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['me'] })
}
