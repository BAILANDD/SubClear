import { useState } from 'react'
import { useParams } from 'react-router-dom'
import PageBackButton from '../components/PageBackButton'
import ReminderBadge from '../components/ReminderBadge'
import ReminderPreview from '../components/ReminderPreview'
import Toast from '../components/Toast'
import {
  buildReminderUpdate,
  getReminderStateForInput,
  getReminderTrigger,
  isValidReminderOffset,
} from '../reminder/reminderManagement'
import { useSubscriptions } from '../store/useSubscriptions'
import { daysUntil, formatDate } from '../utils/date'

export default function ReminderSettings() {
  const { id } = useParams<{ id: string }>()
  const { records, storageError, updateSubscriptionRecord } = useSubscriptions()

  const record = records.find((item) => item.facts.id === id)
  const detailFallback = id ? `/subscription/${id}` : '/subscriptions'

  const [enabled, setEnabled] = useState(record?.facts.reminder_settings.enabled ?? true)
  const [offsetDays, setOffsetDays] = useState(record?.facts.reminder_settings.offset_days ?? 7)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  if (!record) {
    return (
      <div className="secondary-page space-y-4 py-12 text-center">
        <p className="text-sm text-gray-500">找不到这条记录</p>
        <PageBackButton fallback={detailFallback} label="返回记录详情" />
      </div>
    )
  }

  const currentRecord = record
  const facts = currentRecord.facts
  const trigger = getReminderTrigger(currentRecord)
  const defaultOffset = facts.entitlement_type === 'trial' ? 3 : 7
  const computedState = getReminderStateForInput(currentRecord, enabled)
  const triggerDate = trigger.status === 'available' ? trigger.date : undefined
  const eventLabel = trigger.status === 'available' ? formatTriggerLabel(trigger.label) : '日期不可用'

  function handleSave() {
    setError('')
    const updatedAt = new Date().toISOString()
    const result = buildReminderUpdate(currentRecord, {
      enabled,
      offsetDays,
      updatedAt,
    })

    if (!result.ok) {
      setError('提醒提前天数必须是 0 到 30 之间的整数。')
      return
    }

    const didSave = updateSubscriptionRecord(facts.id, () => result.record)
    if (!didSave) {
      setError(storageError ?? '提醒无法保存，请重试。')
      return
    }

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleRestoreDefault() {
    setOffsetDays(defaultOffset)
  }

  return (
    <div className="secondary-page space-y-4">
      <PageBackButton fallback={`/subscription/${facts.id}`} label={`返回 ${facts.service_name}`} />

      <div>
        <h2 className="text-lg font-semibold text-gray-900">提醒设置</h2>
        <p className="mt-0.5 text-xs text-gray-500">{facts.service_name}</p>
      </div>

      <div className="rounded-lg border border-gray-100 px-3 py-3">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">提醒状态</h3>
        <div className="mb-2 flex items-center gap-2">
          <ReminderBadge state={computedState} />
        </div>
        <p className="text-xs text-gray-500">
          {computedState === 'enabled' && '当前原型中的提醒设置已开启。'}
          {computedState === 'disabled' && '提醒设置已关闭。'}
          {computedState === 'blocked' && '需要可用触发日期后，才可以显示提醒预览。'}
        </p>
        {computedState === 'blocked' && (
          <p className="mt-1 text-xs text-amber-600">
            这是原型状态，不会安排真实通知。
          </p>
        )}
      </div>

      <div className="rounded-lg border border-gray-100 px-3 py-3">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">事件来源</h3>
        {trigger.status === 'available' ? (
          <div className="space-y-1">
            <p className="text-xs text-gray-500">
              {formatTriggerLabel(trigger.label)}：{' '}
              <span className="font-medium text-gray-700">{formatDate(trigger.date)}</span>
            </p>
            <p className="text-xs text-gray-400">
              距今天 {daysUntil(trigger.date)} 天
            </p>
          </div>
        ) : (
          <div>
            <p className="text-xs font-medium text-amber-600">没有可用提醒日期</p>
            <p className="mt-0.5 text-xs text-gray-400">
              添加会员结束日期、下次扣费日期或计划取消日期后，才可预览提醒。
            </p>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-100 px-3 py-3">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">提醒规则</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700" htmlFor="reminder-enabled">
              开启提醒
            </label>
            <button
              id="reminder-enabled"
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  enabled ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          <div>
            <label htmlFor="reminder-offset" className="mb-1 block text-xs text-gray-500">
              提前几天提醒
            </label>
            <input
              id="reminder-offset"
              type="number"
              min={0}
              max={30}
              value={offsetDays}
              onChange={(event) => {
                const value = Number(event.target.value)
                setOffsetDays(value)
                if (event.target.value && !isValidReminderOffset(value)) {
                  setError('提醒提前天数必须是 0 到 30 之间的整数。')
                } else {
                  setError('')
                }
              }}
              className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            />
            <span className="ml-2 text-xs text-gray-400">天</span>
          </div>
          {trigger.status === 'unavailable' && enabled && (
            <p className="text-xs text-amber-600">
              可以保存设置，但当前还没有可用的提醒预览。
            </p>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">提醒预览</h3>
        <ReminderPreview
          offsetDays={offsetDays}
          keyDate={triggerDate}
          state={computedState}
          eventLabel={eventLabel}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <button
          onClick={handleSave}
          className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white active:bg-blue-700"
        >
          保存提醒
        </button>
        <button
          onClick={handleRestoreDefault}
          className="w-full text-xs text-gray-500 underline active:text-gray-700"
        >
          恢复默认值（{defaultOffset} 天）
        </button>
      </div>

      {saved && <Toast message="提醒设置已保存。" type="success" onClose={() => setSaved(false)} />}
    </div>
  )
}

function formatTriggerLabel(label: string): string {
  if (label === 'planned cancellation') return '计划取消'
  if (label === 'next charge') return '下次扣费'
  if (label === 'membership end') return '会员到期'
  return '日期'
}
