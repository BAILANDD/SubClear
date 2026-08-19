export const IPHONE_SVG_WIDTH = 450
export const IPHONE_SVG_HEIGHT = 920

export const IPHONE_PRODUCT_VIEWPORT = {
  width: 390,
  height: 844,
} as const

export const IPHONE_SCREEN_OPENING = {
  x: 24,
  y: 23,
  width: 402,
  height: 874,
  radius: 39,
} as const

export const DEFAULT_IPHONE_FRAME_SCALE =
  IPHONE_SCREEN_OPENING.width / IPHONE_PRODUCT_VIEWPORT.width

export function isIphonePreviewSearch(search: string): boolean {
  return new URLSearchParams(search).get('preview') === 'iphone'
}

export function getIphonePreviewIframeSrc(location: Pick<Location, 'origin' | 'pathname'>): string {
  return `${location.origin}${location.pathname}#/`
}
