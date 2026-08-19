import { useEffect, useRef } from 'react'

interface DeleteConfirmModalProps {
  onCancel: () => void
  onConfirm: () => void
}

export default function DeleteConfirmModal({
  onCancel,
  onConfirm,
}: DeleteConfirmModalProps) {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    cancelButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 px-4 py-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="删除记录"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-[390px] overflow-y-auto rounded-2xl bg-white p-4 shadow-xl"
      >
        <h3 className="text-base font-semibold text-gray-900">删除这条记录？</h3>
        <p className="mt-3 text-sm text-gray-600">
          删除后，这条会员记录将从 SubClear 中移除。此操作无法撤销。
        </p>
        <div className="mt-4 space-y-2">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            className="w-full rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="w-full rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  )
}
