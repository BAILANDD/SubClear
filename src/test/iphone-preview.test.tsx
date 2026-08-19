import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../App'
import IphonePreviewShell from '../components/IphonePreviewShell'
import {
  getIphonePreviewIframeSrc,
  isIphonePreviewSearch,
} from '../components/iphonePreviewConfig'

describe('iPhone preview mode', () => {
  it('detects preview mode only from the URL search params', () => {
    expect(isIphonePreviewSearch('?preview=iphone')).toBe(true)
    expect(isIphonePreviewSearch('')).toBe(false)
    expect(isIphonePreviewSearch('?preview=ipad')).toBe(false)
  })

  it('builds an iframe src for the existing product route without recursive preview params', () => {
    const src = getIphonePreviewIframeSrc({
      origin: 'http://localhost:51175',
      pathname: '/',
    } as Location)

    expect(src).toBe('http://localhost:51175/#/')
    expect(src).not.toContain('preview=iphone')
  })

  it('renders the iPhone shell with a same-origin product iframe', () => {
    render(<IphonePreviewShell />)

    expect(screen.getByTestId('iphone-preview-shell')).toBeInTheDocument()
    const frame = screen.getByTitle('SubClear iPhone preview')
    expect(frame).toHaveAttribute('src', 'http://localhost:3000/#/')
    expect(frame).not.toHaveAttribute('src', expect.stringContaining('preview=iphone'))
    expect(screen.getByTestId('iphone-shell-overlay')).toHaveAttribute(
      'src',
      '/iphone/iphone-pro-shell.svg',
    )
    expect(screen.queryByRole('banner', { name: 'SubClear 应用' })).not.toBeInTheDocument()
  })

  it('keeps the normal App route renderable without the preview shell', () => {
    window.location.hash = '#/settings'

    render(<App />)

    expect(screen.queryByTestId('iphone-preview-shell')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '设置 / 数据' })).toBeInTheDocument()
  })
})
