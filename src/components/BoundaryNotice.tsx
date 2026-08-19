export default function BoundaryNotice({ text }: { text: string }) {
  return (
    <div className="boundary-notice">
      <span className="boundary-dot" aria-hidden="true" />
      <span>{text}</span>
    </div>
  )
}
