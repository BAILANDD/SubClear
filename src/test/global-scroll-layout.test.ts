/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

function getRuleBody(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 's'))?.[1] ?? ''
}

describe('shared app scroll layout CSS', () => {
  it('keeps content safe area independent from the taller top fade', () => {
    const rootRule = getRuleBody(':root')
    const sharedPageOffsetRule = getRuleBody('.app-main')
    const fadeRule = getRuleBody('.app-top-scroll-fade')

    expect(rootRule).toContain('--app-top-safe-area: 72px;')
    expect(rootRule).toContain('--app-top-fade-height: 88px;')
    expect(sharedPageOffsetRule).toContain(
      'padding: var(--app-top-safe-area) 20px var(--bottom-navigation-clearance);',
    )
    expect(css).not.toContain('.app-shell-home .app-main')
    expect(css).not.toContain('.app-shell-page-brand-header .app-main')
    expect(css).not.toContain('.app-shell-subscription-detail .app-main')
    expect(fadeRule).toContain('height: var(--app-top-fade-height);')
  })

  it('hides only the shared document scrollbar without disabling page or filter scrolling', () => {
    const htmlRule = getRuleBody('html')
    const rootRule = getRuleBody('#root')
    const webkitDocumentScrollbarRule = getRuleBody('html::-webkit-scrollbar')
    const filterRailRule = getRuleBody('.filter-rail')

    expect(htmlRule).toContain('scrollbar-width: none;')
    expect(htmlRule).toContain('-ms-overflow-style: none;')
    expect(webkitDocumentScrollbarRule).toContain('display: none;')
    expect(webkitDocumentScrollbarRule).toContain('width: 0;')
    expect(webkitDocumentScrollbarRule).toContain('height: 0;')
    expect(css).not.toContain('overflow-y: hidden;')
    expect(rootRule).not.toContain('scrollbar-width: none;')
    expect(filterRailRule).toContain('overflow-x: auto;')
    expect(filterRailRule).toContain('scrollbar-width: none;')
    expect(css).not.toMatch(
      /(?:dashboard-page|subscriptions-page|app-shell|app-main)[^{,]*::-webkit-scrollbar/,
    )
  })

  it('removes dead global header styles while preserving page brand header styles', () => {
    expect(getRuleBody('.app-header')).toBe('')
    expect(getRuleBody('.app-identity')).toBe('')
    expect(getRuleBody('.header-actions')).toBe('')
    expect(getRuleBody('.brand-mark')).not.toBe('')
    expect(getRuleBody('.profile-avatar-link')).not.toBe('')
    expect(getRuleBody('.profile-avatar-image')).not.toBe('')
  })

  it('gives the shared Back control a stable mobile touch target', () => {
    const backRule = getRuleBody('.page-back-button')

    expect(backRule).toContain('min-width: 44px;')
    expect(backRule).toContain('min-height: 44px;')
    expect(backRule).toContain('flex: 0 0 auto;')
  })

  it('adds secondary header breathing room without changing shared safe-area geometry', () => {
    const rootRule = getRuleBody(':root')
    const secondaryPageRule = getRuleBody('.secondary-page')
    const fadeRule = getRuleBody('.app-top-scroll-fade')

    expect(rootRule).toContain('--secondary-page-header-offset: 10px;')
    expect(secondaryPageRule).toContain(
      'margin-top: var(--secondary-page-header-offset);',
    )
    expect(rootRule).toContain('--app-top-safe-area: 72px;')
    expect(rootRule).toContain('--app-top-fade-height: 88px;')
    expect(fadeRule).toContain('height: var(--app-top-fade-height);')
    expect(css).not.toMatch(/(?:dashboard-page|subscriptions-page)[^{]*secondary-page/)
  })
})
