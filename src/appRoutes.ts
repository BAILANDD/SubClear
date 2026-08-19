import type { ComponentType } from 'react'
import AddFreeTrial from './pages/AddFreeTrial'
import AddPaidSubscription from './pages/AddPaidSubscription'
import CancellationNotes from './pages/CancellationNotes'
import EditSubscription from './pages/EditSubscription'
import Dashboard from './pages/Dashboard'
import ReminderSettings from './pages/ReminderSettings'
import ReviewExtractedDetails from './pages/ReviewExtractedDetails'
import ScreenshotUpload from './pages/ScreenshotUpload'
import SettingsDataExport from './pages/SettingsDataExport'
import SubscriptionDetail from './pages/SubscriptionDetail'
import SubscriptionList from './pages/SubscriptionList'

export interface AppRouteDefinition {
  path: string
  Component: ComponentType
  level: 'primary' | 'secondary'
  testPath: string
  heading?: string
  parent: string
  fallback?: string
}

export const APP_ROUTES: readonly AppRouteDefinition[] = [
  {
    path: '/',
    Component: Dashboard,
    level: 'primary',
    testPath: '/',
    parent: 'Primary navigation',
  },
  {
    path: '/subscriptions',
    Component: SubscriptionList,
    level: 'primary',
    testPath: '/subscriptions',
    heading: '记录',
    parent: 'Primary navigation',
  },
  {
    path: '/add-trial',
    Component: AddFreeTrial,
    level: 'secondary',
    testPath: '/add-trial',
    heading: '添加免费试用',
    parent: 'Add membership / My Subscriptions',
    fallback: '/subscriptions',
  },
  {
    path: '/add-paid',
    Component: AddPaidSubscription,
    level: 'secondary',
    testPath: '/add-paid',
    heading: '添加付费会员',
    parent: 'Add membership / My Subscriptions',
    fallback: '/subscriptions',
  },
  {
    path: '/scan-screenshot',
    Component: ScreenshotUpload,
    level: 'secondary',
    testPath: '/scan-screenshot',
    heading: '扫描截图',
    parent: 'Add membership / My Subscriptions',
    fallback: '/subscriptions',
  },
  {
    path: '/review-extracted',
    Component: ReviewExtractedDetails,
    level: 'secondary',
    testPath: '/review-extracted',
    heading: '添加订阅',
    parent: 'Screenshot Capture',
    fallback: '/scan-screenshot',
  },
  {
    path: '/subscription/:id',
    Component: SubscriptionDetail,
    level: 'secondary',
    testPath: '/subscription/s1',
    heading: 'Notion Pro',
    parent: 'My Subscriptions',
    fallback: '/subscriptions',
  },
  {
    path: '/subscription/:id/edit',
    Component: EditSubscription,
    level: 'secondary',
    testPath: '/subscription/s1/edit',
    heading: '编辑会员记录',
    parent: 'Subscription Detail',
    fallback: '/subscription/s1',
  },
  {
    path: '/subscription/:id/reminder',
    Component: ReminderSettings,
    level: 'secondary',
    testPath: '/subscription/s1/reminder',
    heading: '提醒设置',
    parent: 'Subscription Detail',
    fallback: '/subscription/s1',
  },
  {
    path: '/subscription/:id/cancellation',
    Component: CancellationNotes,
    level: 'secondary',
    testPath: '/subscription/s1/cancellation',
    heading: '取消计划',
    parent: 'Subscription Detail',
    fallback: '/subscription/s1',
  },
  {
    path: '/settings',
    Component: SettingsDataExport,
    level: 'secondary',
    testPath: '/settings',
    heading: '设置 / 数据',
    parent: 'Home or My Subscriptions',
    fallback: '/',
  },
]
