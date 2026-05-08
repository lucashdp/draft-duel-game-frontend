'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

export function useRequestMagicLink() {
  return useMutation({
    mutationFn: (input: { email: string }) => api.post<void>('/auth/magic-link', input),
  })
}

export function useVerifyMagicLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { token: string }) => {
      const res = await api.post<{ user: User }>('/auth/verify', input)
      return res.user
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })
}
