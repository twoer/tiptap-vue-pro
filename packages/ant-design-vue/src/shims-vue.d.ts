/* eslint-disable @typescript-eslint/no-explicit-any -- Vue 官方 SFC shim 惯例 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
/* eslint-enable @typescript-eslint/no-explicit-any */
