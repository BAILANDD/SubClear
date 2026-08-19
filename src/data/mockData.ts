import type { Subscription } from '../types'

function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function daysAgo(n: number): string {
  return daysFromNow(-n)
}

const now = new Date().toISOString()

export const mockSubscriptions: Subscription[] = [
  // 1. Free trial ending soon — ends in 2 days
  {
    id: 's1',
    service_name: 'Notion Pro',
    type: 'trial',
    price_after_trial: 10,
    currency: 'USD',
    billing_cycle: 'monthly',
    trial_end_date: daysFromNow(2),
    status: 'active',
    cancel_url_or_note: 'https://www.notion.so/settings/billing',
    cancellation_steps: 'Settings → Billing → Cancel plan',
    reminder_enabled: true,
    reminder_offset_days: 3,
    reminder_state: 'enabled',
    notes: '试用 Notion Pro 团队协作功能',
    created_at: daysAgo(28),
    updated_at: now,
  },
  // 2. Paid subscription renewing in 5 days (within 7 days)
  {
    id: 's2',
    service_name: 'Spotify Premium',
    type: 'paid',
    price: 10.99,
    currency: 'USD',
    billing_cycle: 'monthly',
    renewal_date: daysFromNow(5),
    status: 'active',
    cancel_url_or_note: 'https://www.spotify.com/account/subscription/',
    cancellation_steps: 'Account → Subscription → Cancel Premium',
    reminder_enabled: true,
    reminder_offset_days: 7,
    reminder_state: 'enabled',
    notes: '',
    created_at: daysAgo(60),
    updated_at: now,
  },
  // 3. Paid subscription renewing in 20 days (within 30 days)
  {
    id: 's3',
    service_name: 'Adobe Creative Cloud',
    type: 'paid',
    price: 54.99,
    currency: 'USD',
    billing_cycle: 'monthly',
    renewal_date: daysFromNow(20),
    status: 'active',
    cancel_url_or_note: 'https://account.adobe.com/plans',
    cancellation_steps: 'Account → Plans → Manage plan → Cancel',
    reminder_enabled: true,
    reminder_offset_days: 7,
    reminder_state: 'enabled',
    notes: '考虑降级到 Photography plan',
    created_at: daysAgo(120),
    updated_at: now,
  },
  // 4. Planned to cancel
  {
    id: 's4',
    service_name: 'Netflix Premium',
    type: 'paid',
    price: 15.99,
    currency: 'USD',
    billing_cycle: 'monthly',
    renewal_date: daysFromNow(12),
    status: 'planned_to_cancel',
    cancel_url_or_note: 'https://www.netflix.com/cancelplan',
    cancellation_steps: 'Account → Membership → Cancel Membership',
    planned_cancel_date: daysFromNow(10),
    reminder_enabled: true,
    reminder_offset_days: 3,
    reminder_state: 'enabled',
    notes: 'Cancel after finishing the current series.',
    created_at: daysAgo(180),
    updated_at: now,
  },
  // 5. Cancelled
  {
    id: 's5',
    service_name: 'Disney+',
    type: 'paid',
    price: 7.99,
    currency: 'USD',
    billing_cycle: 'monthly',
    renewal_date: daysAgo(30),
    status: 'cancelled',
    cancel_url_or_note: 'https://www.disneyplus.com/account/cancel',
    cancellation_steps: 'Account → Subscription → Cancel',
    cancellation_proof: '[screenshot-disneyplus-cancel-2026-05-01]',
    cancellation_date: daysAgo(15),
    reminder_enabled: false,
    reminder_offset_days: 0,
    reminder_state: 'disabled',
    notes: 'Successfully cancelled. Confirmation email received.',
    created_at: daysAgo(90),
    updated_at: daysAgo(15),
  },
  // 6. Missing date (no renewal_date or trial_end_date)
  {
    id: 's6',
    service_name: 'Figma Professional',
    type: 'paid',
    price: 12,
    currency: 'USD',
    billing_cycle: 'monthly',
    status: 'active',
    cancel_url_or_note: '',
    reminder_enabled: true,
    reminder_offset_days: 7,
    reminder_state: 'enabled',
    notes: '需要确认续费日期，公司统一采购的',
    created_at: daysAgo(45),
    updated_at: now,
  },
  // 7. Reminder blocked (notification permission blocked)
  {
    id: 's7',
    service_name: 'YouTube Premium',
    type: 'paid',
    price: 11.99,
    currency: 'USD',
    billing_cycle: 'monthly',
    renewal_date: daysFromNow(8),
    status: 'active',
    cancel_url_or_note: 'https://www.youtube.com/paid_memberships',
    cancellation_steps: 'Settings → Paid memberships → Cancel',
    reminder_enabled: true,
    reminder_offset_days: 7,
    reminder_state: 'blocked',
    notes: '提醒被系统通知权限阻止，需要用户在系统设置中开启',
    created_at: daysAgo(50),
    updated_at: now,
  },
]
