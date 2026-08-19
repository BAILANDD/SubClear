import { daysUntil, formatDate } from '../utils/date'
import type { ReminderState } from '../types'

interface ReminderPreviewProps {
  offsetDays: number
  keyDate: string | undefined
  state: ReminderState
  eventLabel: string
}

export default function ReminderPreview({
  offsetDays,
  keyDate,
  state,
  eventLabel,
}: ReminderPreviewProps) {
  if (!keyDate) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-400">
        添加日期后可预览提醒。
      </div>
    )
  }

  const d = new Date(keyDate + 'T00:00:00')
  d.setDate(d.getDate() - offsetDays)
  const reminderDate = d.toISOString().split('T')[0]
  const left = daysUntil(reminderDate)

  if (left < 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
        提醒日期已经过去（{formatDate(reminderDate)}）。
      </div>
    )
  }

  const stateLabel: Record<ReminderState, string> = {
    enabled: '提醒设置已开启',
    disabled: '提醒已关闭',
    blocked: '当前原型中提醒不可用',
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 space-y-1">
      <p className="text-xs text-blue-800 font-medium">
        {stateLabel[state]}
      </p>
      <p className="text-xs text-blue-700">
        在{eventLabel}前 {offsetDays} 天提醒 ·{' '}
        {formatDate(reminderDate)}
      </p>
      {state === 'blocked' && (
        <p className="text-xs text-red-600">
          不会安排真实通知。这是 demo 中的模拟状态。
        </p>
      )}
    </div>
  )
}
