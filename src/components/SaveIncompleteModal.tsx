import { useEffect, useRef } from 'react'

interface SaveIncompleteModalProps {
  unresolvedCount: number
  onContinueReviewing: () => void
  onSaveConfirmedInfo: () => void
}

export default function SaveIncompleteModal({
  unresolvedCount,
  onContinueReviewing,
  onSaveConfirmedInfo,
}: SaveIncompleteModalProps) {
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
        aria-label="保存不完整记录"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-[390px] overflow-y-auto rounded-2xl bg-white p-4 shadow-xl"
      >
        <h3 className="text-base font-semibold text-gray-900">保存不完整记录？</h3>
        <p className="mt-3 text-sm text-gray-600">仍有 {unresolvedCount} 个字段需要核对。</p>
        <p className="mt-2 text-sm text-gray-600">只会保存已确认的信息。</p>
        <p className="mt-2 text-sm text-gray-600">
          未解决字段可以稍后在“待确认”中补充。
        </p>
        <div className="mt-4 space-y-2">
          <button
            ref={continueButtonRef}
            type="button"
            onClick={onContinueReviewing}
            className="w-full rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700"
          >
            继续核对
          </button>
          <button
            type="button"
            onClick={onSaveConfirmedInfo}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
          >
            保存已确认信息
          </button>
        </div>
      </div>
    </div>
  )
}
