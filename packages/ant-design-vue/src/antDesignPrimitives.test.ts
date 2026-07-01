import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'

const tooltipProps = vi.hoisted(() => [] as Array<Record<string, unknown>>)

vi.mock('ant-design-vue', () => ({
  Button: defineComponent({ setup: (_, { slots }) => () => h('button', slots.default?.()) }),
  Checkbox: defineComponent({ setup: (_, { slots }) => () => h('label', slots.default?.()) }),
  Divider: defineComponent({ setup: () => () => h('span') }),
  Dropdown: defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }),
  Input: defineComponent({ setup: () => () => h('input') }),
  Menu: defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }),
  MenuItem: defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }),
  Modal: defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }),
  Tooltip: defineComponent({
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      tooltipProps.push(attrs as Record<string, unknown>)
      return () => h('span', slots.default?.())
    },
  }),
  message: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}))

describe('AntTooltip primitive', () => {
  it('未传 visible 时保持非受控 tooltip,允许 hover 触发显示', async () => {
    const { AntTooltip } = await import('./antDesignPrimitives')
    tooltipProps.length = 0

    mount(AntTooltip, {
      props: {
        content: '编辑链接',
        placement: 'top',
        showAfter: 300,
      },
      slots: {
        default: '<button>edit</button>',
      },
    })

    expect(tooltipProps[0]).toMatchObject({
      title: '编辑链接',
      placement: 'top',
      mouseEnterDelay: 0.3,
    })
    expect(tooltipProps[0]).not.toHaveProperty('open')
  })

  it('传入 visible 时才作为受控 tooltip', async () => {
    const { AntTooltip } = await import('./antDesignPrimitives')
    tooltipProps.length = 0

    mount(AntTooltip, {
      props: {
        content: '删除图片',
        visible: false,
      },
      slots: {
        default: '<button>delete</button>',
      },
    })

    expect(tooltipProps[0]).toMatchObject({
      title: '删除图片',
      open: false,
    })
  })
})
