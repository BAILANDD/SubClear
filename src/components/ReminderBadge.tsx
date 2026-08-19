import type { ReminderState } from '../types'

const styles: Record<ReminderState, string> = {
  enabled: 'bg-blue-50 text-blue-600',
  disabled: 'bg-gray-100 text-gray-400',
  blocked: 'bg-red-50 text-red-600',
}

const labels: Record<ReminderState, string> = {
  enabled: '提醒已开启',
  disabled: '提醒已关闭',
  blocked: '提醒不可用',
}

export default function ReminderBadge({ state }: { state: ReminderState }) {
  return (
    <span
      className={`status-badge inline-block text-xs font-medium px-2 py-0.5 rounded-full ${styles[state]}`}
    >
      {labels[state]}
    </span>
  )
}
