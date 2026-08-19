import { useContext } from 'react'
import { SubscriptionContext, type ContextValue } from './SubscriptionContext'

export function useSubscriptions(): ContextValue {
  const ctx = useContext(SubscriptionContext)
  if (!ctx) {
    throw new Error('useSubscriptions must be used within a SubscriptionProvider')
  }
  return ctx
}
