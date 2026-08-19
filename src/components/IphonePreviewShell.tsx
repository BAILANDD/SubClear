import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  DEFAULT_IPHONE_FRAME_SCALE,
  IPHONE_PRODUCT_VIEWPORT,
  IPHONE_SCREEN_OPENING,
  IPHONE_SVG_HEIGHT,
  IPHONE_SVG_WIDTH,
  getIphonePreviewIframeSrc,
} from './iphonePreviewConfig'

export default function IphonePreviewShell() {
  const screenRef = useRef<HTMLDivElement | null>(null)
  const [frameScale, setFrameScale] = useState(DEFAULT_IPHONE_FRAME_SCALE)
  const iframeSrc = getIphonePreviewIframeSrc(window.location)

  useEffect(() => {
    const screen = screenRef.current
    if (!screen) return undefined

    function updateFrameScale() {
      if (!screen) return
      const rect = screen.getBoundingClientRect()
      setFrameScale(
        Math.min(
          rect.width / IPHONE_PRODUCT_VIEWPORT.width,
          rect.height / IPHONE_PRODUCT_VIEWPORT.height,
        ),
      )
    }

    updateFrameScale()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateFrameScale)
      return () => window.removeEventListener('resize', updateFrameScale)
    }

    const observer = new ResizeObserver(updateFrameScale)
    observer.observe(screen)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="iphone-preview-page" data-testid="iphone-preview-shell">
      <div
        className="iphone-device"
        aria-label="SubClear iPhone preview device"
        style={
          {
            '--iphone-screen-x': `${(IPHONE_SCREEN_OPENING.x / IPHONE_SVG_WIDTH) * 100}%`,
            '--iphone-screen-y': `${(IPHONE_SCREEN_OPENING.y / IPHONE_SVG_HEIGHT) * 100}%`,
            '--iphone-screen-width': `${(IPHONE_SCREEN_OPENING.width / IPHONE_SVG_WIDTH) * 100}%`,
            '--iphone-screen-height': `${(IPHONE_SCREEN_OPENING.height / IPHONE_SVG_HEIGHT) * 100}%`,
            '--iphone-frame-scale': frameScale,
          } as CSSProperties
        }
      >
        <div ref={screenRef} className="iphone-screen">
          <div className="iphone-preview-frame">
            <iframe
              title="SubClear iPhone preview"
              src={iframeSrc}
              width={IPHONE_PRODUCT_VIEWPORT.width}
              height={IPHONE_PRODUCT_VIEWPORT.height}
            />
          </div>
        </div>

        <img
          className="iphone-shell-overlay"
          src="/iphone/iphone-pro-shell.svg"
          alt=""
          data-testid="iphone-shell-overlay"
        />
      </div>
    </div>
  )
}
