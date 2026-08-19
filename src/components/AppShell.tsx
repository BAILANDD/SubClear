import { useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AddMembershipContext } from './AddMembershipContext'
import BottomNavigation from './BottomNavigation'
import InputMethodSheet from './InputMethodSheet'

export default function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [isInputSheetOpen, setIsInputSheetOpen] = useState(false)
  const sourcePathRef = useRef('/')

  function openInputSheet() {
    sourcePathRef.current = `${location.pathname}${location.search}${location.hash}`
    setIsInputSheetOpen(true)
  }

  function closeInputSheet() {
    setIsInputSheetOpen(false)
  }

  function navigateFromSheet(path: string, state?: Record<string, unknown>) {
    setIsInputSheetOpen(false)
    navigate(path, state ? { state } : undefined)
  }

  return (
    <div className="app-shell flex min-h-dvh flex-col">
      <div
        className="app-top-scroll-fade"
        aria-hidden="true"
        data-testid="app-top-scroll-fade"
      />
      <AddMembershipContext.Provider value={{ openAddMembershipSheet: openInputSheet }}>
        <main className="app-main flex-1">{children}</main>
      </AddMembershipContext.Provider>
      <BottomNavigation />
      {isInputSheetOpen && (
        <InputMethodSheet
          isOpen={isInputSheetOpen}
          onClose={closeInputSheet}
          onScanScreenshot={() =>
            navigateFromSheet('/scan-screenshot', { from: sourcePathRef.current })
          }
          onManualFreeTrial={() => navigateFromSheet('/add-trial')}
          onManualPaidMembership={() => navigateFromSheet('/add-paid')}
        />
      )}
    </div>
  )
}
