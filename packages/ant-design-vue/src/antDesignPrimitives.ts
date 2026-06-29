import {
  Button,
  Checkbox,
  Divider,
  Dropdown,
  Input,
  Menu,
  MenuItem,
  Modal,
  Tooltip,
  message,
} from 'ant-design-vue'
import {
  defineComponent,
  h,
  inject,
  provide,
  ref,
  watch,
  type PropType,
} from 'vue'
import type { VNodeProps } from 'vue'

const dropdownCommandKey = Symbol('tvpAntdDropdownCommand')

type CommandHandler = (command: unknown) => void

export const antMessage = message

export const AntButton = defineComponent({
  name: 'AntButton',
  inheritAttrs: false,
  props: {
    text: Boolean,
    type: String,
    size: String,
  },
  setup(props, { attrs, slots }) {
    return () => {
      const type = props.text && (!props.type || props.type === 'default')
        ? 'text'
        : props.type
      const classes = [
        attrs.class,
        'tvp-ant-button',
        props.text ? 'is-text' : '',
        props.type === 'primary' ? 'tvp-ant-button--primary' : '',
      ]
      return h(Button, {
        ...attrs,
        class: classes,
        type,
        size: props.size,
        autoInsertSpace: false,
      } as VNodeProps & Record<string, unknown>, slots)
    }
  },
})

export const AntTooltip = defineComponent({
  name: 'AntTooltip',
  inheritAttrs: false,
  props: {
    content: String,
    title: String,
    placement: String,
    showAfter: Number,
    visible: Boolean,
    persistent: Boolean,
  },
  emits: ['update:visible'],
  setup(props, { attrs, emit, slots }) {
    return () =>
      h(
        Tooltip,
        {
          ...attrs,
          title: props.title ?? props.content,
          placement: props.placement,
          open: props.visible,
          'onUpdate:open': (v: boolean) => emit('update:visible', v),
        } as VNodeProps & Record<string, unknown>,
        slots,
      )
  },
})

export const AntDropdown = defineComponent({
  name: 'AntDropdown',
  inheritAttrs: false,
  props: {
    trigger: [String, Array] as PropType<string | string[]>,
    visible: Boolean,
  },
  emits: ['command', 'update:visible', 'visible-change'],
  setup(props, { attrs, emit, slots, expose }) {
    const open = ref(false)

    watch(
      () => props.visible,
      (v) => {
        if (typeof v === 'boolean') open.value = v
      },
      { immediate: true },
    )

    function setOpen(v: boolean) {
      open.value = v
      emit('update:visible', v)
      emit('visible-change', v)
    }

    function handleCommand(command: unknown) {
      emit('command', command)
      setOpen(false)
    }

    provide<CommandHandler>(dropdownCommandKey, handleCommand)
    expose({
      handleOpen: () => setOpen(true),
      handleClose: () => setOpen(false),
    })

    return () =>
      h(
        Dropdown,
        {
          ...attrs,
          open: open.value,
          trigger: props.trigger === 'click' ? ['click'] : props.trigger,
          'onUpdate:open': setOpen,
        } as VNodeProps & Record<string, unknown>,
        {
          default: slots.default,
          overlay: slots.dropdown,
        },
      )
  },
})

export const AntDropdownMenu = defineComponent({
  name: 'AntDropdownMenu',
  setup(_, { slots }) {
    return () => h(Menu, {}, slots)
  },
})

export const AntDropdownItem = defineComponent({
  name: 'AntDropdownItem',
  inheritAttrs: false,
  props: {
    command: null,
    divided: Boolean,
  },
  setup(props, { attrs, slots }) {
    const command = inject<CommandHandler | null>(dropdownCommandKey, null)
    return () =>
      h(
        MenuItem,
        {
          ...attrs,
          class: [attrs.class, 'tvp-ant-dropdown-menu__item'],
          key: String(props.command ?? Math.random()),
          danger: props.divided,
          onClick: () => command?.(props.command),
        },
        slots,
      )
  },
})

export const AntModal = defineComponent({
  name: 'AntModal',
  inheritAttrs: false,
  props: {
    modelValue: Boolean,
    title: String,
    width: [String, Number],
    appendToBody: Boolean,
  },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit, slots }) {
    return () =>
      h(
        Modal,
        {
          ...attrs,
          open: props.modelValue,
          title: props.title,
          width: props.width,
          destroyOnClose: true,
          onCancel: () => emit('update:modelValue', false),
          'onUpdate:open': (v: boolean) => emit('update:modelValue', v),
        } as VNodeProps & Record<string, unknown>,
        {
          default: slots.default,
          footer: slots.footer,
        },
      )
  },
})

export const AntInput = defineComponent({
  name: 'AntInput',
  inheritAttrs: false,
  props: {
    modelValue: String,
    placeholder: String,
  },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit, slots }) {
    return () =>
      h(
        Input,
        {
          ...attrs,
          value: props.modelValue,
          placeholder: props.placeholder,
          'onUpdate:value': (v: string) => emit('update:modelValue', v),
        },
        slots,
      )
  },
})

export const AntCheckbox = defineComponent({
  name: 'AntCheckbox',
  inheritAttrs: false,
  props: {
    modelValue: Boolean,
  },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit, slots }) {
    return () =>
      h(
        Checkbox,
        {
          ...attrs,
          checked: props.modelValue,
          'onUpdate:checked': (v: boolean) => emit('update:modelValue', v),
        },
        slots,
      )
  },
})

export const AntDivider = defineComponent({
  name: 'AntDivider',
  inheritAttrs: false,
  props: {
    direction: String,
  },
  setup(props, { attrs }) {
    return () =>
      h(Divider, {
        ...attrs,
        class: [attrs.class, props.direction === 'vertical' ? 'tvp-ant-divider--vertical' : ''],
        type: props.direction,
      } as VNodeProps & Record<string, unknown>)
  },
})

export const AntIcon = defineComponent({
  name: 'AntIcon',
  setup(_, { slots }) {
    return () => h('span', { class: 'tvp-ant-icon' }, slots.default?.())
  },
})
