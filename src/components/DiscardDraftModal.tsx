import { useEffect, useRef } from 'react'

interface DiscardDraftModalProps {
  onContinueReviewing: () => void
  onDiscardDraft: () => void
  description?: string
  continueLabel?: string
}

export default function DiscardDraftModal({
  onContinueReviewing,
  onDiscardDraft,
  description = '这个核对草稿只存在于当前截图会话中，离开后将被丢弃。',
  continueLabel = '继续核对',
}: DiscardDraftModalProps) {
  const continueButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    continueButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onContinueReviewing()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onContinueReviewing])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 px-4 py-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="放弃草稿"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-[390px] overflow-y-auto rounded-2xl bg-white p-4 shadow-xl"
      >
        <h3 className="text-base font-semibold text-gray-900">放弃草稿？</h3>
        <p className="mt-3 text-sm text-gray-600">
          {description}
        </p>
        <div className="mt-4 space-y-2">
          <button
            ref={continueButtonRef}
            type="button"
            onClick={onContinueReviewing}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
          >
            {continueLabel}
          </button>
          <button
            type="button"
            onClick={onDiscardDraft}
            className="w-full rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700"
          >
            放弃草稿
          </button>
        </div>
      </div>
    </div>
  )
}
