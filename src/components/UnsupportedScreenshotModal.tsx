import { useEffect, useRef } from 'react'

interface UnsupportedScreenshotModalProps {
  isOpen: boolean
  onChooseAnother: () => void
  onManualEntry: () => void
  onCancel: () => void
}

export default function UnsupportedScreenshotModal({
  isOpen,
  onChooseAnother,
  onManualEntry,
  onCancel,
}: UnsupportedScreenshotModalProps) {
  const chooseAnotherRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!isOpen) return undefined

    chooseAnotherRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4" aria-modal="true">
      <button
        type="button"
        aria-label="关闭不支持截图提示"
        className="absolute inset-0 bg-black/30"
        onClick={onCancel}
      />
      <section
        role="dialog"
        aria-label="不支持的截图"
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-xl bg-white p-4 shadow-xl"
      >
        <h2 className="text-base font-semibold text-gray-900">暂不支持这张截图</h2>
        <p className="mt-2 text-sm text-gray-500">
          这张截图不像当前支持的会员、订单或取消来源。
        </p>
        <div className="mt-4 space-y-2">
          <button
            ref={chooseAnotherRef}
            type="button"
            onClick={onChooseAnother}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white active:bg-blue-700"
          >
            重新选择
          </button>
          <button
            type="button"
            onClick={onManualEntry}
            className="w-full rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 active:bg-gray-50"
          >
            手动录入
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-lg py-2.5 text-sm font-medium text-gray-500 active:bg-gray-50"
          >
            取消
          </button>
        </div>
      </section>
    </div>
  )
}
