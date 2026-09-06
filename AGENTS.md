# AGENTS.md

## Project Rules

### UI Adapter Boundaries

Each package under `packages/*` is an adapter for one UI library. Keep adapter code honest to that library.

- `packages/element-plus` must use Element Plus components and Element Plus naming.
- `packages/naive` must use Naive UI components and Naive UI naming.
- `packages/ant-design-vue` must use Ant Design Vue components and Ant Design Vue naming.
- Do not copy another adapter's component names into a different adapter, even as a compatibility layer. For example, `ElDialog`, `ElButton`, or `.el-*` selectors must not appear in the Naive UI or Ant Design Vue adapter.
- Do not copy another adapter's theme variables into a different adapter. Adapter-local CSS variables should be named after the target adapter, for example `--tvp-ant-*` in the Ant Design Vue adapter.
- If a small wrapper is needed, name it after the target adapter, such as `AntModal`, `AntButton`, or `NaiveMessageBridge`, and implement it with that adapter's UI library.
- Shared editor behavior belongs in `packages/core`; UI rendering, dialogs, dropdowns, messages, and styling belong in the adapter package.
- Any UI element containing an icon and text (including buttons, menu items, dropdown options, and toolbar actions) must use an `inline-flex` or `flex` wrapper with `align-items: center` and a consistent 6px `gap`; before finishing, visually verify that the icon and text have clear horizontal spacing and are vertically centered across all three adapters. Do not use child margins or rely on the icon/text baseline for alignment.
- Element Plus general action dropdowns must use `popper-class="tvp-el-action-dropdown"` so menu items keep the shared 32px minimum height and 12px horizontal padding; use a feature-specific popper class only when the interaction intentionally needs a different density.
- Menu labels should avoid repeating context already conveyed by the trigger icon or parent menu. For example, under the Markdown trigger use `导入` and `导出`, not `导入 Markdown` and `导出 Markdown`.

Before finishing adapter work, run a boundary check:

```bash
rg -n "\\bEl(Button|Tooltip|Dropdown|DropdownMenu|DropdownItem|Dialog|Input|Popover|ColorPicker|Checkbox|Divider)\\b|element-plus|\\.el-|--el-" packages/naive packages/ant-design-vue
rg -n "\\bN(Button|Tooltip|Dropdown|Input|Modal|ColorPicker|Checkbox|Divider|ConfigProvider|MessageProvider)\\b|naive-ui|\\.n-|--n-" packages/element-plus packages/ant-design-vue
rg -n "\\bAnt(Button|Tooltip|Dropdown|DropdownMenu|DropdownItem|Modal|Input|Checkbox|Divider|Icon)\\b|ant-design-vue|\\.ant-|--ant-" packages/element-plus packages/naive
```

Intentional mentions in documentation or tests must be clearly explanatory, not implementation dependencies.

### Verification

For adapter changes, run at least:

```bash
pnpm --filter tiptap-vue-pro-core typecheck
pnpm --filter tiptap-vue-pro-<adapter> typecheck
pnpm --filter tiptap-vue-pro-<adapter> test
```

If the playground is touched, also run:

```bash
pnpm --filter playground build
```

### npm 发布与撤回认证规则（2026-08）

- 如果 npm 账号显示 `Security Key`，说明账号使用 WebAuthn/Passkey，而不是 Authenticator App/TOTP；不要要求二维码、6 位 OTP 或让用户反复寻找 OTP。
- npm CLI（包括 npm 12）仍保留 `--otp` 和 `EOTP` 流程，但它不等于支持 Security Key 的浏览器交互。对 Security Key 账号遇到 `EOTP` 时，应判断为 CLI 认证方式不匹配，优先改走 npm 网页授权/系统安全密钥流程。
- 不要为了绕过 `EOTP` 反复消耗 recovery code，也不要假设升级 npm CLI 能解决 WebAuthn 交互。
- （2026-09 实证，修正上一条）`changeset publish` 搭配 npm 10 的发布链路对 Security Key 账号是死路：npm 10 对发布只支持 TOTP，EOTP 无法绕过。但 **npm 12 原生支持发布的网页认证**——TTY 下打印 `https://www.npmjs.com/auth/cli/...` 链接，浏览器完成安全钥匙验证后发布自动继续。标准发布命令：

  ```bash
  pnpm build
  node scripts/publish-webauth.mjs
  ```

  脚本按 core → 适配器顺序发布，自动完成三件事：临时把包内 `workspace:^` 改写为真实区间（发完 git 还原）、伪 TTY 运行 `npx npm@12 publish`、捕获认证链接并自动打开浏览器。registry 已有同版本会自动跳过，可安全重跑。
- （2026-09-06 实证）**agent / 无终端环境**下 `publish-webauth.mjs` 的 `/usr/bin/script` 会报 `tcgetattr/ioctl: Operation not supported on socket` 全军覆没——这是环境限制（stdin 是 socket 而非 TTY），不是认证问题；不要反复重试 script 或换目录，直接切换到下面的 Python PTY 流程。原则：**一旦确定需要网页认证，立即发起并把浏览器打开让用户完成 Security Key 验证**——用户认证本来就是流程的一步，不要在环境 workaround 上反复消耗用户等待时间。
- （2026-09-06 实证）npm 12 网页认证的前提是**真 TTY**：无 TTY 时完全不发起挑战（不打印认证链接，publish 直接报 E404/ENEEDAUTH）。macOS `script` 要求自身 stdin 是 TTY，所以在 agent 环境必失败；Python `pty` 模块（`openpty` + `Popen`）不受父进程 stdin 类型影响，是无终端环境的正解。另一个坑：`~/.npmrc` 里有**失效 `_authToken`** 时（`npm whoami` → E401），npm 会带着死 token 跳过登录挑战直接 PUT，publish 报被掩码成 404 的权限错误——先用 `npm whoami` 探测，失效就用 `grep -v _authToken ~/.npmrc > /tmp/tvp-publish.npmrc` 做一份保留 registry/proxy、去掉死 token 的 userconfig。
- （2026-09-06 实证）agent 环境的标准发布流程（两步走，驱动脚本已固化在 `scripts/npm-webauth-run.py`）：
  1. 登录：`python3 scripts/npm-webauth-run.py packages/core npx -y npm@12 login --auth-type=web --userconfig /tmp/tvp-publish.npmrc`——驱动在真 PTY 里运行、自动应答「Press ENTER」、抓取认证链接（`www.npmjs.com/auth/cli/...` 或 `www.npmjs.com/login?next=/login/cli/...`）并打开本地 Google Chrome；浏览器弹出后请用户完成验证，token 写入临时 userconfig。
  2. 逐包发布：core 无需改写直接发；三个适配器先 `sed -i '' 's/"workspace:\^"/"^<版本>"/g' package.json` 再发，发完 `git checkout -- package.json` 还原。命令同为 `python3 scripts/npm-webauth-run.py <pkg-dir> npx -y npm@12 publish --access public --userconfig /tmp/tvp-publish.npmrc`。Security Key 账号**第一个 publish 会再发起一次 WebAuthn 挑战**（需要用户再验证一次），之后会话复用、其余包不再打扰。
  3. 完成后跑 `node scripts/verify-publish.mjs` 做消费者视角验证（registry 可见 + 全新安装 + 构建 + 三适配器冒烟）。
- npm 12 对 node 版本有 `^22.22.2 || >=26` 的 engines 要求，在更低的小版本（如 22.19）上会打 EBADENGINE 警告但可正常工作；以实际发布结果为准。
- 2026 年 8 月起，启用 bypass-2FA 的 granular access token 不能执行部分敏感的账号、包和组织管理操作；不要假设此类 token 可以完成 unpublish。
- 后续任何 npm 操作涉及网页时，禁止打开或切换到 Codex 内置浏览器；必须优先使用用户本地 Google Chrome。
- 如果本地 Chrome 不可连接、未安装/启用浏览器扩展或未完成登录，应停止并明确说明阻塞原因，不得自动降级到内置浏览器。
- 撤回包时必须使用精确的 `package@version`，先核对目标版本和保留版本；除非明确要求，不得撤回整个包或删除 `latest` 指向的稳定版本。
- AGENTS.md、日志和提交信息中不得记录 npm token、recovery code、OTP 或其他凭据；一旦凭据被粘贴到对话或终端输出，应立即撤销并重新生成。

参考：

- https://docs.npmjs.com/about-two-factor-authentication
- https://docs.npmjs.com/unpublishing-packages-from-the-registry
- https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/
