type NavIconName = 'home' | 'records' | 'add' | 'settings'

const iconPaths: Record<NavIconName, React.ReactNode> = {
  home: <path d="M3.5 10.5 10 4l6.5 6.5v6a1.5 1.5 0 0 1-1.5 1.5h-3v-5H8v5H5a1.5 1.5 0 0 1-1.5-1.5z" />,
  records: (
    <>
      <rect x="4" y="3.5" width="12" height="13" rx="2" />
      <path d="M7 7h6M7 10h6M7 13h4" />
    </>
  ),
  add: <path d="M10 4v12M4 10h12" />,
  settings: (
    <>
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2.8v1.4M10 15.8v1.4M17.2 10h-1.4M4.2 10H2.8M15.1 4.9l-1 1M5.9 14.1l-1 1M15.1 15.1l-1-1M5.9 5.9l-1-1" />
    </>
  ),
}

export default function NavIcon({ name }: { name: NavIconName }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="nav-icon"
    >
      {iconPaths[name]}
    </svg>
  )
}
