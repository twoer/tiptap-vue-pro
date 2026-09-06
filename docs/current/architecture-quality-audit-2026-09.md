# 2026-09 全量架构与代码质量审计

Status: snapshot(2026-09-05,基于 main @ 3115c6e)

本文件是对整个 monorepo 的一次全量架构与代码质量分析结论,含验证结果、分级问题清单与偿还顺序建议。行号以审计当日代码为准。

## 审计范围与验证状态

- 范围:`packages/core`、`packages/element-plus`、`packages/naive`、`packages/ant-design-vue`、`playground`、`docs`、`scripts`、构建与发布配置。
- 规模:源码约 3.6 万行(core 9935 行 + 三适配器各约 7k 行 + playground 1914 行),测试约 1.8 万行(72 个测试文件)。
- 验证:`pnpm typecheck` 全部通过(4 包零错误);`pnpm test` 全部通过(core 410 用例 + el 120 + naive 121 + ant 124,退出码 0)。

## 一句话总评

架构方向(headless core + 三 UI 适配器)正确且执行到位,代码内在质量(类型、错误处理、测试、资源管理)属上游水准;最大风险不是质量腐化,而是三适配器复制模式带来的同步成本累积、手工工程外围,以及个别"定时炸弹"式配置。0.x 阶段是收缩 API 面与做下沉重构的最佳窗口期。

## 架构总览

```
tiptap-vue-pro-monorepo (pnpm workspace, 0.2.3)
├── packages/core            UI 无关核心层,53 文件 / 9935 行
│   ├── useProEditor.ts      编排层(生命周期/v-model/命令聚合)1576 行 ⚠
│   ├── extensions/          Tiptap 扩展(image/media/mermaid/slashCommand/findReplace…)
│   ├── toolbar 族 ×9        配置数据 + 适配器可用的 Vue controller(约 870 行)
│   ├── autosave/localDraft  自包含持久化控制器(generation token 防竞态)
│   └── locale/debug/types   横切层
├── packages/element-plus    UI 适配器,17 文件 / 6751 行
├── packages/naive           UI 适配器,18 文件 / 6929 行
├── packages/ant-design-vue  UI 适配器,18 文件 / 7058 行
├── playground               演示 + e2e 载体,7 文件 / 1914 行
├── docs/                    VitePress,92 个 md / 约 1.86 万行,中英双语
└── scripts/                 8 个 Playwright e2e smoke + 1 个发布验证
```

分层成立的证据:

- core headless 边界做到位:`notify`/文案全部注入,三适配器共用,无 UI 库依赖。
- 依赖单向;唯一循环依赖 `extensions.ts:29` ↔ `extensionRegistry.ts:2` 为 `import type` 类型级,运行时无环。
- tiptap 家族 15 个包全部为 core 的 peerDependencies(devDeps 钉死 3.27.1 统一),dist 产物实测未打包 peer(0.2.3 提交 d368986 修复过此问题)。
- 三适配器 13 个组件文件一一对应,测试用例数对称(121/120/124)。

## 做得好的地方(保持)

1. **类型卫生**:core 源码 `@ts-ignore`/`@ts-expect-error`/`eslint-disable`/TODO/FIXME 全部为 0;`any` 仅 15 处且集中在已知位置;43 个 .vue 组件全部 `<script setup lang="ts">`;strict + noUnused 全开。
2. **真实行为测试**:core `useProEditor.test.ts`(2726 行 / 140 用例)用真实 Tiptap 编辑器断言真实 HTML/JSON 产出,覆盖表格选区、草稿保存竞态(6 个时序用例)、媒体序列化可逆;适配器测试真挂载组件并操作 teleport 的真实下拉菜单。
3. **资源泄漏纪律**:window 监听、定时器、editor 事件、NodeView destroy 基本都有 `onScopeDispose`/`onCleanup` 双保险,并有专门测试验证卸载清理(`useProEditor.test.ts:1162`)。
4. **发布验证**:`scripts/package-exports-smoke.mjs`(505 行)在 CI 中真实 npm pack → 临时目录安装 tarball → 验证 ESM/CJS/SSR/tsc/vue-tsc/vite 消费构建。
5. **文档同步**:props 文档与 `core/src/types.ts` 对得上,中英双语镜像维护。

## 问题清单(按严重程度)

### 高

#### H1. `useProEditor.ts` 上帝文件(1576 行,6 类职责)

表格几何/选区引擎(L378-831,约 450 行纯计算)、媒体插入与格式化(L855-1011)、60+ 命令聚合(L1053-1384)、v-model/autosave 接线、调试包装、上传校验全部堆在一个文件。表格引擎是自洽纯计算,拆出零风险。

#### H2. el ↔ ant 约 87-90% 逐行复制,且 ant 包照搬 Element Plus 调色板

- 整文件 diff(归一化组件名后):Toolbar.vue 1674 行仅 160 行不同,BubbleMenu.vue 仅 6 行不同;el↔ant 约 5000 行源码只有约 650 行真实差异。
- `packages/ant-design-vue/src/ProEditorAntDesignVue.vue:756` 写 `--tvp-ant-color-primary: #409eff`(Element Plus 主蓝;antd 4.x 实际为 `#1677ff`)。
- **主色体系三重分裂(复核补强)**:① 定义处用 EP 蓝(:756);② 全包 fallback 两色并存——14 处 fallback `#409eff`、21 处 fallback `#1677ff`(如 `ImageBubbleMenu.vue:297/304` vs `CodeBlockBubbleMenu.vue:218`);③ 存在拼写不一致的变量名 `--tvp-ant-primary-color` ×4(`MediaBubbleMenu.vue:304`、`LinkBubbleMenu.vue:248`、`HorizontalRuleBubbleMenu.vue:163`、`FileBubbleMenu.vue:298`)——该变量从未被定义(定义的是 `--tvp-ant-color-primary`),这 4 处永远走 fallback。
- EP 灰阶 token(`#dcdfe6` ×20、`#909399` ×10、`#303133` ×9、`#f5f7fa` ×7、`#ebeef5` ×4,复核逐项精确命中)遍布 ant 包约 50 处,违反 AGENTS.md"不得把另一适配器主题拷进来"的精神(rg 字面检查为 0 命中,属"改了名、照搬了值")。
- `packages/ant-design-vue/src/antDesignPrimitives.ts:168-190` 复刻 Element Plus 组件协议(`AntDropdown/AntTooltip/AntModal`),属 AGENTS.md:12 反对的兼容层。副作用:`divided` → antd `danger`,同一个"删除"菜单项在 el 是分隔线、在 ant 是红色文字(`TableGripHandles.vue:601/638`);`key: String(props.command ?? Math.random())` 每次渲染随机 key(antDesignPrimitives.ts:183)。

#### H3. 三份拷贝的共享逻辑应下沉 core 而未下沉

- BubbleMenu 显隐互斥谓词(×3,`packages/*/src/BubbleMenu.vue` 各约 60 行)。
- 链接 URL 校验正则(×6:`BubbleMenu.vue:57` ×3 + `LinkBubbleMenu.vue:73` ×3 完全相同)。
- Slash 菜单视口夹紧定位算法(×3 逐字相同)。
- **TableGripHandles 覆盖层引擎**(736/653/724 行,posAtCoords 反查 + rect 逐行定位 + 滚动跟随,纯 DOM/PM 逻辑,三份共约 2000 行)——最应下沉。
- Toolbar 本地工具函数族(FALLBACK_TOOLBAR、HEX_RE 色值校验、MarkdownIcon 内联 SVG、compactMenuActions 映射)。
- 漂移已开始:ant Toolbar 独有 `dark` prop(`Toolbar.vue:128`),el/naive 无对等能力。

#### H4. 工程自动化外围缺失

- 全仓无 eslint/prettier/stylelint/husky/lint-staged/commitlint;适配器边界靠 AGENTS.md 手工 rg 命令,无 CI 强制。
- 8 个 e2e 依赖 monorepo 外的 `../visual-compare` 仓库提供 playwright(`scripts/table-playwright-smoke.mjs:6-18` 等),且全部不在 CI 运行;默认要求手动 `pnpm dev`。
- 发布全手工:无 changesets/发布脚本;0.2.3 已发布但 CHANGELOG 无条目、无 git tag;四包版本号手改同步。

#### H5.(已降级,见复核记录)pnpm postinstall hack 冗余且脆弱

- `pnpm-workspace.yaml:4-6` 用 `allowBuilds: { core-js: true, esbuild: true }` 声明构建许可。
- **初始论断有误,复核修正**:曾认定 `allowBuilds` 是 pnpm 11 的键、在钉死的 pnpm 10.32.1 下静默无效。实际核查本机安装的 pnpm 10.32.1 dist 源码,`allowBuilds` 出现 16 次,且存在明确归一化逻辑:`if (pnpmSettings.allowBuilds) { settings.onlyBuiltDependencies ??= []; ... case true: push }` —— 即 **pnpm 10.32.1 认识该键并会把它翻译成 onlyBuiltDependencies,当前配置链路是有效的**。
- 因此 root `package.json:26` 的 postinstall hack(`node node_modules/.pnpm/esbuild@0.21.5/.../install.js || true`)是**冗余的保险**而非救命稻草:硬编码 `esbuild@0.21.5` 版本路径,升级后路径消失、`|| true` 吞错,但 pnpm 自身会正常执行构建脚本,构建不会因此挂掉。
- 修法(降级为低优先清理):直接删除 postinstall hack,保留 `allowBuilds`;或两处统一改用 `onlyBuiltDependencies` 命名以免混淆。

### 中

#### M1. i18n 双轨旁路

locale.ts 定义 386 key 中英双语文案,但三处配置数据硬编码中文:`commandRegistry.ts:52-112`(35 处)、`toolbarConfigData.ts:90-166`、`slashCommand.ts:58-131`;另有 `extensions/imageNodeView.ts:138` 题注 placeholder `'添加题注'`、`extensions/media.ts:344` `'Download'`。英文用户会看到中英混排。

#### M2. 热路径调试开销

每次 transaction(每次按键)重新 `createDebugLogger` 并同步读 localStorage,即使 debug 关闭(`useProEditor.ts:113-119、207-219` + `debug.ts:89、153、181-187`),且无条件构造日志 payload 对象。

#### M3. 核心契约处的 `as any`

- 三适配器入口对 `useProEditor` 配置整体断言:`ProEditorElementPlus.vue:196` / `ProEditorNaive.vue:253` / `ProEditorAntDesignVue.vue:196`(三份相同)。
- core 里 10 处 `(ed.commands as any).findReplaceNext?.()`(`useProEditor.ts:1342-1382`)其实已有 `declare module` 类型增强(`extensions/findReplace.ts:22-36`)却未接上;indent 链式命令同理(`useProEditor.ts:1077-1093` vs `extensions/blockIndent.ts:10-17`)。
- `extensions/imageNodeView.ts:203` 一行三重 `as never`。

#### M4. v-model 隐式突变

v-model 通过直接变异调用方 options 对象实现(`options.content = val`,`useProEditor.ts:266`),类型上不可见;传非响应式对象时双向绑定静默失效;`isUpdatingFromEditor` 标志(L228)可能卡在 true 跳过下次外部同步。

#### M5. 打印功能问题

废弃 API `document.write`(`toolbarActions.ts:91-95`);打印 iframe 清理只挂 `iframe.onload`(L97-102),onload 不触发则 iframe 永久残留 `document.body`;打印 CSS 硬编码在 core(L25)。

#### M6. 公共 API 面过宽

`core/src/index.ts` 导出 269 个符号(128 值 + 141 类型),`TOOLBAR_PRESET_COLORS`、`toolbarImageUrlController`、`codeBlockLanguageIcon` 等内部细节全部从根入口导出,内部重构即 breaking。建议二级入口或 internal 命名空间收缩。

#### M7. 巨型模板/样式块

入口组件单块 style 989/948/990 行(el/naive/ant,复核实测);Toolbar 模板各有 35 个 `v-else-if` 分支(三份);新增一个工具栏按钮要改三处模板 + 三处样式。core 已有 `toolbarConfigData.ts` 但只数据驱动了一半。

#### M8. 构建产物问题

- 4 个包均无 sourcemap(`tsconfig.base.json:17-18` 的 sourceMap/declarationMap 实际无效)。
- element-plus 包公共 d.ts 依赖 EP 内部深路径(`element-plus/es/utils/typescript.mjs`,dist/index.d.ts:2、4),EP 内部重构即断;d.ts 被内联到 112KB(naive 仅 13.6KB)。
- `lucide-vue-next` 被打进 dist 又同时声明为 runtime 依赖,消费者重复安装。
- UMD globals 回退 `?? 'Tiptap'`(`packages/core/vite.config.ts:57`)使 `@codemirror/*`、mermaid 在 UMD 产物中映射到同一错误全局。

#### M9. 内部文档将泄漏到公开站点

`docs/current/` 下 10 个交接/路线图文档被 git 追踪且不在 VitePress `srcExclude`(`docs/.vitepress/config.ts:151` 仅排除了 feature-gap-analysis.md 和 plans/**);`.gitignore:33-34` 声明忽略 `docs/feature-gap-analysis.md` 和 `docs/plans/`,但 `docs/plans/` 下 3 个文件早已被追踪(复核实测),gitignore 形同虚设。本审计文档自身也应加入 srcExclude。

### 低

- `mermaidNodeView.ts`(169 行,含 CodeMirror 异步 mount、版本竞争、focus 调度)零测试;`extensions/rangeSelection.ts` 仅 1 个间接用例;`extensions/blockIndent.ts` 无专属单测。
- naive 包 `MessageBridge.vue:6` 注释把 Naive 写成 "Napptive"。
- e2e 断言脆弱:精确像素(`labelGap === '9px'`、`menuWidth >= 167.5`)、精确色值 `rgb(64,158,255)`、中文文案定位 `'右移'`,加大量固定 `waitForTimeout` 睡眠。
- root tsconfig project references 指向 3 个非 composite 的包,`tsc -b` 必报 TS6306,属死配置。
- 依赖欠账:vite 5 / vitest 1 均已 EOL(vite 主流 7.x、vitest 3.x),vue-tsc 2.x、vitepress 1.x 落后。
- 三包主题变量策略不一致(复核重测计数):el 直接用原生 `--el-*` ×208;naive 用 `--n-*` ×163 + `--tvp-naive-*` ×14;ant 自建 `--tvp-ant-*` 约 300 处。AGENTS.md 示例约定的 `--tvp-el-*` CSS 变量确为 0 个(el 包内 17 处 `tvp-el-` 字样全是 `popper-class` 类名如 `tvp-el-action-dropdown`,非 CSS 变量)。
- "grep 源码"式测试:`ProEditor*.test.ts:492-507` 等用 readFileSync + 正则断言源码文本,三份复制;适配器测试 mock 工厂约 90 行三份重复。
- 适配器测试整体 `vi.mock('tiptap-vue-pro-core')`,编辑器真实行为全靠 core 测试兜底(可接受但需知晓)。
- playground `uploadImage.ts:2-7` 硬 import ElMessage,naive/ant 页面上传提示也渲染成 EP 样式;`App.vue` 1326 行混合演示/i18n/路由/测试钩子。
- root `docs:build` 用 `rm -rf`/`cp -R`(Windows 不可用);`README.md:158` 引用不存在的 `deploy.yml`(实际是 ci.yml)。

## 偿还顺序建议

1. **先修用户可见与泄漏风险**
   - `docs/current/` 加入 VitePress `srcExclude` 并 `git rm --cached`,防止内部文档(含本审计)发布到公开站点。
   - ant 包主色体系三重分裂修复:`#409eff` → `#1677ff` 统一、修正 4 处 `--tvp-ant-primary-color` 拼写(该变量从未定义)。
   - (低优先清理)删除 root postinstall hack —— 复核确认 `allowBuilds` 在钉死的 pnpm 10.32.1 下有效,hack 已冗余。
2. **ant 包主题对齐 antd(用户可见的视觉错误)**
   - `#409eff` → `#1677ff`,EP 灰阶 token 换 antd token;统一主色 fallback。
   - 重审 `antDesignPrimitives.ts` 的 `divided → danger` 语义漂移与随机 key。
3. **下沉三份共享逻辑到 core**
   - 优先级:TableGripHandles 引擎(约 2000 行三拷贝)> BubbleMenu shouldShow 谓词 + 链接校验正则 > Toolbar 模板数据驱动化。
4. **拆 `useProEditor.ts`**:先无损拆表格引擎(450 行纯函数)与媒体插入,可降至千行以内。
5. **补 lint 工具链**:eslint(+ vue 插件)+ 把 AGENTS.md 三条 rg 边界检查固化为 CI 脚本;再考虑 changesets、e2e 自包含化(去 `../visual-compare` 依赖、playwright webServer 配置)。
6. **后续**:i18n 硬编码中文接入 locale;热路径 debug 缓存;收窄公共 API 面;vite/vitest 大版本升级。

## 审计方法说明

- 全量 import graph 与模块职责人工梳理;三适配器整文件归一化 diff(组件名/CSS 前缀/库名归一)估算重复率。
- 类型卫生信号全量计数(any/断言/ts-ignore/TODO/空 catch/console);监听器与定时器逐项核对清理路径。
- 构建产物实测(dist 中 external 保留情况、d.ts 依赖、sourcemap 缺失);pnpm 版本键有效性以本机 pnpm 10.32.1 代码验证。
- `pnpm typecheck` 与 `pnpm test` 全量运行确认通过。

## 复核记录(2026-09-05,逐项对照代码二次核验)

| 项 | 结论 | 复核证据 |
|---|---|---|
| H1 上帝文件 | ✅ 属实 | 精确 1576 行;表格引擎段 L379 起("表格几何解析"注释)、媒体插入 `formatFileUploadedAt:865`/`insertFileAsset:912`/`insertVideoAsset:952`,段落划分与文档一致 |
| H2 ant 主题照搬 EP | ✅ 属实且**加重** | `:756` `#409eff` 确认;EP 灰阶 5 组计数逐项精确命中(20/10/9/7/4);**新发现**:主色 fallback 分裂为 14 处 `#409eff` vs 21 处 `#1677ff`,且存在从未定义的变量名 `--tvp-ant-primary-color` ×4;`antDesignPrimitives.ts:168-190` 的 `divided→danger` 与随机 key 确认;`TableGripHandles.vue:601/638` `divided` 删除项确认 |
| H2 重复率 87-90% | ✅ 复测吻合 | 独立归一化 diff:Toolbar 212/1674(87% 同)、BubbleMenu 12/174(93% 同)、SlashCommandMenu 20/168(88% 同) |
| H3 三份拷贝逻辑 | ✅ 属实 | 链接正则恰 6 处(2 文件 ×3 包);视口夹紧算法三包同在 `SlashCommandMenu.vue:43` 逐字相同;TableGripHandles 736/653/724 行;ant `dark` prop(`Toolbar.vue:128`)在 el/naive 为 0 处 |
| H4 工具链缺失 | ✅ 属实 | eslintrc/prettierrc/husky 等全不存在;e2e 无 `../visual-compare` 即 throw(有 `VISUAL_COMPARE_DIR` 环境变量逃生口,文档此前未提);CI 中 playwright 出现 0 次;CHANGELOG 止于 0.2.2、tag 仅 v0.2.1/v0.2.2、无 .changeset |
| H5 allowBuilds 无效 | ❌ **论断推翻,已改写并降级** | 本机 pnpm 10.32.1 dist 源码中 `allowBuilds` ×16,含 `onlyBuiltDependencies` 归一化逻辑 → 配置有效;postinstall hack 属冗余保险而非救命稻草。首次误判源于 grep 了 `bin/pnpm.cjs` 启动器而非 `dist/pnpm.cjs` 真身 |
| M1 i18n 旁路 | ✅ 属实 | `commandRegistry.ts` 中文 label 恰 35 处;`imageNodeView.ts:138` '添加题注';`media.ts:344` 'Download' 逐行确认 |
| M2 热路径 debug | ✅ 属实 | `useProEditor.ts:112-119` 每次调用重建 logger;onTransaction 无条件构造 payload;`debug.ts` 每次日志 resolve + localStorage 同步读 |
| M3 契约处 as any | ✅ 属实(实验证实) | 三适配器 `} as any)` 各在 196/253/196 行;core 10 处 findReplace + 4 处 indent 的 `as any` 行号逐一命中;**实验**:临时文件去掉 `as any` 直接调用 `ed.commands.findReplaceNext()` 通过 vue-tsc → 断言"as any 多余"成立(实验文件已删) |
| M4 v-model 突变 | ✅ 属实 | `options.content = val` 在 :266;`isUpdatingFromEditor` 在 :227-228 |
| M5 打印问题 | ✅ 属实 | PRINT_STYLES :25;`doc.write` :91-95;清理仅挂 `iframe.onload` |
| M6 API 面 269 | ✅ 精确复算 | 128 值符号 + 141 类型符号 = 269 |
| M7 巨型样式/模板 | ✅ 属实(数字微调) | style 块实测 989/948/990 行(原文 947-989);Toolbar `v-else-if` 各 35 个 |
| M8 构建产物 | ✅ 属实 | sourcemap 4 配置 0 处、dist 无 .map;el 包 d.ts 第 2/4 行 EP 深路径;lucide 在 dist 出现 73 处且 `package.json:63` 声明为依赖;UMD `?? 'Tiptap'` 确认 |
| M9 内部文档泄漏 | ✅ 属实(行号修正) | `srcExclude` 仅 2 项不含 docs/current;`docs/current` 10 文件被追踪;`.gitignore` 相关键在 :33-34(原文误写 20-22);`docs/plans/` 3 文件被追踪而 gitignore 声明忽略,矛盾成立 |
| 低项抽检 | ✅ 大部属实(计数精修) | mermaidNodeView 无测试、Napptive(MessageBridge.vue:6)、e2e 断言(`rgb(64,158,255)`:32、'右移':122、167.5:205、'9px':207)、waitForTimeout ×14、composite 仅 core、vite5/vitest1.6/vue-tsc2.1、readFileSync 测试、vi.mock core ×3、uploadImage 硬 import ElMessage、README:158 deploy.yml、package.json:11 rm -rf 均确认;主题变量计数修正:`--el-*` ×208、`--n-*` ×163、`--tvp-naive-*` ×14(el 包 17 处 `tvp-el-` 字样为 popper 类名非 CSS 变量,故"0 个 --tvp-el-* 变量"仍成立) |

复核后总体结论不变:高优先项收敛为 H1-H4 + M9(泄漏风险);H5 降级为清理项。

## 修复记录(2026-09-06,机械修复批,全量 typecheck/test 通过)

| 修复 | 内容 |
|---|---|
| M9 泄漏 | `srcExclude` 增加 `current/**`;`git rm --cached` docs/plans 下 3 个被追踪文件(文件保留在磁盘) |
| H2 ant 主色 | `#409eff` ×15 → `#1677ff`;4 处未定义变量名 `--tvp-ant-primary-color` → `--tvp-ant-color-primary`;主色 fallback 全包统一(此前 14 处 EP 蓝/21 处 antd 蓝分裂) |
| H2 ant 灰阶 | EP 调色板 16 组值整体替换为 antd token:`#dcdfe6/#e4e7ed→#d9d9d9`、`#ebeef5/#e5eaf3→#f0f0f0/rgba白`、`#f5f7fa→#fafafa`、`#909399→#8c8c8c`、`#606266→#595959`、`#303133→#262626`、`#a8abb2→#bfbfbf`、`#a0cfff→#4096ff`、`#ecf5ff→#e6f4ff`、暗色组(`#e5eaf3/#cfd3dc/#a3a6ad/#8d9095/#1d1e1f` → antd 暗色 token)。替换后 EP 值残留为 0;副作用:ant e2e 原本失败的 `rgb(22,119,255)` 断言现在与源码一致 |
| H2 primitives | `AntDropdownItem` 的 `divided` 不再映射 `danger`(误红字),改为渲染真正的 antd `MenuDivider` 分隔线;移除每次渲染随机的 `key` |
| H5 hack | 删除 root `package.json` 的 postinstall hack(`allowBuilds` 在 pnpm 10.32.1 下有效,hack 冗余) |
| M3 as any | core 14 处命令 `as any` 移除(10 findReplace + 4 indent,保留 `?.` 运行时防护);三适配器入口 options 对象的 `as any` 移除(typecheck 零错误,证明原本多余);剩余 `:195/:232/:1415` 三处属不同类型问题,留待计划 |
| 低项 | MessageBridge.vue "Napptive" → "Naive UI" |

未动(等待重构计划):H1 拆 useProEditor、H3 适配器共享逻辑下沉、Toolbar 数据驱动化、M1 i18n 旁路、M2 热路径 debug 缓存、M4 v-model 突变、M6 API 面收缩。
