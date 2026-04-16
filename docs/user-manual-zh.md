# 用户手册

本手册介绍 Golden Apple Island 安装完成后的使用方法。安装步骤请参阅 README 中的[快速开始](../README_zh.md#快速开始)。

## 工作原理

当 Claude Code 执行工具调用（运行 Shell 命令、写入文件等）时，Golden Apple Island 会在操作发生前拦截它：

1. Claude Code 在每次工具调用时触发一个 **Hook**。
2. Hook 通过轻量级 **Bridge** 将事件经 WebSocket（`localhost:10423`）转发到 Golden Apple Island 后端。
3. 后端立即根据你的**审批策略（Approval Policy）**做出判断：
   - **Auto** — 静默放行，事件不会出现在界面上。
   - **Manual** — 加入弹出窗口的待审队列，等你批准或拒绝。
   - **Agent** — 委托给本地 Claude Code Agent 进行自动审查。
   - **External** — 委托给你控制的 HTTP 端点。
4. 决策结果传回 Claude Code，工具调用继续或中止。

```text
Claude Code ─► Hook ─► Bridge ─► GAI 后端 ─┬─► Auto（静默放行）
                                            ├─► Popup（人工审核）
                                            └─► Agent / External（委托）
                                                     │
                                       响应结果 ◄────┘
```

所有数据都在本地处理 — 除非你配置了 External Approve 端点，否则不会有任何数据离开你的机器。

## 弹出窗口

弹出窗口是你与应用交互的主要界面。左键点击托盘图标（或按 `Ctrl+Shift+G`）切换显示。

### 顶栏

- **连接指示器** — 有活跃 Claude Code 会话时显示金色呼吸动画；离线时为静态图标。
- **待处理徽章** — 显示等待你决策的事件数量。
- **按钮** — 置顶、最小化到托盘、打开设置。

### 审批卡片

每个待处理事件显示为一张卡片，纵向堆叠：

- **左侧色条** — 按工具类别着色：
  - 琥珀色 = Shell 命令
  - 蓝色 = 文件写入
  - 石板灰 = 文件读取
  - 紫色 = 提问 / 追问
- **卡片内容** — 工具名称、命令或文件路径、工作目录、WSL 发行版。
- **操作** — 通过按钮或快捷键 **Approve**（`A`）和 **Deny**（`D`）。

特殊卡片类型：

- **Question Card** — Claude 发起追问时显示。包含文本输入框、**Submit** 和 **Skip** 按钮。
- **Permission Card** — 权限请求。三个按钮：**Allow**、**Allow Session**（当前会话内持续生效）、**Deny**。
- **Delegated Card** — Agent 或 External 端点正在决策中。显示旋转指示器和 **Take over** 链接（可随时接管决策权）。

### 策略面板

弹出窗口底部有两个下拉控件：

- **Override Policy** — 临时全局覆盖，优先级高于所有其他规则。选项：Force Auto、Force Manual、Agent、External。应用重启后自动重置（仅存于内存）。
- **Session Policy** — 为当前活跃会话设置持久化规则。选项：Auto Approve、Manual、Agent、External。
- **Approve All**（`Shift+A`）— 批准所有当前待处理的卡片。

### 最近记录

可折叠区域，显示最近约 10 条决策。每条记录左侧有颜色标记：

- 金色 = 手动批准
- 红色 = 拒绝
- 深金色 = 自动批准
- 紫色 = Agent 决策
- 蓝色 = External 决策

## 审批策略

审批策略决定如何处理每个传入事件。它们沿四层优先级链解析 — 最具体的匹配规则胜出。

### 优先级（高 → 低）

| 层级 | 作用范围 | 示例 |
|------|---------|------|
| **Session** | 特定的 Claude Code 会话 | "这次调试会话全部自动批准" |
| **Folder** | 特定工作目录（可选包含子目录） | "自动批准 `~/my-project` 下的所有操作" |
| **Distribution** | 特定 WSL 发行版 | "自动批准来自 Ubuntu-24.04 的所有操作" |
| **Global** | 其他所有情况 | "未被上述规则覆盖的默认使用 Manual" |

每个层级支持四种策略类型：**Manual**、**Auto**、**Agent**、**External**。

### 配置方式

打开 **Settings → Approval Policy** 管理规则：

- **Global** — 兜底规则，默认为 Manual。
- **Per Distribution** — 按 WSL 发行版添加规则。
- **Per Folder** — 按工作目录添加规则。可开启 **Include subdirectories** 覆盖子目录。
- **Per Session** — 通过弹出窗口的 Policy Panel 下拉框设置，或在 Settings 的 Recent Sessions 列表中设置。

### 行为说明

- **Auto** 事件完全在后端处理 — 永远不会出现在弹出窗口中。
- **Override Policy**（在弹出窗口中设置）拥有最高优先级，高于所有四个层级。仅存于内存，应用重启后重置。
- **Agent / External** 类型会将决策委托给相应系统（详见下方 [Agent Approve 与 External Approve](#agent-approve-与-external-approve实验性)）。

### 最佳实践

- **从 Manual 开始**（默认设置）。观察哪些工具调用你总是批准，然后将那些文件夹或发行版升级为 Auto。
- **Folder 规则**适合"我信任这个项目" — 将项目根目录设为 Auto，解放双手。
- **Session 规则**适合"我信任这次运行" — 不影响整体策略。

## Hook 管理

Hook 管理控制 Golden Apple Island 能"看到"哪些 Claude Code 事件。不同的 **Working Mode** 订阅不同的事件类型。

### Working Modes

| 模式 | 捕获的事件 | 是否阻塞？ |
|------|-----------|-----------|
| **Control** | 仅 `PermissionRequest` | 是 |
| **Audit** | `PreToolUse` + `PermissionRequest` | 是 |
| **Observe** | 所有事件（增加 `PostToolUse`、`SessionStart/End`、`Notification` 等） | PreToolUse / PermissionRequest 阻塞；其余仅记录不阻塞 |
| **Custom** | 自选事件类型 | 取决于所选类型 |

**阻塞**意味着 Claude Code 会等待你的决策才继续。**仅记录不阻塞**意味着事件被记录但不会暂停 Claude Code。

### 配置方式

打开 **Settings → Hook Management**：

- **Windows hook** — 为 Windows 本地安装的 Claude Code 启用。
- **WSL Instances** — 每个发行版独立选择模式。支持 **Enable All** / **Disable All** / **Update Scripts** 批量操作。
- **Custom mode** — 选择后展开事件类型的复选框列表，自由组合。

Hook 脚本由应用自动安装和管理，你无需手动编辑任何配置文件。

## 审计历史

审计历史是经过 Golden Apple Island 的所有事件的持久化日志，存储在本地机器上。

### 浏览

打开 **Settings → Audit History**。事件按两级层次组织：

- **Folder** → **Session** → 具体事件。

每条记录显示：工具名称、摘要、时间戳、决策结果（approve / deny / escalate）和决策来源（manual / auto / agent / external）。点击条目可展开完整事件详情。

### 固定与清理

- **固定（Pin）**重要条目，防止被自动清理。
- 未固定的条目按 LRU（最近最少使用）策略自动淘汰。大字段截断到 64 KB。
- 手动删除仅影响未固定条目 — 固定条目始终保留。

审计日志存储在 `%APPDATA%\GoldenAppleIsland\audit\`。

### 最佳实践

- 将 **Observe** Hook 模式与审计历史配合使用，事后复盘 Claude 在一个会话中做了什么。
- **固定**关键决策 — 尤其是涉及生产环境或破坏性操作的 — 以备日后查阅。

## Agent Approve 与 External Approve（实验性）

这两个功能通过将审批决策委托给外部决策者来实现自动化。两者都支持 **escalate** 作为安全阀 — 如果委托方无法决定或出错，事件会回退到弹出窗口进行人工审核。你永远不会被锁在外面。

### Agent Approve

将审批委托给本地 Claude Code Agent — 本质上是用第二个 Claude 来审查第一个 Claude 要做的事情。

- Agent 接收每个事件，返回以下之一：**approve**、**reject** 或 **escalate**。
- **默认 workspace：** 使用 [ALICE](https://github.com/CreeperLKF/ALICE)，从四个维度评估操作 — 不可逆性、影响范围、信息流和授权范围。
- **自定义 workspace：** 指向任意包含你自己 `CLAUDE.md` 的目录，定义你的审批逻辑。
- **Singleton session：** Agent 在同一会话内跨多个事件保持上下文。达到 turn limit（默认 20）后自动重置。

**配置方式**（Settings → Approval Policy 标签页底部）：

- Workspace path — 包含审查 Agent 的 `CLAUDE.md` 的目录。
- Turn limit — Agent 会话重置前的轮次数（默认 20）。
- Call timeout — 等待 Agent 决策的最大秒数（默认 60）。
- **Create default workspace** — 下载 ALICE 配置。
- **Reset session** — 强制开始新的 Agent 会话。

### External Approve

将审批委托给你控制的 HTTP 端点 — 适合已有内部审批系统或自定义规则引擎的团队。

- Golden Apple Island 将事件以 JSON 格式 POST 到你的端点。
- 端点返回：`{"verdict": "approve"|"reject"|"escalate", "reason": "..."}`。
- 支持自定义 Auth header 用于身份认证。

**配置方式**（Settings → Approval Policy 标签页底部）：

- Endpoint URL — POST 请求发送地址。
- Auth header — 自由格式的 `Header-Name: value`，用于身份认证。
- Call timeout — 等待响应的最大秒数（默认 30）。
- **Test endpoint** — 发送测试请求并显示反馈。

### 最佳实践

- Agent Approve **先从 ALICE 开始**。理解它的判断逻辑后再编写自定义 workspace。
- **External Approve** 在你已有内部审批系统或想接入自己的 LLM / 规则引擎时特别有用。
- 两者在 **escalate** 时都会回退到人工审核，因此不存在应用无响应的风险。

## 最佳实践与技巧

### 渐进式信任

从保守开始，随着信心增长逐步放开：

1. **Manual**（默认）— 审查每个工具调用，直到你掌握规律。
2. **Auto**（信任的文件夹/发行版）— 消除重复性审批。
3. **Agent / External** — 在你熟悉系统后进行高级自动化。

### 多会话工作流

- 并行运行多个 Claude Code 会话？使用 **Session Policy** 为每个会话独立设置规则。
- 需要短时间内完全信任？将 **Override Policy** 设为 Force Auto — 但记住应用重启后会重置。

### 选择 Hook 模式

- **Audit** — 日常模式。捕获所有工具调用进行审批，不包含观测事件的噪音。
- **Observe** — 需要完整了解会话中发生了什么时使用（配合审计历史进行事后复盘）。
- **Control** — 最小干扰。只有明确的权限提示才会通过。

### 键盘快捷键

均可在 **Settings → General** 中自定义：

| 快捷键 | 操作 |
|--------|------|
| `Ctrl+Shift+G` | 切换弹出窗口显示 |
| `A` | 批准最上方的待处理卡片 |
| `D` | 拒绝最上方的待处理卡片 |
| `Shift+A` | 批准所有待处理卡片 |
| `Esc` | 隐藏弹出窗口 |
