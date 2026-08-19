import { HashRouter, Routes, Route } from 'react-router-dom'
import { SubscriptionProvider } from './store/SubscriptionProvider'
import AppShell from './components/AppShell'
import { APP_ROUTES } from './appRoutes'

function App() {
  return (
    <SubscriptionProvider>
      <HashRouter>
        <AppShell>
          <Routes>
            {APP_ROUTES.map(({ path, Component }) => (
              <Route key={path} path={path} element={<Component />} />
            ))}
          </Routes>
        </AppShell>
      </HashRouter>
    </SubscriptionProvider>
  )
}

export default App
