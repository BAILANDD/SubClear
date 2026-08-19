import { Link, useNavigate } from 'react-router-dom'
import BoundaryNotice from '../components/BoundaryNotice'
import PageBackButton from '../components/PageBackButton'
import { useSubscriptions } from '../store/useSubscriptions'
import {
  buildSubscriptionRecordFromFormValues,
  createEmptySubscriptionFormValues,
  type SubscriptionFormValues,
} from '../subscriptionForm/subscriptionFormCore'
import SubscriptionForm from '../subscriptionForm/subscriptionForm'

function generateId(): string {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export default function AddPaidSubscription() {
  const navigate = useNavigate()
  const { addSubscriptionRecord } = useSubscriptions()

  function handleValidSubmit(values: SubscriptionFormValues): string[] | void {
    const record = buildSubscriptionRecordFromFormValues(values, {
      id: generateId(),
      timestamp: new Date().toISOString(),
    })

    if (!addSubscriptionRecord(record)) {
      return ['无法保存记录，请重试。']
    }

    navigate('/subscriptions', { replace: true })
  }

  return (
    <div className="secondary-page space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">添加付费会员</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            记录付费会员，用来追踪续费。
          </p>
        </div>
        <PageBackButton fallback="/subscriptions" label="返回" />
      </div>

      <BoundaryNotice text="无需连接银行。请手动输入信息。" />

      <SubscriptionForm
        variant="paid"
        initialValues={createEmptySubscriptionFormValues('paid_membership')}
        submitLabel="保存付费会员"
        onValidSubmit={handleValidSubmit}
      />

      <p className="text-center text-xs text-gray-400">
        <Link to="/add-trial" className="text-blue-600 underline">
          切换到免费试用
        </Link>
      </p>
    </div>
  )
}
