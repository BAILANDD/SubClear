import { Link, useLocation } from 'react-router-dom'
import NavIcon from './NavIcon'

export default function BottomNavigation() {
  const location = useLocation()

  return (
    <nav aria-label="主导航" className="bottom-navigation safe-area-bottom">
      <NavItem to="/" label="Home" icon="home" isActive={location.pathname === '/'} />
      <NavItem
        to="/subscriptions"
        label="My Subscriptions"
        icon="records"
        isActive={
          location.pathname.startsWith('/subscriptions') ||
          location.pathname.startsWith('/subscription/')
        }
      />
    </nav>
  )
}

function NavItem({
  to,
  label,
  icon,
  isActive,
}: {
  to: string
  label: string
  icon: 'home' | 'records'
  isActive: boolean
}) {
  return (
    <Link
      to={to}
      aria-current={isActive ? 'page' : undefined}
      className={`nav-item ${isActive ? 'is-active' : ''}`}
    >
      <NavIcon name={icon} />
      <span className="nav-label">{label}</span>
    </Link>
  )
}
