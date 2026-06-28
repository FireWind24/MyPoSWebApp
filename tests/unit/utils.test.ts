import { describe, it, expect } from 'vitest'
import { n2, n0, fmt, esc, generateId } from '@shared/utils'

describe('n2', () => {
  it('formats numbers to 2 decimal places', () => {
    expect(n2(5)).toBe('5.00')
    expect(n2(5.5)).toBe('5.50')
    expect(n2(5.556)).toBe('5.56')
  })

  it('handles string inputs', () => {
    expect(n2('10')).toBe('10.00')
    expect(n2('10.5')).toBe('10.50')
  })

  it('handles invalid inputs', () => {
    expect(n2(null as any)).toBe('0.00')
    expect(n2(undefined as any)).toBe('0.00')
  })
})

describe('n0', () => {
  it('returns parsed float', () => {
    expect(n0(5)).toBe(5)
    expect(n0('10.5')).toBe(10.5)
  })

  it('returns 0 for invalid inputs', () => {
    expect(n0(null)).toBe(0)
    expect(n0(undefined)).toBe(0)
    expect(n0('abc')).toBe(0)
  })
})

describe('fmt', () => {
  it('formats as Rs currency', () => {
    expect(fmt(100)).toContain('100')
    expect(fmt(1000)).toContain('1,000')
  })

  it('includes Rs prefix', () => {
    expect(fmt(50)).toMatch(/^Rs /)
  })
})

describe('esc', () => {
  it('escapes HTML entities', () => {
    expect(esc('<script>')).toBe('&lt;script&gt;')
    expect(esc('&')).toBe('&amp;')
    expect(esc('"hello"')).toBe('&quot;hello&quot;')
  })
})

describe('generateId', () => {
  it('generates a string id', () => {
    const id = generateId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(10)
  })

  it('generates unique ids', () => {
    const id1 = generateId()
    const id2 = generateId()
    expect(id1).not.toBe(id2)
  })
})
