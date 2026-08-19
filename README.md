# SubClear

SubClear is a local interactive MVP demo for a lightweight subscription and trial-period control tool.

The demo focuses on manually entered subscription data, renewal/trial reminders, cancellation notes, status tracking, and local CSV/JSON export.

SubClear does not connect to bank accounts, process payments, cancel subscriptions automatically, send real notifications, or use AI recommendations.

## Local Commands

```bash
npm run dev
npm run lint
npx tsc -b --noEmit
npm run test
npm run build
```

## Baseline Regression Checklist

Before and after future AI Capture work, the current Manual MVP should continue to support:

- Dashboard can load.
- Subscription List can open.
- Add Free Trial can open and save.
- Add Paid Subscription can open and save.
- Subscription Detail can open.
- Reminder Settings can open and save simulated reminder state.
- Cancellation Notes can open and save.
- CSV Export can be triggered.
- JSON Export can be triggered.
- localStorage can read valid records after refresh.
- Routes continue to use the current HashRouter paths.

## Scope

- Dashboard
- Subscription list
- Add free trial
- Add paid subscription
- Subscription detail
- Reminder settings with simulated reminder states
- Cancellation notes
- Settings / data export
