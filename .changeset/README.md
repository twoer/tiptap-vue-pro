# Changesets

四个包(tiptap-vue-pro-core / -element-plus / -naive / -ant-design-vue)以 fixed
组联动发版:任何包的变更都会同步升到同一版本。

日常流程:

```bash
pnpm changeset            # 交互式登记变更(patch/minor/major + 摘要)
git add .changeset && git commit
# 合入 main 后由维护者执行:
pnpm changeset version    # 消费 changeset,更新版本号与 CHANGELOG
pnpm build                # 刷新 dist,发布的是本地产物
node scripts/publish-webauth.mjs   # 发布到 npm(Security Key 账号专用,见下)
```

> **为什么不用 `pnpm changeset publish`**:npm 10 的发布链路对 Security Key
> (WebAuthn)账号只会报 EOTP 死路;`scripts/publish-webauth.mjs` 用 npm 12 的
> 发布网页认证(浏览器安全钥匙验证)完成发布,并处理 `workspace:^` 改写与
> 幂等跳过。细节见 AGENTS.md 的 npm 认证规则(2026-09 实证)。

注意:adapter 包以 workspace 协议依赖 core,发布时必须改写为语义化版本区间
(scripts/publish-webauth.mjs 与 changeset publish 都会处理);tiptap 家族是
core 的 peerDependencies,发版前用 `pnpm test:package-exports` 复核 tarball。
