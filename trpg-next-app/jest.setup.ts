if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string): MediaQueryList => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false
      })
    })
  }

  if (!window.ResizeObserver) {
    class ResizeObserverPolyfill {
      observe(): void {
        return undefined
      }

      unobserve(): void {
        return undefined
      }

      disconnect(): void {
        return undefined
      }
    }

    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: ResizeObserverPolyfill
    })
  }
}
