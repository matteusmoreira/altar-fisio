import { useQuery as query, useMutation as mutation, useAction as action } from 'convex/react'
import { getFunctionName, type FunctionReference, type FunctionArgs, type FunctionReturnType } from 'convex/server'
import { useAuth } from '@/contexts/AuthContext'
import { accessPolicy } from '../../shared/accessPolicy'
import { useCallback } from 'react'

type Args<F extends FunctionReference<any>> = Omit<FunctionArgs<F>, 'sessionToken'>
export function useQuery<F extends FunctionReference<'query'>>(reference: F, args?: Args<F> | 'skip'): FunctionReturnType<F> | undefined {
  const { token, role, isAuthenticated } = useAuth()
  const policy = accessPolicy[getFunctionName(reference)]
  const allowed = policy === 'public' || (Array.isArray(policy) && role && policy.includes(role) && isAuthenticated)
  return query(reference, (args === 'skip' || !allowed ? 'skip' : policy === 'public' ? args || {} : { ...args, sessionToken: token }) as any)
}
export function useMutation<F extends FunctionReference<'mutation'>>(reference: F) {
  const { token } = useAuth()
  const call = mutation(reference)
  return useCallback((args?: Args<F>): Promise<FunctionReturnType<F>> => {
    if (!token) return Promise.reject(new Error('Entre novamente para continuar.'))
    return call({ ...args, sessionToken: token } as any)
  }, [call, token])
}
export function useAction<F extends FunctionReference<'action'>>(reference: F) {
  const { token } = useAuth()
  const call = action(reference)
  return useCallback((args?: Args<F>): Promise<FunctionReturnType<F>> => {
    if (!token) return Promise.reject(new Error('Entre novamente para continuar.'))
    return call({ ...args, sessionToken: token } as any)
  }, [call, token])
}
