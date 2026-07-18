import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// vitest's jsdom environment stubs `localStorage` as an empty plain object
// rather than a real Storage instance, regardless of environmentOptions.jsdom.url
// — swap in a minimal in-memory implementation so app code and tests that
// touch localStorage behave like they would in a real browser.
class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length() {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
}

vi.stubGlobal('localStorage', new MemoryStorage())
