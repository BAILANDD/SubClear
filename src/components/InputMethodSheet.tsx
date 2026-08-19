import { useEffect, useRef, useState } from 'react'

interface InputMethodSheetProps {
  isOpen: boolean
  onClose: () => void
  onScanScreenshot: () => void
  onManualFreeTrial: () => void
  onManualPaidMembership: () => void
}

export default function InputMethodSheet({
  isOpen,
  onClose,
  onScanScreenshot,
  onManualFreeTrial,
  onManualPaidMembership,
}: InputMethodSheetProps) {
  const [showManualOptions, setShowManualOptions] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    closeButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, onClose])

  return (
    <div className="input-sheet-layer fixed inset-0 z-30 flex items-end justify-center" aria-modal="true">
      <button
        type="button"
        aria-label="关闭添加方式面板"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-label="添加方式面板"
        className="input-method-sheet relative w-full max-w-[430px]"
      >
        <div className="sheet-handle" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">添加会员记录</h2>
            <p className="mt-0.5 text-xs text-gray-500">选择一种添加方式。</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 px-2 py-1 text-xs font-medium text-gray-500 active:bg-gray-50"
          >
            关闭
          </button>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            aria-label="扫描截图"
            onClick={onScanScreenshot}
            className="w-full rounded-lg border border-gray-200 px-3 py-3 text-left active:bg-gray-50"
          >
            <span className="block text-sm font-semibold text-gray-800">扫描截图</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              上传一张会员、订单或订阅截图。
            </span>
          </button>

          <button
            type="button"
            aria-label="手动录入"
            onClick={() => setShowManualOptions((current) => !current)}
            className="w-full rounded-lg border border-gray-200 px-3 py-3 text-left active:bg-gray-50"
            aria-expanded={showManualOptions}
          >
            <span className="block text-sm font-semibold text-gray-800">手动录入</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              使用当前可靠的手动表单继续。
            </span>
          </button>

          {showManualOptions && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onManualFreeTrial}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 active:bg-gray-50"
              >
                添加免费试用
              </button>
              <button
                type="button"
                onClick={onManualPaidMembership}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 active:bg-gray-50"
              >
                添加付费会员
              </button>
            </div>
          )}

          <button
            type="button"
            aria-label="语音快速添加"
            disabled
            className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-left text-gray-400"
          >
            <span className="block text-sm font-semibold">语音快速添加</span>
            <span className="mt-0.5 block text-xs">后续版本 / 暂未开放</span>
          </button>
        </div>
      </section>
    </div>
  )
}
