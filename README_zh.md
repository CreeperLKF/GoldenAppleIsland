<h1 align="center">
  <img src="logo.png" width="64" height="64" alt="Golden Apple Island" valign="middle">&nbsp;
  Golden Apple Island
</h1>
<p align="center">
  <b>在 Windows 托盘中一键审批 Claude Code 操作。</b><br>
  <a href="README.md">English</a> | 简体中文
</p>

*喜欢 macOS 上的 \*-Island，希望 Windows 也有类似的工具？试试 Golden Apple Island。*

基于 Tauri v2、React 和 Tailwind CSS 构建。

## 适用人群

所有在 Windows 上运行 Claude Code 的用户 — 无论是原生运行、通过 WSL，还是通过 SSH（即将推出）— 希望将每个审批提示变成一次点击、一条预设的自动决策，或最终交由 AI 智能判断。

## 为什么选择 Golden Apple Island

> [!TIP]
> **Auto-approve 优于 YOLO 模式。** 在 YOLO 模式下运行的 Agent 往往会"走神" — 拉取上级目录列表、探测相邻项目、收集实际并不需要的上下文。Auto-approve 提供同样的免打扰速度，同时让 Agent 在受监管的边界内运行，保持专注。每个决策都记录在"最近记录"中，如果有遗漏可以随时审计。

- **专为 Windows 开发者打造。** 原生托盘图标、Windows 通知、键盘快捷键，弹出窗口会记住你上次拖放的位置 — 无需切换终端。
- **无论 Claude Code 在哪运行都能接入。** 目前原生支持 WSL；SSH 支持在规划中。一个托盘应用即可服务你机器上的所有发行版和主机。
- **灵活组合的审批策略。** 全局、按发行版、按文件夹、按会话的规则沿清晰的优先级链解析 — 将可信工作区设为自动审批，生产环境保持手动，其余无需操心。Hook 模式同样可配置，满足更深层需求。
- **可自定义的 Hook 管理。** Golden Apple Island 管理连接 Claude Code 与托盘应用的 Hook 脚本。你可以配置哪些 Hook 类型生效、按发行版或文件夹设置不同行为，应用会自动保持一切同步 — 无需手动编辑 `settings.json`。
- **让另一个 Agent 或你自己 vibe 出来的服务来做决定。** Agent Approve 会启动第二个 Claude Code 实例作为安全审查员，逐条审阅请求并返回批准 / 拒绝 / 上报。[ALICE](https://github.com/CreeperLKF/ALICE) 项目提供开箱即用的审查配置 — 一个 "Alice" Agent 负责审计 "Bob"（你的工作 Agent）的行为。External Approve 则通过 HTTP 实现同样的功能，任何你自行搭建或 vibe-code 出来的服务都能作为决策者接入。

## 路线图

- [ ] SSH 支持 — 连接远程主机上的 Claude Code
- [ ] WSL NAT 及其他网络模式（不仅限于 mirrored）
- [ ] 界面优化 — 改进卡片布局、主题定制、无障碍访问

## 快速开始

1. **安装应用。** 从 [GitHub Releases](https://github.com/CreeperLKF/GoldenAppleIsland/releases) 下载最新的 `-setup.exe`，运行即可（无需管理员权限 — 按用户安装），从开始菜单启动 **Golden Apple Island** — 它会出现在系统托盘中。
2. **启用 WSL 发行版。** 右键托盘图标 → **Settings → Hook Management → WSL Instances → Enable all**。应用会为每个发行版安装 Hook 并自动注册到 `~/.claude/settings.json`。
3. **试一试。** 在任意 WSL 终端中运行 `claude`，让它执行一个需要工具调用的操作。Windows 通知弹出，托盘显示审批卡片 — 点击 ✓ 或 ✗，会话随即继续。

> **网络说明。** WSL 支持目前需要在 `.wslconfig` 中设置 `networkingMode = mirrored`，以便桥接程序可以通过 `127.0.0.1` 连接到 Windows WebSocket 服务器。NAT 及其他 WSL 网络模式在规划中。

## 安装

**从发布包安装（推荐）。** 按上方 **快速开始** 操作即可 — 一个 `-setup.exe` 涵盖一切。

**从源码构建。** 在 Windows 上克隆并构建：

```bash
git clone https://github.com/CreeperLKF/GoldenAppleIsland.git
cd GoldenAppleIsland
npm install
npm run tauri build
```

安装包位于 `src-tauri/target/release/bundle/nsis/`。运行后启动应用，从 **Settings → Hook Management → WSL Instances → Enable all** 启用 WSL 发行版，与快速开始步骤一致。

前置条件：Node 20+、通过 `rustup` 安装的 Rust，以及 [Tauri v2 Windows 前置条件](https://v2.tauri.app/start/prerequisites/)（MSVC 构建工具 + WebView2）。

### 可选：Agent Approve 和 External Approve（实验性）

**Agent Approve** 和 **External Approve** 策略分别将审批决策委托给 AI Agent 或外部 HTTP 端点。详见专门指南：[`docs/agent-external-approve.md`](docs/agent-external-approve.md)。

## 开发

```bash
npm install
npm run tauri dev
```

Rust 托盘应用启动，Vite 开发服务器运行在 `http://localhost:5173`，React 前端支持热重载。`Ctrl+C` 停止。

快速迭代（无需完整构建）：

```bash
npm run check              # tsc --noEmit + cargo check
npm run build              # 仅前端
```

发布节奏和完整脚本参考见 [`docs/releasing.md`](docs/releasing.md)。

## 使用弹出窗口

左键点击托盘图标显示或隐藏弹出窗口。可自由拖放 — 位置跨重启保持。弹出窗口获得焦点时的键盘快捷键：

| 按键 | 操作 |
|---|---|
| `A` | 审批最上方的待处理卡片 |
| `Shift+A` | 审批**所有**当前待处理卡片 |
| `D` | 拒绝最上方的待处理卡片 |
| `Esc` | 隐藏弹出窗口 |

弹出窗口的策略面板有两个控件：

- **Override Policy** — 全局最高优先级开关，覆盖所有其他规则。随时可用，即使没有活跃会话也可以设置。设为 Force Auto 可自动审批所有传入事件（不受会话或已配置规则影响），设为 Force Manual 可强制所有事件进入手动审核。应用重启后重置（仅存于内存）。配置后还支持 Agent Approve 和 External Approve。
- **Session Policy** — 为当前活跃会话写入持久化规则。支持 Auto Approve、Manual Approve、Agent Approve 和 External Approve。未配置的策略类型显示为灰色。

按发行版、按文件夹、按会话的审批规则位于 **Settings → Approval Policy**。

## 文档

更深入的技术文档位于 [`docs/`](docs/)：

| 查找内容 | 文档 |
|---|---|
| Hook、桥接和 Windows 应用如何协同 | [`docs/architecture.md`](docs/architecture.md) |
| Agent Approve 和 External Approve 配置指南 | [`docs/agent-external-approve.md`](docs/agent-external-approve.md) |
| WebSocket 消息协议 | [`docs/websocket-protocol.md`](docs/websocket-protocol.md) |
| 发布流程和构建脚本 | [`docs/releasing.md`](docs/releasing.md) |

产品需求、设计规范和实施计划位于配套的开发工作区仓库中。

## 致谢

灵感来自 [ping-island](https://github.com/erha19/ping-island/) — 该项目激励作者完成了 Golden Apple Island。

## 许可证

MIT — 详见 [LICENSE](LICENSE)。
