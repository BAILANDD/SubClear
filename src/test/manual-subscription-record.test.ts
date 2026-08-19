import { describe, expect, it } from 'vitest'
import {
  buildManualSubscriptionRecord,
  isValidDateOnly,
} from '../manual/manualSubscription'

describe('manual subscription canonical record', () => {
  it('accepts only real ISO calendar dates', () => {
    expect(isValidDateOnly('2026-08-01')).toBe(true)
    expect(isValidDateOnly('2024-02-29')).toBe(true)
    expect(isValidDateOnly('2026-02-29')).toBe(false)
    expect(isValidDateOnly('2026/08/01')).toBe(false)
  })

  it('maps manual facts and only retains a next charge for automatic renewal', () => {
    const trial = buildManualSubscriptionRecord({
      id: 'manual_trial',
      serviceName: 'Test Trial',
      entitlementType: 'trial',
      membershipStartDate: '2026-08-01',
      membershipEndDate: '2026-08-10',
      renewalStatus: 'auto_renew_on',
      nextChargeDate: '2026-09-01',
      renewalPrice: 10,
      currency: null,
      billingCycle: 'monthly',
      cancellationPath: 'https://example.com/cancel',
      platform: null,
      reminderOffsetDays: 3,
      timestamp: '2026-08-01T00:00:00.000Z',
    })

    expect(trial.facts).toMatchObject({
      membership_start_date: '2026-08-01',
      membership_end_date: '2026-08-10',
      renewal_status: 'auto_renew_on',
      next_charge_date: '2026-09-01',
    })
    expect(trial.facts).not.toHaveProperty('autoRenew')

    const renewalStatuses = [
      'auto_renew_off',
      'manual_renewal',
      'not_applicable',
      'unknown',
    ] as const

    for (const renewalStatus of renewalStatuses) {
      const paid = buildManualSubscriptionRecord({
        id: `manual_${renewalStatus}`,
        serviceName: 'Test Paid',
        entitlementType: 'paid_membership',
        membershipStartDate: null,
        membershipEndDate: null,
        renewalStatus,
        nextChargeDate: '2026-09-01',
        renewalPrice: 10,
        currency: 'USD',
        billingCycle: 'monthly',
        cancellationPath: null,
        platform: null,
        reminderOffsetDays: 7,
        timestamp: '2026-08-01T00:00:00.000Z',
      })

      expect(paid.facts.renewal_status).toBe(renewalStatus)
      expect(paid.facts.next_charge_date).toBeNull()
      expect(paid.facts.membership_start_date).toBeNull()
      expect(paid.facts).not.toHaveProperty('autoRenew')
    }
  })

  it('preserves every existing renewal status for both manual entitlement types', () => {
    const renewalStatuses = [
      'auto_renew_on',
      'auto_renew_off',
      'manual_renewal',
      'not_applicable',
      'unknown',
    ] as const
    const entitlementTypes = ['trial', 'paid_membership'] as const

    for (const entitlementType of entitlementTypes) {
      for (const renewalStatus of renewalStatuses) {
        const record = buildManualSubscriptionRecord({
          id: `${entitlementType}_${renewalStatus}`,
          serviceName: 'Manual record',
          entitlementType,
          membershipStartDate: null,
          membershipEndDate: entitlementType === 'trial' ? '2026-08-10' : null,
          renewalStatus,
          nextChargeDate: '2026-09-01',
          renewalPrice: 10,
          currency: entitlementType === 'trial' ? null : 'USD',
          billingCycle: 'monthly',
          cancellationPath: null,
          platform: null,
          reminderOffsetDays: entitlementType === 'trial' ? 3 : 7,
          timestamp: '2026-08-01T00:00:00.000Z',
        })

        expect(record.facts.renewal_status).toBe(renewalStatus)
        expect(record.facts.next_charge_date).toBe(
          renewalStatus === 'auto_renew_on' ? '2026-09-01' : null,
        )
      }
    }
  })

  it('maps platform to facts.platform correctly', () => {
    // 暂不确定 → null
    const unknownPlatform = buildManualSubscriptionRecord({
      id: 'p1',
      serviceName: 'S',
      entitlementType: 'trial',
      membershipStartDate: null,
      membershipEndDate: '2026-08-10',
      renewalStatus: 'unknown',
      nextChargeDate: null,
      renewalPrice: null,
      currency: null,
      billingCycle: null,
      cancellationPath: null,
      platform: null,
      reminderOffsetDays: 3,
      timestamp: '2026-08-01T00:00:00.000Z',
    })
    expect(unknownPlatform.facts.platform).toBeNull()

    // 官方网站 → "官方网站"
    const official = buildManualSubscriptionRecord({
      id: 'p2',
      serviceName: 'S',
      entitlementType: 'trial',
      membershipStartDate: null,
      membershipEndDate: '2026-08-10',
      renewalStatus: 'unknown',
      nextChargeDate: null,
      renewalPrice: null,
      currency: null,
      billingCycle: null,
      cancellationPath: null,
      platform: '官方网站',
      reminderOffsetDays: 3,
      timestamp: '2026-08-01T00:00:00.000Z',
    })
    expect(official.facts.platform).toBe('官方网站')

    // App Store
    const appStore = buildManualSubscriptionRecord({
      id: 'p3',
      serviceName: 'S',
      entitlementType: 'trial',
      membershipStartDate: null,
      membershipEndDate: '2026-08-10',
      renewalStatus: 'unknown',
      nextChargeDate: null,
      renewalPrice: null,
      currency: null,
      billingCycle: null,
      cancellationPath: null,
      platform: 'App Store',
      reminderOffsetDays: 3,
      timestamp: '2026-08-01T00:00:00.000Z',
    })
    expect(appStore.facts.platform).toBe('App Store')

    // Google Play
    const googlePlay = buildManualSubscriptionRecord({
      id: 'p4',
      serviceName: 'S',
      entitlementType: 'trial',
      membershipStartDate: null,
      membershipEndDate: '2026-08-10',
      renewalStatus: 'unknown',
      nextChargeDate: null,
      renewalPrice: null,
      currency: null,
      billingCycle: null,
      cancellationPath: null,
      platform: 'Google Play',
      reminderOffsetDays: 3,
      timestamp: '2026-08-01T00:00:00.000Z',
    })
    expect(googlePlay.facts.platform).toBe('Google Play')

    // 自定义渠道
    const custom = buildManualSubscriptionRecord({
      id: 'p5',
      serviceName: 'S',
      entitlementType: 'trial',
      membershipStartDate: null,
      membershipEndDate: '2026-08-10',
      renewalStatus: 'unknown',
      nextChargeDate: null,
      renewalPrice: null,
      currency: null,
      billingCycle: null,
      cancellationPath: null,
      platform: '支付宝',
      reminderOffsetDays: 3,
      timestamp: '2026-08-01T00:00:00.000Z',
    })
    expect(custom.facts.platform).toBe('支付宝')
  })
})
