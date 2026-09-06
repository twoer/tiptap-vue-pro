# 重构执行计划(2026-09)

Status: active

承接 [architecture-quality-audit-2026-09.md](./architecture-quality-audit-2026-09.md)。机械修复批已于 2026-09-06 完成并全量验证;本计划覆盖剩余的中高风险项。原则:**小步、每步可独立合入、每步过全量验证门槛(typecheck + test + 边界 rg)、对外 API 兼容优先**。

验证门槛(每个步骤合入前必跑):

```bash
pnpm typecheck && pnpm test
rg -n "\bEl(Button|Tooltip|Dropdown|Dialog|Input|Popover|ColorPicker|Checkbox|Divider)\b|element-plus|\.el-|--el-" packages/naive packages/ant-design-vue
rg -n "\bN(Button|Tooltip|Dropdown|Input|Modal|ColorPicker|Checkbox|Divider|ConfigProvider|MessageProvider)\b|naive-ui|\.n-|--n-" packages/element-plus packages/ant-design-vue
rg -n "\bAnt(Button|Tooltip|Dropdown|Modal|Input|Checkbox|Divider|Icon)\b|ant-design-vue|\.ant-|--ant-" packages/element-plus packages/naive
```

## 批次 0:收尾(阻塞后续的一切)✅ 2026-09-06 完成

1. 提交机械修复批(当前工作区未提交改动 + `docs/plans` 3 个文件的暂存删除)。
2. 把上节三条边界 rg 固化为 `scripts/check-adapter-boundaries.mjs`,CI quality job 增加一步。零成本消除"靠人肉执行 AGENTS.md 规则"的风险,也为后续大批量适配器改动提供护栏。

## 批次 1:小下沉(建立"core 提供逻辑、适配器只渲染"的模式)✅ 2026-09-06 完成

落地为 `core/src/linkValidation.ts`、`core/src/bubbleMenuVisibility.ts`(导出 `shouldShowTextBubbleMenu`)、`core/src/floatingMenuPosition.ts`(`clampFloatingMenuLeft`/`getViewportWidth`),core 新增 11 个单测;九个适配器文件改为消费 core 导出。

按收益/风险比排序,前三步每步都在消灭三份拷贝,且不动 UI:

1. **链接校验下沉** → `core/src/linkValidation.ts`
   - 提取 `isLinkProtocol(url)`(现 `/^(https?:|mailto:|tel:)/i`)与 `looksLikeLink(text)`(现 `/\.[a-z]{2,}/i`),core 加单测。
   - 替换 6 处拷贝:`packages/*/src/BubbleMenu.vue:57` ×3、`packages/*/src/LinkBubbleMenu.vue:73` ×3。
2. **BubbleMenu 显隐谓词下沉** → `core/src/bubbleMenuVisibility.ts`
   - 提取 `createBubbleMenuShouldShow(opts)`(链接/文件/媒体/HR/代码块/表格互斥规则,现三份约 60 行判断)。
   - 三个 `BubbleMenu.vue` 的 `shouldShow` 改为调用。下沉后 el↔ant 的 BubbleMenu.vue 差异趋近 0。
3. **浮层视口夹紧下沉** → `core/src/useFloatingMenuPosition.ts`
   - 提取现三份逐字相同的定位算法(`SlashCommandMenu.vue:43`),做成 composable(width 常量参数化)。
   - 三适配器 SlashCommandMenu 改用。

预期:消灭约 250 行三份拷贝;三包测试无需改(行为不变)。

## 批次 2:拆 useProEditor.ts(H1)✅ 2026-09-06 完成

结果:useProEditor.ts 1576 行 → **885 行**(编排层),对外导出零变化(index.ts 未动)。

1. **拆表格几何引擎** ✅ → `core/src/tableController.ts`(500 行)
   - 以 `createTableController({ getEditor, debugLog })` 工厂整体迁出原 L378-831 的
     几何解析 + 移动/选区/删除命令(含 `lastKnownTablePos`/`lastPointerTableCell` 状态)。
     内部模块暂不进公共导出,待批次 3 决定 API 形态。
2. **拆媒体插入** ✅ → `core/src/mediaInsertion.ts`(240 行)
   - `createMediaInserter` 工厂:资产规范化、上传时间/时长格式化、本地化文件类型、
     fileAttachment/video/audio 节点构造、上传编排链路。`notifyFn` 定义上移至 t 之后,
     扩展配置的 `fileTypeLabel` 与 commands 均改为消费工厂实例。
3. **findReplace 命令桥归位** ✅ → `core/src/findReplaceCommands.ts`(74 行)
   - 10 个面板命令包装从 rawCommands 抽为 `createFindReplaceCommandEntries(cmd)`,
     以 spread 并入;独立小模块以避免 types.ts ↔ findReplace.ts 类型环。

每步合入前:452 个 core 用例(含 140 个表格、媒体序列化、查找替换用例)全过,行为零变化。

4. **残留三处非命令断言**(useProEditor 的 `content as never` / `storage as any` / 尾部 `as never`)未在本批处理——涉及 tiptap 泛型边界而非机械替换,顺延到批次 4 逐处评估。
2. **拆媒体插入** → `core/src/mediaInsertion.ts`(`:855-1011`,`insertFileAsset`/`insertVideoAsset`/`formatFileUploadedAt`/`localizedFileTypeText`)。
3. **findReplace 命令桥归位**:`:1342-1384` 的 10 个命令包装折进 `findReplace.ts` 或新建 `findReplaceCommands.ts`(类型增强已在 `extensions/findReplace.ts:22-36`)。
4. 残留三处非命令断言(`:195 content as never`、`:232 storage as any`、`:1415 as never`)在此批次内评估:storage 可用 character-count 官方 storage 类型;两处 `as never` 涉及 tiptap 泛型边界,如不能安全消除,记录原因。

## 批次 3:大下沉 ✅ 2026-09-06 完成

1. **TableGripHandles 引擎下沉** ✅ 2026-09-06 完成 → `core/src/tableGripOverlay.ts`
   - `useTableGripOverlay` composable(~530 行):定位计算、hover 检测与 200ms 延迟隐藏、
     菜单目标锁定、focusCell 选区落点、命令转发、事件接线与卸载清理。
     `deferMenuOpen` 选项吸收 antd 菜单关闭时序差异;`rowMenuIndex`/`colMenuIndex`
     顺手转为 ref(修复模板读取非响应式变量的隐患)。
   - 三包 TableGripHandles.vue 从 736/653/724 行降至 229/190/207 行,
     只剩菜单渲染(El/N/Ant Dropdown)与主题样式;naive 保留数据驱动 options,
     ant 传 `deferMenuOpen: true`。817 个用例(含三包各 8 个抓手用例)全过。
2. **Toolbar 数据驱动化**(M7)✅ 三包完成
   - 18 个同构简单按钮(undo/redo、B/I/U/S、code、上下标、三种列表、引用、缩进、
     清格式、查找替换、打印)收敛为 `SIMPLE_TOOLBAR_BUTTONS` 配置表 + 单个循环分支,
     新增此类按钮从"改三处模板"变为"加一行配置";复杂控件(heading/字号/行高、
     取色器、对齐、代码语言、链接、图片上传、表格、markdown、紧凑溢出菜单)
     保留具名分支。Toolbar.vue:el 1674→1598、naive 1840→1713、ant 1728→1652。
   - 后续可选:配置表上移 core(键清单),进一步消三份重复;涉及 lucide 图标归属
     (现为适配器依赖),与 M6 API 收缩一起设计。

## 批次 4:行为修复 ✅ 2026-09-06 完成

1. **M2 热路径 debug** ✅:`resolveDebugOptions` 四种静态形态返回冻结常量(每按键零分配);localStorage 表格抓手开关改 1s TTL 缓存 + 导出 `refreshDebugOptionsCache()`(保持运行时可切,新增缓存行为测试);`useProEditor` 的 debugLog 由"每次调用重建闭包"改为 setup 一次创建(getter 保持动态读取)。onTransaction 的 payload 对象构造保持现状(3 个小字段,收益不抵 API 改动)。
2. **M5 打印加固** ✅:`document.write` → `iframe.srcdoc`;清理幂等化(onload 正常路径按 cleanupDelay,10s 兜底超时回收被策略拦截的 iframe);contentWindow 不可访问的 throw 路径随之消失。
3. **M1 i18n 旁路** ✅(主体):补 `command.findReplace` + 18 个 `slash.*` 键(zh/en);三包 SlashCommandMenu 增加可选 `t` prop(宿主传 `ctx.t`),label/hint locale 优先、数据表文案兜底;el/ant 的 heading/align/markdown 下拉项接入既有 locale 键(naive 原本已接)。**顺延**:imageNodeView 题注 placeholder 与 media Download title——NodeView/renderHTML 无 locale 通道,需扩展 options 管道设计。
4. **M4 v-model 加固** ✅:`isUpdatingFromEditor` 改 try/finally 立即复位,修复"值未变化时 watch 不触发 → flag 卡死 → 吞掉下一次外部同步"的边界 bug;sync/pre 两种 flush 模式均正确。`options.content = val` 的 setter 机制保留(它就是 adapter v-model 桥),非响应式 plain object 的静默失效场景已在类型 JSDoc 约定层面记录。**残留断言**:`content as never` → 精确类型断言、`storage as any` → 结构化断言;泛型索引写入的 `as never` 经实验确认是 TS 已知限制,保留并加注释说明。

## 批次 5:工程外围(H4)🔄 1-3 已完成(2026-09-06)

1. **eslint(flat config)** ✅:eslint 10 + eslint-plugin-vue 10 + @vue/eslint-config-typescript 14;`pnpm lint` error 门槛进 CI(存量类型债 65 处 no-explicit-any 以 warn 保留清零);首次全量跑出 4 个 error 已修(`&&` 短路语句、playground 死代码、2 处测试占位表达式加豁免);`.worktrees/**` 入 ignore。
2. **changesets** ✅:四包 fixed 组联动发版,`changeset`/`changeset:version`/`changeset:publish` 脚本就绪,流程文档见 `.changeset/README.md`。
3. **e2e 自包含** ✅:playwright 入仓(^1.60);8 个脚本的 `../visual-compare` 借用全部移除;`scripts/lib/playground-server.mjs` 统一管理 dev server 生命周期(PLAYGROUND_URL 优先/复用现有/自动拉起+退出回收);修了三个真实生命周期 bug——readiness fetch 无超时会挂在假死端口、spawn 子进程未 unref 导致脚本永不退出、退出钩子链式回收已验证;两处脆弱像素断言改设计不变量;CI 增加 e2e job(先跑 table 冒烟)。全量 table 冒烟三适配器通过且干净退出——同时端到端验证了当日全部重构。
4. **M6 API 面收缩**:待做(单独批次)。
5. 依赖升级(vite 7 / vitest 3 / vue-tsc 3 / vitepress 2):待做(单独批次)。

## 打磨批 ✅ 2026-09-06 完成(原"可选打磨"四项)

1. **简单工具栏按钮单一事实源**:`TOOLBAR_SIMPLE_BUTTON_DEFS` + `buildSimpleToolbarButtons()` 进 core;适配器图标映射按 `Record<ToolbarSimpleButtonId, Component>` 强制类型,增删按钮三包同步由编译器保证。
2. **NodeView locale 管道**:`nodeViewLocale.ts` 模块级通道(useProEditor 在 locale 解析后注入);题注 placeholder 用既有 `image.captionPlaceholder` 键(此前有键未接线);media 的 Download title 经论证**刻意保持 locale 无关**(renderHTML 序列化进文档,注释已记录)。
3. **e2e 去脆弱化**:Escape 关菜单改条件等待(detached)、暗色样式改稳定轮询;负向断言/防抖内时序保留固定等待并注释意图;修复自包含转换漏掉的 5 个 node 内置导入(autosave/local-draft/mermaid/preview 的 path join、image-crop 的 fs/promises 三件套 + os tmpdir)。**8 脚本普查**(以 3115c6e 基线 worktree 对照)定位 3 个存量损坏,已于同日分诊修复(81dfcb5):find-replace 是 playground 默认 compact 布局把按钮收进溢出菜单(测试改切 classic);local-draft 是草稿存储键加了路由/场景后缀而测试没跟上;image-crop 是三适配器弹窗同挂 body 导致 strict 模式跨适配器撞车(弹窗内定位器按适配器容器收口)。dev-server helper 同时加固了端口竞争(--strictPort + 有限重试)。**8/8 脚本三适配器全部通过。**
4. **no-explicit-any 清零(65→0)**:生产代码 naive TableBubbleMenu 图标表改 `Component`;测试层以精确结构类型为主(JsonNode 递归类型、mock options 形状收窄、markdownManager 的 vue-3 Editor),深挖 tiptap 扩展内部签名的 6 处保留带理由的行内豁免。

## 顺序与理由

0 → 1 → 2 → 3 → 4 → 5。批次 1 先于批次 2 的原因:小下沉先建立模式与信心,且批次 2 拆文件时新模块可以直接放进正确的位置。批次 3 依赖批次 2(tableGrip 模块紧邻 tableGeometry)。批次 4/5 与 2/3 无依赖,可穿插。

预估规模(按"人日"粗估):批次 0 半天;批次 1 一天;批次 2 一至两天;批次 3 三至四天(Toolbar 试点占一半);批次 4 两天;批次 5 两至三天。
