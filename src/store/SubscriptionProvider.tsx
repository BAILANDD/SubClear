import { useReducer, useEffect, useMemo, type ReactNode } from 'react'
import type { Subscription, SubscriptionStatus } from '../types'
import type { SubscriptionRecord } from '../types/storage'
import { projectSubscriptionRecordsToLegacySubscriptions } from '../compatibility/legacySubscriptionAdapter'
import {
  SubscriptionContext,
  loadInitialState,
  persist,
  reducer,
} from './SubscriptionContext'

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null, loadInitialState)
  const subscriptions = useMemo(
    () => projectSubscriptionRecordsToLegacySubscriptions(state.records),
    [state.records],
  )

  useEffect(() => {
    persist(state)
  }, [state])

  const addSubscription = (sub: Subscription) =>
    dispatch({ type: 'ADD_SUBSCRIPTION', payload: sub })

  const updateSubscription = (sub: Subscription) =>
    dispatch({ type: 'UPDATE_SUBSCRIPTION', payload: sub })

  const changeStatus = (id: string, status: SubscriptionStatus) =>
    dispatch({ type: 'CHANGE_STATUS', payload: { id, status } })

  const addSubscriptionRecord = (record: SubscriptionRecord): boolean => {
    if (!state.canPersist) {
      return false
    }

    const nextRecords = [
      ...state.records.filter((item) => item.facts.id !== record.facts.id),
      record,
    ]
    if (!persist({ ...state, records: nextRecords })) {
      return false
    }

    dispatch({ type: 'ADD_SUBSCRIPTION_RECORD', payload: record })
    return true
  }

  const updateSubscriptionRecord = (
    id: string,
    update: (record: SubscriptionRecord) => SubscriptionRecord,
  ): boolean => {
    if (!state.canPersist) {
      return false
    }

    const target = state.records.find((record) => record.facts.id === id)
    if (!target) {
      return false
    }

    const nextRecord = update(target)
    const nextRecords = state.records.map((record) =>
      record.facts.id === id ? nextRecord : record,
    )
    if (!persist({ ...state, records: nextRecords })) {
      return false
    }

    dispatch({ type: 'ADD_SUBSCRIPTION_RECORD', payload: nextRecord })
    return true
  }

  const deleteSubscriptionRecord = (id: string): boolean => {
    if (!state.canPersist) {
      return false
    }

    const nextRecords = state.records.filter((record) => record.facts.id !== id)
    if (nextRecords.length === state.records.length) {
      return false
    }

    if (!persist({ ...state, records: nextRecords })) {
      return false
    }

    dispatch({ type: 'DELETE_SUBSCRIPTION_RECORD', payload: { id } })
    return true
  }

  return (
    <SubscriptionContext.Provider
      value={{
        subscriptions,
        records: state.records,
        storageError: state.storageError,
        addSubscription,
        updateSubscription,
        changeStatus,
        addSubscriptionRecord,
        updateSubscriptionRecord,
        deleteSubscriptionRecord,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  )
}
