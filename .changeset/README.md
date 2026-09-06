# Changesets

四个包(tiptap-vue-pro-core / -element-plus / -naive / -ant-design-vue)以 fixed
组联动发版:任何包的变更都会同步升到同一版本。

日常流程:

```bash
pnpm changeset            # 交互式登记变更(patch/minor/major + 摘要)
git add .changeset && git commit
# 合入 main 后由维护者执行:
pnpm changeset version    # 消费 changeset,更新版本号与 CHANGELOG
pnpm changeset publish    # 发布到 npm(涉及 2FA 时遵循 AGENTS.md 的认证规则)
```

注意:adapter 包以 workspace 协议依赖 core,changesets 在 publish 时会改写为
语义化版本区间;tiptap 家族是 core 的 peerDependencies,发版前用
`pnpm test:package-exports` 复核 tarball。
