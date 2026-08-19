import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { CURRENT_SCHEMA_VERSION, type SubscriptionRecord } from '../types'

describe('manual add', () => {
  it('offers the same five renewal choices in both manual forms', () => {
    const expectedOptions = [
      ['暂不确定', 'unknown'],
      ['自动续费', 'auto_renew_on'],
      ['已关闭自动续费', 'auto_renew_off'],
      ['手动续费', 'manual_renewal'],
      ['无需续费', 'not_applicable'],
    ]

    window.location.hash = '#/add-trial'
    const trialView = render(<App />)
    const trialRenewal = screen.getByLabelText('续费方式')
    expect(
      within(trialRenewal).getAllByRole('option').map((option) => [option.textContent, option.getAttribute('value')]),
    ).toEqual(expectedOptions)

    trialView.unmount()
    window.location.hash = '#/add-paid'
    render(<App />)
    const paidRenewal = screen.getByLabelText('续费方式')
    expect(
      within(paidRenewal).getAllByRole('option').map((option) => [option.textContent, option.getAttribute('value')]),
    ).toEqual(expectedOptions)
  })

  it('shows optional Free Trial facts and clears a hidden next charge date', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/add-trial'

    render(<App />)

    const startDate = screen.getByLabelText('试用开始日期')
    expect(startDate).not.toBeRequired()

    const renewal = screen.getByLabelText('续费方式')
    expect(renewal).toHaveValue('unknown')
    expect(screen.queryByLabelText('下次自动扣费日期')).not.toBeInTheDocument()

    await user.selectOptions(renewal, 'auto_renew_on')
    expect(screen.getByLabelText('下次自动扣费日期')).toHaveValue('')

    for (const status of ['auto_renew_off', 'manual_renewal', 'not_applicable', 'unknown']) {
      const nextCharge = screen.getByLabelText('下次自动扣费日期')
      await user.type(nextCharge, '2026-09-01')
      expect(nextCharge).toHaveValue('2026-09-01')

      await user.selectOptions(renewal, status)
      expect(screen.queryByLabelText('下次自动扣费日期')).not.toBeInTheDocument()

      await user.selectOptions(renewal, 'auto_renew_on')
      expect(screen.getByLabelText('下次自动扣费日期')).toHaveValue('')
    }
  })

  it('blocks a Free Trial start date later than its end date', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/add-trial'

    render(<App />)

    await user.type(screen.getByPlaceholderText('例如：Notion Pro'), 'Invalid Trial')
    await user.type(screen.getByLabelText('试用开始日期'), '2027-08-11')
    const [trialEndDate] = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
    await user.type(trialEndDate, '2027-08-10')
    await user.click(screen.getByRole('button', { name: '保存免费试用' }))

    expect(screen.getByText('开始日期不能晚于试用结束日期')).toBeInTheDocument()
    expect(window.location.hash).toBe('#/add-trial')
  })

  it('saves Free Trial facts canonically and navigates to My Subscriptions', async () => {
    const user = userEvent.setup()
    localStorage.setItem(
      'subclear_subscriptions',
      JSON.stringify({ schema_version: CURRENT_SCHEMA_VERSION, records: [] }),
    )
    window.location.hash = '#/add-trial'

    render(<App />)

    await user.type(screen.getByPlaceholderText('例如：Notion Pro'), 'Test Trial')
    await user.type(screen.getByLabelText('试用开始日期'), '2026-08-01')
    const [trialEndDate] = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
    await user.type(trialEndDate, '2027-08-10')
    await user.selectOptions(screen.getByLabelText('续费方式'), 'auto_renew_off')
    await user.click(screen.getByRole('button', { name: '保存免费试用' }))

    // Navigated to My Subscriptions
    expect(screen.getByRole('heading', { name: '记录' })).toBeInTheDocument()

    const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
      records?: SubscriptionRecord[]
    }
    expect(stored.records?.[0].facts).toMatchObject({
      service_name: 'Test Trial',
      membership_start_date: '2026-08-01',
      membership_end_date: '2027-08-10',
      renewal_status: 'auto_renew_off',
      next_charge_date: null,
    })
  })

  it('shows optional Paid facts and clears a hidden next charge date', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/add-paid'

    render(<App />)

    const startDate = screen.getByLabelText('开始日期')
    expect(startDate).not.toBeRequired()

    const renewal = screen.getByLabelText('续费方式')
    expect(renewal).toHaveValue('unknown')
    expect(screen.queryByLabelText('下次自动扣费日期')).not.toBeInTheDocument()
    expect(screen.queryByText('下次续费日期')).not.toBeInTheDocument()

    await user.selectOptions(renewal, 'auto_renew_on')
    expect(screen.getByLabelText('下次自动扣费日期')).toHaveValue('')

    for (const status of ['auto_renew_off', 'manual_renewal', 'not_applicable', 'unknown']) {
      await user.type(screen.getByLabelText('下次自动扣费日期'), '2026-09-01')
      await user.selectOptions(renewal, status)
      expect(screen.queryByLabelText('下次自动扣费日期')).not.toBeInTheDocument()

      await user.selectOptions(renewal, 'auto_renew_on')
      expect(screen.getByLabelText('下次自动扣费日期')).toHaveValue('')
    }
  })

  it('saves Paid facts canonically and navigates to My Subscriptions', async () => {
    const user = userEvent.setup()
    localStorage.setItem(
      'subclear_subscriptions',
      JSON.stringify({ schema_version: CURRENT_SCHEMA_VERSION, records: [] }),
    )
    window.location.hash = '#/add-paid'

    render(<App />)

    await user.type(screen.getByPlaceholderText('例如：Spotify Premium'), 'Test Paid')
    await user.type(screen.getByLabelText('开始日期'), '2026-08-01')
    await user.type(screen.getByPlaceholderText('10.99'), '10')
    await user.selectOptions(screen.getByDisplayValue('请选择...'), 'monthly')
    await user.selectOptions(screen.getByLabelText('续费方式'), 'auto_renew_on')
    await user.type(screen.getByLabelText('下次自动扣费日期'), '2026-09-01')
    await user.click(screen.getByRole('button', { name: '保存付费会员' }))

    // Navigated to My Subscriptions
    expect(screen.getByRole('heading', { name: '记录' })).toBeInTheDocument()

    const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
      records?: SubscriptionRecord[]
    }
    expect(stored.records?.[0].facts).toMatchObject({
      service_name: 'Test Paid',
      entitlement_type: 'paid_membership',
      membership_start_date: '2026-08-01',
      membership_end_date: null,
      renewal_status: 'auto_renew_on',
      next_charge_date: '2026-09-01',
      renewal_price: 10,
      currency: 'USD',
      billing_cycle: 'monthly',
    })
  })

  it('does not infer an omitted Free Trial start date', async () => {
    const user = userEvent.setup()
    localStorage.setItem(
      'subclear_subscriptions',
      JSON.stringify({ schema_version: CURRENT_SCHEMA_VERSION, records: [] }),
    )
    window.location.hash = '#/add-trial'

    render(<App />)

    await user.type(screen.getByPlaceholderText('例如：Notion Pro'), 'No Start Trial')
    const [trialEndDate] = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
    await user.type(trialEndDate, '2027-08-10')
    await user.click(screen.getByRole('button', { name: '保存免费试用' }))

    const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
      records?: SubscriptionRecord[]
    }
    expect(stored.records?.[0].facts).toMatchObject({
      membership_start_date: null,
      membership_end_date: '2027-08-10',
      renewal_status: 'unknown',
      next_charge_date: null,
    })
  })

  it('allows Paid start and automatic next charge dates to remain unknown', async () => {
    const user = userEvent.setup()
    localStorage.setItem(
      'subclear_subscriptions',
      JSON.stringify({ schema_version: CURRENT_SCHEMA_VERSION, records: [] }),
    )
    window.location.hash = '#/add-paid'

    render(<App />)

    await user.type(screen.getByPlaceholderText('例如：Spotify Premium'), 'No Date Paid')
    await user.type(screen.getByPlaceholderText('10.99'), '10')
    await user.selectOptions(screen.getByDisplayValue('请选择...'), 'monthly')
    await user.selectOptions(screen.getByLabelText('续费方式'), 'auto_renew_on')
    await user.click(screen.getByRole('button', { name: '保存付费会员' }))

    // Navigated to My Subscriptions
    expect(screen.getByRole('heading', { name: '记录' })).toBeInTheDocument()

    const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
      records?: SubscriptionRecord[]
    }
    expect(stored.records?.[0].facts).toMatchObject({
      membership_start_date: null,
      renewal_status: 'auto_renew_on',
      next_charge_date: null,
    })
  })

  describe('subscription channel (platform)', () => {
    it('shows subscription channel select in Free Trial form', () => {
      window.location.hash = '#/add-trial'
      render(<App />)
      expect(screen.getByLabelText('订阅渠道')).toBeInTheDocument()
      expect(screen.getByLabelText('订阅渠道')).toHaveValue('')
    })

    it('shows subscription channel select in Paid form', () => {
      window.location.hash = '#/add-paid'
      render(<App />)
      expect(screen.getByLabelText('订阅渠道')).toBeInTheDocument()
      expect(screen.getByLabelText('订阅渠道')).toHaveValue('')
    })

    it('defaults to 暂不确定 and saves platform as null', async () => {
      const user = userEvent.setup()
      localStorage.setItem(
        'subclear_subscriptions',
        JSON.stringify({ schema_version: CURRENT_SCHEMA_VERSION, records: [] }),
      )
      window.location.hash = '#/add-trial'
      render(<App />)

      await user.type(screen.getByPlaceholderText('例如：Notion Pro'), 'Default Platform')
      const [trialEndDate] = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
      await user.type(trialEndDate, '2027-08-10')
      await user.click(screen.getByRole('button', { name: '保存免费试用' }))

      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      expect(stored.records?.[0].facts.platform).toBeNull()
    })

    it('saves 官方网站 correctly', async () => {
      const user = userEvent.setup()
      localStorage.setItem(
        'subclear_subscriptions',
        JSON.stringify({ schema_version: CURRENT_SCHEMA_VERSION, records: [] }),
      )
      window.location.hash = '#/add-trial'
      render(<App />)

      await user.type(screen.getByPlaceholderText('例如：Notion Pro'), 'Official Site Trial')
      const [trialEndDate] = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
      await user.type(trialEndDate, '2027-08-10')
      await user.selectOptions(screen.getByLabelText('订阅渠道'), '官方网站')
      await user.click(screen.getByRole('button', { name: '保存免费试用' }))

      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      expect(stored.records?.[0].facts.platform).toBe('官方网站')
    })

    it('saves App Store correctly', async () => {
      const user = userEvent.setup()
      localStorage.setItem(
        'subclear_subscriptions',
        JSON.stringify({ schema_version: CURRENT_SCHEMA_VERSION, records: [] }),
      )
      window.location.hash = '#/add-trial'
      render(<App />)

      await user.type(screen.getByPlaceholderText('例如：Notion Pro'), 'App Store Trial')
      const [trialEndDate] = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
      await user.type(trialEndDate, '2027-08-10')
      await user.selectOptions(screen.getByLabelText('订阅渠道'), 'App Store')
      await user.click(screen.getByRole('button', { name: '保存免费试用' }))

      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      expect(stored.records?.[0].facts.platform).toBe('App Store')
    })

    it('saves Google Play correctly', async () => {
      const user = userEvent.setup()
      localStorage.setItem(
        'subclear_subscriptions',
        JSON.stringify({ schema_version: CURRENT_SCHEMA_VERSION, records: [] }),
      )
      window.location.hash = '#/add-trial'
      render(<App />)

      await user.type(screen.getByPlaceholderText('例如：Notion Pro'), 'Google Play Trial')
      const [trialEndDate] = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
      await user.type(trialEndDate, '2027-08-10')
      await user.selectOptions(screen.getByLabelText('订阅渠道'), 'Google Play')
      await user.click(screen.getByRole('button', { name: '保存免费试用' }))

      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      expect(stored.records?.[0].facts.platform).toBe('Google Play')
    })

    it('shows custom text input when 其他 is selected', async () => {
      const user = userEvent.setup()
      window.location.hash = '#/add-trial'
      render(<App />)

      expect(screen.queryByPlaceholderText('例如：支付宝、运营商、第三方平台')).not.toBeInTheDocument()

      await user.selectOptions(screen.getByLabelText('订阅渠道'), '__other__')
      expect(screen.getByPlaceholderText('例如：支付宝、运营商、第三方平台')).toBeInTheDocument()
    })

    it('saves custom platform text when 其他 + text is filled', async () => {
      const user = userEvent.setup()
      localStorage.setItem(
        'subclear_subscriptions',
        JSON.stringify({ schema_version: CURRENT_SCHEMA_VERSION, records: [] }),
      )
      window.location.hash = '#/add-trial'
      render(<App />)

      await user.type(screen.getByPlaceholderText('例如：Notion Pro'), 'Alipay Trial')
      const [trialEndDate] = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
      await user.type(trialEndDate, '2027-08-10')
      await user.selectOptions(screen.getByLabelText('订阅渠道'), '__other__')
      await user.type(screen.getByPlaceholderText('例如：支付宝、运营商、第三方平台'), '支付宝')
      await user.click(screen.getByRole('button', { name: '保存免费试用' }))

      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      expect(stored.records?.[0].facts.platform).toBe('支付宝')
    })

    it('saves platform as null when 其他 is selected but text is empty', async () => {
      const user = userEvent.setup()
      localStorage.setItem(
        'subclear_subscriptions',
        JSON.stringify({ schema_version: CURRENT_SCHEMA_VERSION, records: [] }),
      )
      window.location.hash = '#/add-trial'
      render(<App />)

      await user.type(screen.getByPlaceholderText('例如：Notion Pro'), 'Empty Other')
      const [trialEndDate] = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
      await user.type(trialEndDate, '2027-08-10')
      await user.selectOptions(screen.getByLabelText('订阅渠道'), '__other__')
      await user.click(screen.getByRole('button', { name: '保存免费试用' }))

      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      expect(stored.records?.[0].facts.platform).toBeNull()
    })

    it('clears custom text and saves only the new selection when switching from 其他 to preset', async () => {
      const user = userEvent.setup()
      localStorage.setItem(
        'subclear_subscriptions',
        JSON.stringify({ schema_version: CURRENT_SCHEMA_VERSION, records: [] }),
      )
      window.location.hash = '#/add-trial'
      render(<App />)

      await user.type(screen.getByPlaceholderText('例如：Notion Pro'), 'Switch To App Store')
      const [trialEndDate] = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
      await user.type(trialEndDate, '2027-08-10')
      await user.selectOptions(screen.getByLabelText('订阅渠道'), '__other__')
      await user.type(screen.getByPlaceholderText('例如：支付宝、运营商、第三方平台'), '支付宝')
      // Switch to App Store
      await user.selectOptions(screen.getByLabelText('订阅渠道'), 'App Store')
      // Custom input should be gone
      expect(screen.queryByPlaceholderText('例如：支付宝、运营商、第三方平台')).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: '保存免费试用' }))

      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      expect(stored.records?.[0].facts.platform).toBe('App Store')
    })

    it('clears custom text and saves null when switching from 其他 to 暂不确定', async () => {
      const user = userEvent.setup()
      localStorage.setItem(
        'subclear_subscriptions',
        JSON.stringify({ schema_version: CURRENT_SCHEMA_VERSION, records: [] }),
      )
      window.location.hash = '#/add-trial'
      render(<App />)

      await user.type(screen.getByPlaceholderText('例如：Notion Pro'), 'Switch To Unknown')
      const [trialEndDate] = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
      await user.type(trialEndDate, '2027-08-10')
      await user.selectOptions(screen.getByLabelText('订阅渠道'), '__other__')
      await user.type(screen.getByPlaceholderText('例如：支付宝、运营商、第三方平台'), '支付宝')
      // Switch back to 暂不确定
      await user.selectOptions(screen.getByLabelText('订阅渠道'), '')
      expect(screen.queryByPlaceholderText('例如：支付宝、运营商、第三方平台')).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: '保存免费试用' }))

      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      expect(stored.records?.[0].facts.platform).toBeNull()
    })

    it('does not add a duplicate channel field beyond facts.platform', async () => {
      const user = userEvent.setup()
      localStorage.setItem(
        'subclear_subscriptions',
        JSON.stringify({ schema_version: CURRENT_SCHEMA_VERSION, records: [] }),
      )
      window.location.hash = '#/add-trial'
      render(<App />)

      await user.type(screen.getByPlaceholderText('例如：Notion Pro'), 'No Dup Field')
      const [trialEndDate] = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
      await user.type(trialEndDate, '2027-08-10')
      await user.selectOptions(screen.getByLabelText('订阅渠道'), 'App Store')
      await user.click(screen.getByRole('button', { name: '保存免费试用' }))

      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      const facts = stored.records?.[0].facts
      expect(facts).not.toHaveProperty('subscription_channel')
      expect(facts).not.toHaveProperty('channel')
      expect(facts).not.toHaveProperty('purchase_channel')
      expect(facts).not.toHaveProperty('source_platform')
      expect(facts?.platform).toBe('App Store')
    })

    it('does not modify renewal status when saving platform', async () => {
      const user = userEvent.setup()
      localStorage.setItem(
        'subclear_subscriptions',
        JSON.stringify({ schema_version: CURRENT_SCHEMA_VERSION, records: [] }),
      )
      window.location.hash = '#/add-trial'
      render(<App />)

      await user.type(screen.getByPlaceholderText('例如：Notion Pro'), 'Renewal Unchanged')
      const [trialEndDate] = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
      await user.type(trialEndDate, '2027-08-10')
      await user.selectOptions(screen.getByLabelText('续费方式'), 'auto_renew_off')
      await user.selectOptions(screen.getByLabelText('订阅渠道'), 'App Store')
      await user.click(screen.getByRole('button', { name: '保存免费试用' }))

      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      expect(stored.records?.[0].facts.renewal_status).toBe('auto_renew_off')
    })

    it('does not modify start date when saving platform', async () => {
      const user = userEvent.setup()
      localStorage.setItem(
        'subclear_subscriptions',
        JSON.stringify({ schema_version: CURRENT_SCHEMA_VERSION, records: [] }),
      )
      window.location.hash = '#/add-trial'
      render(<App />)

      await user.type(screen.getByPlaceholderText('例如：Notion Pro'), 'Start Date Unchanged')
      await user.type(screen.getByLabelText('试用开始日期'), '2026-08-01')
      const [trialEndDate] = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
      await user.type(trialEndDate, '2027-08-10')
      await user.selectOptions(screen.getByLabelText('订阅渠道'), 'Google Play')
      await user.click(screen.getByRole('button', { name: '保存免费试用' }))

      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      expect(stored.records?.[0].facts.membership_start_date).toBe('2026-08-01')
    })

    it('does not modify next charge date when saving platform', async () => {
      const user = userEvent.setup()
      localStorage.setItem(
        'subclear_subscriptions',
        JSON.stringify({ schema_version: CURRENT_SCHEMA_VERSION, records: [] }),
      )
      window.location.hash = '#/add-trial'
      render(<App />)

      await user.type(screen.getByPlaceholderText('例如：Notion Pro'), 'Next Charge Unchanged')
      const [trialEndDate] = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
      await user.type(trialEndDate, '2027-08-10')
      await user.selectOptions(screen.getByLabelText('续费方式'), 'auto_renew_on')
      await user.type(screen.getByLabelText('下次自动扣费日期'), '2026-09-01')
      await user.selectOptions(screen.getByLabelText('订阅渠道'), '官方网站')
      await user.click(screen.getByRole('button', { name: '保存免费试用' }))

      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      expect(stored.records?.[0].facts.next_charge_date).toBe('2026-09-01')
    })

    it('shows App Store channel in Detail after Free Trial creation', async () => {
      const user = userEvent.setup()
      localStorage.setItem(
        'subclear_subscriptions',
        JSON.stringify({ schema_version: CURRENT_SCHEMA_VERSION, records: [] }),
      )
      window.location.hash = '#/add-trial'
      render(<App />)

      await user.type(screen.getByPlaceholderText('例如：Notion Pro'), 'Test Trial')
      const [trialEndDate] = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
      await user.type(trialEndDate, '2027-08-10')
      await user.selectOptions(screen.getByLabelText('订阅渠道'), 'App Store')
      await user.click(screen.getByRole('button', { name: '保存免费试用' }))

      // Navigated to My Subscriptions
      expect(screen.getByRole('heading', { name: '记录' })).toBeInTheDocument()

      // Navigate to Detail to verify
      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      window.location.hash = `#/subscription/${stored.records?.[0].facts.id}`
      render(<App />)

      expect(screen.getByText(/订阅渠道：App Store/)).toBeInTheDocument()
    })

    it('shows custom channel in Detail after Paid creation', async () => {
      const user = userEvent.setup()
      localStorage.setItem(
        'subclear_subscriptions',
        JSON.stringify({ schema_version: CURRENT_SCHEMA_VERSION, records: [] }),
      )
      window.location.hash = '#/add-paid'
      render(<App />)

      await user.type(screen.getByPlaceholderText('例如：Spotify Premium'), 'Test Paid')
      await user.type(screen.getByPlaceholderText('10.99'), '10')
      await user.selectOptions(screen.getByDisplayValue('请选择...'), 'monthly')
      await user.selectOptions(screen.getByLabelText('订阅渠道'), '__other__')
      await user.type(screen.getByPlaceholderText('例如：支付宝、运营商、第三方平台'), '支付宝')
      await user.click(screen.getByRole('button', { name: '保存付费会员' }))

      // Navigated to My Subscriptions
      expect(screen.getByRole('heading', { name: '记录' })).toBeInTheDocument()

      // Navigate to Detail to verify
      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      window.location.hash = `#/subscription/${stored.records?.[0].facts.id}`
      render(<App />)

      expect(screen.getByText(/订阅渠道：支付宝/)).toBeInTheDocument()
    })

    it('shows 未记录 in Detail when platform is 暂不确定', async () => {
      const user = userEvent.setup()
      localStorage.setItem(
        'subclear_subscriptions',
        JSON.stringify({ schema_version: CURRENT_SCHEMA_VERSION, records: [] }),
      )
      window.location.hash = '#/add-trial'
      render(<App />)

      await user.type(screen.getByPlaceholderText('例如：Notion Pro'), 'Unknown Platform')
      const [trialEndDate] = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
      await user.type(trialEndDate, '2027-08-10')
      await user.click(screen.getByRole('button', { name: '保存免费试用' }))

      // Navigated to My Subscriptions
      expect(screen.getByRole('heading', { name: '记录' })).toBeInTheDocument()

      // Navigate to Detail to verify
      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      window.location.hash = `#/subscription/${stored.records?.[0].facts.id}`
      render(<App />)

      expect(screen.getByText(/订阅渠道：未记录/)).toBeInTheDocument()
    })
  })

  describe('post-create navigation', () => {
    it('navigates to My Subscriptions after Free Trial save with replace', async () => {
      const user = userEvent.setup()
      localStorage.setItem(
        'subclear_subscriptions',
        JSON.stringify({ schema_version: CURRENT_SCHEMA_VERSION, records: [] }),
      )
      // Simulate navigating from subscriptions to add-trial
      window.history.replaceState(null, '', '#/subscriptions')
      window.history.pushState(null, '', '#/add-trial')
      render(<App />)

      await user.type(screen.getByPlaceholderText('例如：Notion Pro'), 'Nav Trial')
      const [trialEndDate] = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
      await user.type(trialEndDate, '2027-08-10')
      await user.click(screen.getByRole('button', { name: '保存免费试用' }))

      // Should land on subscriptions
      expect(screen.getByRole('heading', { name: '记录' })).toBeInTheDocument()

      // Back should not go to add form (history was replaced)
      window.history.back()
      // After history.back(), if replace was used, we go to #/subscriptions or #/
      // The key assertion: we should not be on add-trial
      expect(window.location.hash).not.toBe('#/add-trial')
    })

    it('navigates to My Subscriptions after Paid save with replace', async () => {
      const user = userEvent.setup()
      localStorage.setItem(
        'subclear_subscriptions',
        JSON.stringify({ schema_version: CURRENT_SCHEMA_VERSION, records: [] }),
      )
      window.history.replaceState(null, '', '#/subscriptions')
      window.history.pushState(null, '', '#/add-paid')
      render(<App />)

      await user.type(screen.getByPlaceholderText('例如：Spotify Premium'), 'Nav Paid')
      await user.type(screen.getByPlaceholderText('10.99'), '10')
      await user.selectOptions(screen.getByDisplayValue('请选择...'), 'monthly')
      await user.click(screen.getByRole('button', { name: '保存付费会员' }))

      expect(screen.getByRole('heading', { name: '记录' })).toBeInTheDocument()
      expect(window.location.hash).not.toBe('#/add-paid')
    })

    it('does not navigate away when validation fails', async () => {
      const user = userEvent.setup()
      window.location.hash = '#/add-trial'
      render(<App />)

      await user.click(screen.getByRole('button', { name: '保存免费试用' }))
      expect(screen.getByText('服务名称为必填项。')).toBeInTheDocument()
      expect(window.location.hash).toBe('#/add-trial')
    })
  })

  describe('CRUD: edit and delete', () => {
    function seedTrialRecord(): string {
      const id = `s_test_${Date.now()}`
      localStorage.setItem(
        'subclear_subscriptions',
        JSON.stringify({
          schema_version: CURRENT_SCHEMA_VERSION,
          records: [
            {
              facts: {
                id,
                service_name: 'Editable Trial',
                plan_name: null,
                category: null,
                platform: 'App Store',
                entitlement_type: 'trial',
                membership_start_date: '2026-08-01',
                membership_end_date: '2027-08-10',
                renewal_status: 'auto_renew_off' as const,
                next_charge_date: null,
                renewal_price: 10,
                currency: null,
                billing_cycle: 'monthly' as const,
                cancellation_status: 'none' as const,
                cancellation_path: 'https://example.com/cancel',
                cancellation_steps: [],
                cancellation_deadline: null,
                planned_cancel_date: null,
                cancellation_completed_at: null,
                cancellation_proof: null,
                reminder_settings: { enabled: true, offset_days: 3, state: 'enabled' as const },
                evidence_records: [],
                schema_version: CURRENT_SCHEMA_VERSION,
                created_at: '2026-08-01T00:00:00.000Z',
                updated_at: '2026-08-01T00:00:00.000Z',
              },
            },
          ],
        }),
      )
      return id
    }

    function seedPaidRecord(): string {
      const id = `s_test_paid_${Date.now()}`
      localStorage.setItem(
        'subclear_subscriptions',
        JSON.stringify({
          schema_version: CURRENT_SCHEMA_VERSION,
          records: [
            {
              facts: {
                id,
                service_name: 'Editable Paid',
                plan_name: null,
                category: null,
                platform: 'Google Play',
                entitlement_type: 'paid_membership',
                membership_start_date: '2026-08-01',
                membership_end_date: null,
                renewal_status: 'auto_renew_on' as const,
                next_charge_date: '2026-09-01',
                renewal_price: 15,
                currency: 'USD',
                billing_cycle: 'monthly' as const,
                cancellation_status: 'none' as const,
                cancellation_path: null,
                cancellation_steps: [],
                cancellation_deadline: null,
                planned_cancel_date: null,
                cancellation_completed_at: null,
                cancellation_proof: null,
                reminder_settings: { enabled: true, offset_days: 7, state: 'enabled' as const },
                evidence_records: [],
                schema_version: CURRENT_SCHEMA_VERSION,
                created_at: '2026-08-01T00:00:00.000Z',
                updated_at: '2026-08-01T00:00:00.000Z',
              },
            },
          ],
        }),
      )
      return id
    }

    it('Detail shows edit link', () => {
      const id = seedTrialRecord()
      window.location.hash = `#/subscription/${id}`
      render(<App />)
      expect(screen.getByText('编辑记录')).toBeInTheDocument()
    })

    it('edit link navigates to edit page', async () => {
      const user = userEvent.setup()
      const id = seedTrialRecord()
      window.location.hash = `#/subscription/${id}`
      render(<App />)

      await user.click(screen.getByText('编辑记录'))
      expect(screen.getByRole('heading', { name: '编辑会员记录' })).toBeInTheDocument()
    })

    it('edit page is a secondary route with one Back button', () => {
      const id = seedTrialRecord()
      window.location.hash = `#/subscription/${id}/edit`
      render(<App />)

      expect(screen.getByTestId('page-back-button')).toBeInTheDocument()
      expect(screen.getAllByTestId('page-back-button')).toHaveLength(1)
      expect(screen.queryByRole('img', { name: 'SubClear logo' })).not.toBeInTheDocument()
    })

    it('edit page pre-fills Trial canonical data', () => {
      const id = seedTrialRecord()
      window.location.hash = `#/subscription/${id}/edit`
      render(<App />)

      expect(screen.getByDisplayValue('Editable Trial')).toBeInTheDocument()
      expect(screen.getByDisplayValue('2026-08-01')).toBeInTheDocument()
      expect(screen.getByDisplayValue('2027-08-10')).toBeInTheDocument()
      expect(screen.getByDisplayValue('10')).toBeInTheDocument()
    })

    it('edit page pre-fills platform correctly', () => {
      const id = seedTrialRecord()
      window.location.hash = `#/subscription/${id}/edit`
      render(<App />)

      const platformSelect = screen.getByLabelText('订阅渠道')
      expect(platformSelect).toHaveValue('App Store')
    })

    it('edit page pre-fills renewal status', () => {
      const id = seedTrialRecord()
      window.location.hash = `#/subscription/${id}/edit`
      render(<App />)

      const renewalSelect = screen.getByLabelText('续费方式')
      expect(renewalSelect).toHaveValue('auto_renew_off')
    })

    it('edit page pre-fills Paid canonical data', () => {
      const id = seedPaidRecord()
      window.location.hash = `#/subscription/${id}/edit`
      render(<App />)

      expect(screen.getByDisplayValue('Editable Paid')).toBeInTheDocument()
      expect(screen.getByDisplayValue('2026-08-01')).toBeInTheDocument()
      expect(screen.getByDisplayValue('15')).toBeInTheDocument()
      expect(screen.getByDisplayValue('USD')).toBeInTheDocument()
    })

    it('edit page pre-fills Paid platform', () => {
      const id = seedPaidRecord()
      window.location.hash = `#/subscription/${id}/edit`
      render(<App />)

      expect(screen.getByLabelText('订阅渠道')).toHaveValue('Google Play')
    })

    it('edit save updates record and navigates to Detail', async () => {
      const user = userEvent.setup()
      const id = seedTrialRecord()
      window.location.hash = `#/subscription/${id}/edit`
      render(<App />)

      const nameInput = screen.getByDisplayValue('Editable Trial')
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated Trial')

      await user.click(screen.getByRole('button', { name: '保存修改' }))

      // Should navigate to Detail
      expect(screen.getByRole('heading', { name: 'Updated Trial' })).toBeInTheDocument()

      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      expect(stored.records?.[0].facts.service_name).toBe('Updated Trial')
    })

    it('edit preserves record id after save', async () => {
      const user = userEvent.setup()
      const id = seedTrialRecord()
      window.location.hash = `#/subscription/${id}/edit`
      render(<App />)

      const nameInput = screen.getByDisplayValue('Editable Trial')
      await user.clear(nameInput)
      await user.type(nameInput, 'Preserved ID')
      await user.click(screen.getByRole('button', { name: '保存修改' }))

      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      expect(stored.records?.[0].facts.id).toBe(id)
    })

    it('edit preserves created_at after save', async () => {
      const user = userEvent.setup()
      const id = seedTrialRecord()
      window.location.hash = `#/subscription/${id}/edit`
      render(<App />)

      const nameInput = screen.getByDisplayValue('Editable Trial')
      await user.clear(nameInput)
      await user.type(nameInput, 'Created At')
      await user.click(screen.getByRole('button', { name: '保存修改' }))

      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      expect(stored.records?.[0].facts.created_at).toBe('2026-08-01T00:00:00.000Z')
    })

    it('edit updates updated_at after save', async () => {
      const user = userEvent.setup()
      const id = seedTrialRecord()
      window.location.hash = `#/subscription/${id}/edit`
      render(<App />)

      const nameInput = screen.getByDisplayValue('Editable Trial')
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated At')
      await user.click(screen.getByRole('button', { name: '保存修改' }))

      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      expect(stored.records?.[0].facts.updated_at).not.toBe('2026-08-01T00:00:00.000Z')
    })

    it('edit updates platform correctly', async () => {
      const user = userEvent.setup()
      const id = seedTrialRecord()
      window.location.hash = `#/subscription/${id}/edit`
      render(<App />)

      await user.selectOptions(screen.getByLabelText('订阅渠道'), '官方网站')
      await user.click(screen.getByRole('button', { name: '保存修改' }))

      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      expect(stored.records?.[0].facts.platform).toBe('官方网站')
    })

    it('edit updates start date correctly', async () => {
      const user = userEvent.setup()
      const id = seedTrialRecord()
      window.location.hash = `#/subscription/${id}/edit`
      render(<App />)

      const startDateInput = screen.getByLabelText('试用开始日期')
      await user.clear(startDateInput)
      await user.type(startDateInput, '2026-09-01')
      await user.click(screen.getByRole('button', { name: '保存修改' }))

      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      expect(stored.records?.[0].facts.membership_start_date).toBe('2026-09-01')
    })

    it('edit clears next charge date when switching from auto_renew_on', async () => {
      const user = userEvent.setup()
      const id = seedPaidRecord()
      window.location.hash = `#/subscription/${id}/edit`
      render(<App />)

      // Paid record has auto_renew_on with next_charge_date
      await user.selectOptions(screen.getByLabelText('续费方式'), 'auto_renew_off')
      await user.click(screen.getByRole('button', { name: '保存修改' }))

      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      expect(stored.records?.[0].facts.renewal_status).toBe('auto_renew_off')
      expect(stored.records?.[0].facts.next_charge_date).toBeNull()
    })

    it('edit back button returns to Detail without saving', async () => {
      const user = userEvent.setup()
      const id = seedTrialRecord()
      window.location.hash = `#/subscription/${id}/edit`
      render(<App />)

      const nameInput = screen.getByDisplayValue('Editable Trial')
      await user.clear(nameInput)
      await user.type(nameInput, 'Should Not Save')

      await user.click(screen.getByTestId('page-back-button'))

      expect(screen.getByRole('heading', { name: 'Editable Trial' })).toBeInTheDocument()

      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      expect(stored.records?.[0].facts.service_name).toBe('Editable Trial')
    })

    it('Detail shows delete entry', () => {
      const id = seedTrialRecord()
      window.location.hash = `#/subscription/${id}`
      render(<App />)
      expect(screen.getByText('删除记录')).toBeInTheDocument()
    })

    it('clicking delete shows confirmation modal', async () => {
      const user = userEvent.setup()
      const id = seedTrialRecord()
      window.location.hash = `#/subscription/${id}`
      render(<App />)

      await user.click(screen.getByText('删除记录'))
      expect(screen.getByRole('dialog', { name: '删除记录' })).toBeInTheDocument()
      expect(screen.getByText('删除这条记录？')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '确认删除' })).toBeInTheDocument()
    })

    it('canceling delete keeps the record', async () => {
      const user = userEvent.setup()
      const id = seedTrialRecord()
      window.location.hash = `#/subscription/${id}`
      render(<App />)

      await user.click(screen.getByText('删除记录'))
      await user.click(screen.getByRole('button', { name: '取消' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      expect(stored.records).toHaveLength(1)
    })

    it('confirming delete removes the record and navigates to subscriptions', async () => {
      const user = userEvent.setup()
      const id = seedTrialRecord()
      window.location.hash = `#/subscription/${id}`
      render(<App />)

      await user.click(screen.getByText('删除记录'))
      await user.click(screen.getByRole('button', { name: '确认删除' }))

      expect(screen.getByRole('heading', { name: '记录' })).toBeInTheDocument()

      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      expect(stored.records).toHaveLength(0)
    })

    it('deleting last record shows empty state', async () => {
      const user = userEvent.setup()
      const id = seedTrialRecord()
      window.location.hash = `#/subscription/${id}`
      render(<App />)

      await user.click(screen.getByText('删除记录'))
      await user.click(screen.getByRole('button', { name: '确认删除' }))

      expect(screen.getByText(/还没有记录/)).toBeInTheDocument()
    })

    it('delete cascades evidence embedded in the record', async () => {
      const user = userEvent.setup()
      const id = `s_evidence_${Date.now()}`
      localStorage.setItem(
        'subclear_subscriptions',
        JSON.stringify({
          schema_version: CURRENT_SCHEMA_VERSION,
          records: [
            {
              facts: {
                id,
                service_name: 'Has Evidence',
                plan_name: null,
                category: null,
                platform: null,
                entitlement_type: 'trial',
                membership_start_date: null,
                membership_end_date: '2027-08-10',
                renewal_status: 'unknown' as const,
                next_charge_date: null,
                renewal_price: null,
                currency: null,
                billing_cycle: null,
                cancellation_status: 'none' as const,
                cancellation_path: null,
                cancellation_steps: [],
                cancellation_deadline: null,
                planned_cancel_date: null,
                cancellation_completed_at: null,
                cancellation_proof: null,
                reminder_settings: { enabled: true, offset_days: 3, state: 'enabled' as const },
                evidence_records: [
                  {
                    id: 'ev_1',
                    source_url: null,
                    source_type: 'screenshot',
                    extracted_fields: [],
                    captured_at: '2026-08-01T00:00:00.000Z',
                    resolution_status: 'unresolved',
                    notes: '',
                  },
                ],
                schema_version: CURRENT_SCHEMA_VERSION,
                created_at: '2026-08-01T00:00:00.000Z',
                updated_at: '2026-08-01T00:00:00.000Z',
              },
            },
          ],
        }),
      )

      window.location.hash = `#/subscription/${id}`
      render(<App />)

      await user.click(screen.getByText('删除记录'))
      await user.click(screen.getByRole('button', { name: '确认删除' }))

      // No records left, no orphan evidence possible since evidence is embedded
      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      expect(stored.records).toHaveLength(0)
    })

    it('delete does not affect other records', async () => {
      const user = userEvent.setup()
      const idToDelete = 's_delete_me'
      const idToKeep = 's_keep_me'
      localStorage.setItem(
        'subclear_subscriptions',
        JSON.stringify({
          schema_version: CURRENT_SCHEMA_VERSION,
          records: [
            {
              facts: {
                id: idToDelete,
                service_name: 'Delete Me',
                plan_name: null,
                category: null,
                platform: null,
                entitlement_type: 'trial',
                membership_start_date: null,
                membership_end_date: '2027-08-10',
                renewal_status: 'unknown' as const,
                next_charge_date: null,
                renewal_price: null,
                currency: null,
                billing_cycle: null,
                cancellation_status: 'none' as const,
                cancellation_path: null,
                cancellation_steps: [],
                cancellation_deadline: null,
                planned_cancel_date: null,
                cancellation_completed_at: null,
                cancellation_proof: null,
                reminder_settings: { enabled: true, offset_days: 3, state: 'enabled' as const },
                evidence_records: [],
                schema_version: CURRENT_SCHEMA_VERSION,
                created_at: '2026-08-01T00:00:00.000Z',
                updated_at: '2026-08-01T00:00:00.000Z',
              },
            },
            {
              facts: {
                id: idToKeep,
                service_name: 'Keep Me',
                plan_name: null,
                category: null,
                platform: null,
                entitlement_type: 'paid_membership',
                membership_start_date: null,
                membership_end_date: null,
                renewal_status: 'unknown' as const,
                next_charge_date: null,
                renewal_price: 5,
                currency: 'USD',
                billing_cycle: 'monthly' as const,
                cancellation_status: 'none' as const,
                cancellation_path: null,
                cancellation_steps: [],
                cancellation_deadline: null,
                planned_cancel_date: null,
                cancellation_completed_at: null,
                cancellation_proof: null,
                reminder_settings: { enabled: true, offset_days: 7, state: 'enabled' as const },
                evidence_records: [],
                schema_version: CURRENT_SCHEMA_VERSION,
                created_at: '2026-08-01T00:00:00.000Z',
                updated_at: '2026-08-01T00:00:00.000Z',
              },
            },
          ],
        }),
      )

      window.location.hash = `#/subscription/${idToDelete}`
      render(<App />)

      await user.click(screen.getByText('删除记录'))
      await user.click(screen.getByRole('button', { name: '确认删除' }))

      const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
        records?: SubscriptionRecord[]
      }
      expect(stored.records).toHaveLength(1)
      expect(stored.records?.[0].facts.id).toBe(idToKeep)
    })
  })
})
