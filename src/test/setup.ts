import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, String(value)) }
}

const memoryStorage = new MemoryStorage()
Object.defineProperty(window, 'localStorage', { configurable: true, value: memoryStorage })
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memoryStorage })

if (!globalThis.crypto.randomUUID) {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: () => `test-${Math.random().toString(16).slice(2)}`,
  })
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
})
