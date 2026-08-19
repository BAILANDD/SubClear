import { useEffect } from 'react'

interface ToastProps {
  message: string
  type?: 'success' | 'error'
  onClose: () => void
  durationMs?: number
}

export default function Toast({ message, type = 'success', onClose, durationMs = 2000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, durationMs)
    return () => clearTimeout(timer)
  }, [onClose, durationMs])

  const bg =
    type === 'success'
      ? 'bg-green-50 border-green-200 text-green-700'
      : 'bg-red-50 border-red-200 text-red-700'

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-[398px]">
      <div className={`border rounded-lg px-3 py-2.5 text-sm text-center shadow-sm ${bg}`}>
        {message}
      </div>
    </div>
  )
}
