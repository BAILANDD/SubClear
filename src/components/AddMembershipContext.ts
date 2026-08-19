import { createContext, useContext } from 'react'

export interface AddMembershipContextValue {
  openAddMembershipSheet: () => void
}

export const AddMembershipContext = createContext<AddMembershipContextValue | null>(null)

export function useAddMembership() {
  const context = useContext(AddMembershipContext)
  if (!context) {
    throw new Error('useAddMembership must be used inside AddMembershipContext.Provider')
  }
  return context
}
