import { config } from '@vue/test-utils'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: ResizeObserverStub,
})

Object.defineProperty(Element.prototype, 'scrollIntoView', {
  writable: true,
  configurable: true,
  value: () => {},
})

config.global.stubs = {
  transition: false,
  teleport: false,
}
