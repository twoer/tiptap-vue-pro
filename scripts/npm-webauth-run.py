#!/usr/bin/env python3
"""npm 12 网页认证的 PTY 驱动(agent / 无终端环境专用,AGENTS.md 2026-09-06 条目)。

背景:Security Key 账号的 npm 12 网页认证需要真 TTY——无 TTY 时 npm 不发起挑战,
publish 直接 E404/ENEEDAUTH;macOS `script` 又要求自身 stdin 是 TTY,在 agent 环境
(stdin 为 socket)必失败。本脚本用 Python `pty` 模块(openpty + Popen)绕开该限制:

- 在真实 PTY 里运行任意命令(npm login / npm publish 等);
- 自动应答「Press ENTER to open in the browser...」类提示;
- 抓取认证链接(www.npmjs.com/auth/cli/... 或 /login?next=/login/cli/...)并用
  本地 Google Chrome 打开(Chrome 不可用时回退系统默认浏览器),等用户完成
  Security Key 验证后命令自动继续。

用法:
  python3 scripts/npm-webauth-run.py <workdir> <command...>

示例(见 AGENTS.md「npm 发布与撤回认证规则」):
  # 登录(token 写入无死 token 的临时 userconfig)
  python3 scripts/npm-webauth-run.py packages/core \\
    npx -y npm@12 login --auth-type=web --userconfig /tmp/tvp-publish.npmrc
  # 逐包发布(适配器先 sed 改写 workspace:^,发完 git checkout 还原)
  python3 scripts/npm-webauth-run.py packages/element-plus \\
    npx -y npm@12 publish --access public --userconfig /tmp/tvp-publish.npmrc
"""
import os, pty, re, select, subprocess, sys, time

CWD = sys.argv[1] if len(sys.argv) > 1 else "."
CMD = sys.argv[2:]

if not CMD:
    print(__doc__)
    sys.exit(2)

master, slave = pty.openpty()
proc = subprocess.Popen(CMD, stdin=slave, stdout=slave, stderr=slave, cwd=CWD, close_fds=True)
os.close(slave)

buffer = ""
opened = False
sent_enter = 0
deadline = time.time() + 300  # 给用户 5 分钟完成安全钥匙验证

AUTH_URL = re.compile(
    r"https://(?:www\.npmjs\.com/(?:auth/cli|login)|registry\.npmjs\.org/auth)/[^\s\"']+"
)

while time.time() < deadline:
    r, _, _ = select.select([master], [], [], 1.0)
    if master in r:
        try:
            data = os.read(master, 4096)
        except OSError:
            break
        if not data:
            break
        text = data.decode(errors="replace")
        sys.stdout.write(text)
        sys.stdout.flush()
        buffer += text

        m = AUTH_URL.search(buffer)
        if m and not opened:
            opened = True
            url = m.group(0)
            print(f"\n[driver] 认证链接: {url}", flush=True)
            result = subprocess.run(["open", "-a", "Google Chrome", url], capture_output=True)
            if result.returncode != 0:
                subprocess.run(["open", url], check=False)
                print("[driver] 已用系统默认浏览器打开,请完成 Security Key 验证", flush=True)
            else:
                print("[driver] 已在 Google Chrome 打开,请完成 Security Key 验证", flush=True)

        # 「Press ENTER to open in the browser...」类提示自动回车
        tail = buffer[-200:].lower()
        if ("press enter" in tail or tail.rstrip().endswith("? ")) and sent_enter < 3:
            sent_enter += 1
            time.sleep(0.3)
            os.write(master, b"\n")

    if proc.poll() is not None:
        break

# 排空残余输出
while True:
    r, _, _ = select.select([master], [], [], 0.5)
    if master not in r:
        break
    try:
        data = os.read(master, 4096)
    except OSError:
        break
    if not data:
        break
    sys.stdout.write(data.decode(errors="replace"))

code = proc.wait()
print(f"[driver] 退出码: {code}", flush=True)
sys.exit(code)
