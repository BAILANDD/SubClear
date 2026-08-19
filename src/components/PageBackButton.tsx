import useAppBack from '../hooks/useAppBack'

interface PageBackButtonProps {
  fallback: string
  label: string
  onBack?: () => void
}

export default function PageBackButton({ fallback, label, onBack }: PageBackButtonProps) {
  const navigateBack = useAppBack(fallback)

  return (
    <button
      type="button"
      className="page-back-button"
      onClick={onBack ?? navigateBack}
      aria-label={label}
      data-testid="page-back-button"
    >
      <span aria-hidden="true">←</span>
      <span>{label}</span>
    </button>
  )
}
