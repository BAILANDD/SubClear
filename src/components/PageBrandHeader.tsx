import { Link } from 'react-router-dom'

interface PageBrandHeaderProps {
  testId?: string
}

export default function PageBrandHeader({ testId = 'page-brand-header' }: PageBrandHeaderProps) {
  return (
    <div className="home-brand-row" data-testid={testId}>
      <span className="brand-mark" role="img" aria-label="SubClear logo">
        <span />
        <span />
      </span>
      <Link
        to="/settings"
        className="profile-avatar-link"
        aria-label="Open profile, settings, and data"
      >
        <img
          src="/avatar-placeholder.svg"
          alt=""
          className="profile-avatar-image"
          data-testid="profile-avatar-image"
        />
      </Link>
    </div>
  )
}
