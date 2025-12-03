# Claude Copilot - VSCode 插件产品需求文档 (PRD)

## 1. 产品概述

### 1.1 产品名称
Claude Copilot

### 1.2 产品定位
一款基于 Claude API 的智能代码助手 VSCode 插件,提供类似 GitHub Copilot 的功能体验,同时支持自定义模型配置,让开发者能够灵活选择和切换不同的 AI 模型。

### 1.3 目标用户
- 软件开发者
- 技术团队
- 希望使用 Claude API 进行代码辅助的个人和企业用户

### 1.4 核心价值
- **模型��活性**: 支持自定义配置多种 Claude 模型
- **Claude 原生体验**: 深度集成 Claude Code API,获得最佳代码理解和生成能力
- **隐私可控**: 支持自托管 API 端点配置

---

## 2. 核心功能

### 2.1 代码补全 (Inline Suggestions)

#### 功能描述
在编辑器中实时提供智能代码补全建议,类似 GitHub Copilot 的 ghost text 体验。

#### 功能细节
| 功能项 | 描述 |
|--------|------|
| 实时补全 | 根据当前光标位置和上下文,自动生成代码建议 |
| Ghost Text 显示 | 以灰色半透明文本显示建议代码 |
| Tab 接受 | 按 Tab 键接受当前建议 |
| 部分接受 | 支持按词/按行接受部分建议 |
| Esc 取消 | 按 Esc 键取消当前建议 |
| 多建议切换 | 支持 Alt+] / Alt+[ 切换多个建议 |
| 触发延迟配置 | 可配置触发补全的延迟时间 |

#### 快捷键
- `Tab`: 接受建议
- `Esc`: 取消建议
- `Alt+]`: 下一个建议
- `Alt+[`: 上一个建议
- `Ctrl+Right` / `Cmd+Right`: 接受下一个词

---

### 2.2 对话式交互 (Chat)

#### 功能描述
在 VSCode 侧边栏提供对话界面,支持与 AI 进行多轮对话交流。

#### 功能细节
| 功能项 | 描述 |
|--------|------|
| 侧边栏面板 | 专属 Chat 面板,支持拖拽调整大小 |
| 多轮对话 | 保持上下文的连续对话能力 |
| 代码块渲染 | 支持语法高亮的代码块显示 |
| 一键复制 | 代码块支持一键复制到剪贴板 |
| 一键插入 | 将代码块直接插入到编辑器 |
| 一键应用 | 智能将代码应用到当前文件 |
| 历史记录 | 保存对话历史,支持查看和恢复 |
| 清空对话 | 一键清空当前对话上下文 |

---

### 2.3 内联对话 (Inline Chat)

#### 功能描述
在编辑器内直接与 AI 对话,无需切换到侧边栏。

#### 功能细节
| 功能项 | 描述 |
|---------|-------------|
| 快捷键触发 | `Ctrl+I` / `Cmd+I` 在当前位置打开内联对话框 |
| 选中代码交互 | 选中代码后触发,直接对选中代码进行操作 |
| Diff 预览 | 显示修改前后的差异对比 |
| 接受/拒绝 | 快速接受或拒绝建议的修改 |

---

### 2.4 代码操作命令

#### 功能描述
提供一系列预定义的代码操作命令,通过命令面板或右键菜单触发。

#### 命令列表
| 命令 | 快捷键 | 描述 |
|------|--------|------|
| `/explain` | - | 解释选中的代码 |
| `/fix` | - | 修复代码中的问题 |
| `/refactor` | - | 重构选中的代码 |
| `/optimize` | - | 优化代码性能 |
| `/doc` | - | 为代码生成文档注释 |
| `/tests` | - | 为代码生成单元测试 |
| `/review` | - | 代码审查,提供改进建议 |

---

### 2.5 上下文感知

#### 功能描述
智能收集和管理代码上下文,提供更准确的建议。

#### 功能细节
| 功能项 | 描述 |
|--------|------|
| 当前文件分析 | 分析当前编辑文件的完整内容 |
| 相关文件引用 | 自动识别和引用相关的 import/require 文件 |
| 项目结构感知 | 理解项目目录结构和配置文件 |
| Git 变更感知 | 可选择性包含 Git diff 信息 |
| @file 引用 | 在对话中通过 @file 手动引用特定文件 |
| @workspace 引用 | 搜索整个工作区的相关内容 |
| @selection 引用 | 引用当前选中的代码 |
| @terminal 引用 | 引用终端输出内容 |
| @problems 引用 | 引用 VSCode 问题面板的诊断信息 |

---

### 2.6 智能代码生成

#### 功能描述
根据自然语言描述生成代码。

#### 功能细节
| 功能项 | 描述 |
|--------|------|
| 注释生成代码 | 根据代码注释自动生成实现 |
| 函数签名补全 | 根据函数名和参数生成函数体 |
| 模板生成 | 生成常用代码模板 (组件、类、接口等) |
| 多文件生成 | 支持一次生成多个相关文件 |

---

### 2.7 代码编辑能力

#### 功能描述
直接在编辑器中执行 AI 建议的代码修改。

#### 功能细节
| 功能项 | 描述 |
|--------|------|
| Apply in Editor | 将 AI 建议的代码直接应用到文件 |
| Diff View | 修改前显示差异对比 |
| 多点编辑 | 支持同时修改多个位置 |
| Undo 支持 | 完整的撤销/重做支持 |

---

## 3. 模型配置 (核心差异化功能)

### 3.1 自定义模型支持

#### 功能描述
支持配置和切换不同的 Claude 模型,满足不同场景需求。

#### 支持的模型
| 模型 | 适用场景 |
|------|----------|
| claude-sonnet-4-20250514 | 日常编码,平衡性能和成本 |
| claude-opus-4-20250514 | 复杂任务,需要深度推理 |
| claude-3-5-haiku-20241022 | 简单补全,追求速度 |
| 自定义模型 | 支持配置任意兼容模型 |

#### 配置方式
```json
{
  "claudeCopilot.models": {
    "completion": "claude-3-5-haiku-20241022",
    "chat": "claude-sonnet-4-20250514",
    "complex": "claude-opus-4-20250514"
  }
}
```

### 3.2 API 配置

#### 功能描述
灵活配置 API 连接方式。

#### 配置项
| 配置项 | 描述 |
|--------|------|
| API Key | Claude API 密钥 |
| Base URL | API 端点地址 (支持自托管/代理) |
| 请求超时 | 自定义请求超时时间 |
| 最大 Token | 配置响应最大 Token 数 |
| 温度参数 | 配置模型创造性程度 |

#### 配置示例
```json
{
  "claudeCopilot.apiKey": "sk-ant-xxx",
  "claudeCopilot.baseUrl": "https://api.anthropic.com",
  "claudeCopilot.timeout": 30000,
  "claudeCopilot.maxTokens": 4096,
  "claudeCopilot.temperature": 0.7
}
```

### 3.3 模型快速切换

#### 功能描述
提供便捷的模型切换方式。

#### 实现方式
- 状态栏显示当前模型
- 点击状态栏快速切换
- 命令面板切换: `Claude Copilot: Switch Model`
- 快捷键切换: `Ctrl+Shift+M` / `Cmd+Shift+M`

---

## 4. Claude Code API 集成

### 4.1 Claude Code 特性支持

#### 功能描述
深度集成 Claude Code API 的专属能力。

#### 功能细节
| 功能项 | 描述 |
|--------|------|
| 工具调用 (Tool Use) | 支持 Claude 的函数调用能力 |
| 长上下文 | 支持 200K token 上下文窗口 |
| 流式响应 | 实时流式输出响应内容 |
| 代码执行 | 可选的沙箱代码执行能力 |
| 多模态输入 | 支持图片输入 (截图、设计稿) |

### 4.2 高级功能

| 功能项 | 描述 |
|--------|------|
| Artifacts 渲染 | 渲染 Claude 返回的 Artifacts |
| 思维链展示 | 可选显示模型思考过程 |
| 缓存优化 | 利用 prompt caching 优化性能和成本 |

---

## 5. 用户体验

### 5.1 状态栏集成

| 状态项 | 描述 |
|--------|------|
| 连接状态 | 显示 API 连接状态 |
| 当前模型 | 显示当前使用的模型 |
| Token 用量 | 显示当前会话 Token 消耗 |

### 5.2 设置界面

- 图形化设置界面
- 分类清晰的配置选项
- 实时验证配置有效性
- 一键测试 API 连接

### 5.3 快捷键配置

- 所有功能支持自定义快捷键
- 提供推荐的快捷键方案
- 支持导入/导出快捷键配置

---

## 6. 隐私与安全

### 6.1 数据处理

| 功能项 | 描述 |
|--------|------|
| 本地存储 | API Key 加密存储在本地 |
| 请求过滤 | 支持配置不发送的文件类型 |
| 日志控制 | 可配置日志级别和内容 |
| 敏感信息过滤 | 自动过滤常见敏感信息模式 |

### 6.2 网络安全

| 功能项 | 描述 |
|--------|------|
| HTTPS 强制 | 强制使用 HTTPS 连接 |
| 代理支持 | 支持 HTTP/SOCKS 代理配置 |
| 证书验证 | 可配置 SSL 证书验证 |

---

## 7. 技术架构

### 7.1 技术栈

| 组件 | 技术选型 |
|------|----------|
| 插件框架 | VSCode Extension API |
| 开发语言 | TypeScript |
| UI 框架 | Webview (React/Vue 可选) |
| 网络请求 | Anthropic SDK / fetch |
| 状态管理 | VSCode ExtensionContext |

### 7.2 架构设计

```
+-----------------------------------------------------+
|                    VSCode Extension                  |
+---------------+---------------+---------------------+
|   Commands    |   Providers   |      Webviews       |
|  - Chat       |  - Inline     |   - Chat Panel      |
|  - Explain    |    Completion |   - Settings        |
|  - Fix        |  - Hover      |   - History         |
|  - Refactor   |  - CodeLens   |                     |
+---------------+---------------+---------------------+
|                   Core Services                      |
|  +--------------+--------------+----------------+   |
|  |   Context    |   Model      |    API         |   |
|  |   Manager    |   Manager    |    Client      |   |
|  +--------------+--------------+----------------+   |
+-----------------------------------------------------+
|                  Claude API Layer                    |
|        (Anthropic SDK / Claude Code API)            |
+-----------------------------------------------------+
```

---

## 8. 配置项汇总

### settings.json 完整配置

```json
{
  // API 配置
  "claudeCopilot.apiKey": "",
  "claudeCopilot.baseUrl": "https://api.anthropic.com",

  // 模型配置
  "claudeCopilot.model.completion": "claude-3-5-haiku-20241022",
  "claudeCopilot.model.chat": "claude-sonnet-4-20250514",
  "claudeCopilot.model.complex": "claude-opus-4-20250514",

  // 补全配置
  "claudeCopilot.completion.enable": true,
  "claudeCopilot.completion.delay": 300,
  "claudeCopilot.completion.maxTokens": 500,

  // Chat 配置
  "claudeCopilot.chat.maxTokens": 4096,
  "claudeCopilot.chat.temperature": 0.7,
  "claudeCopilot.chat.streamResponse": true,

  // 上下文配置
  "claudeCopilot.context.maxFiles": 10,
  "claudeCopilot.context.maxTokens": 8000,
  "claudeCopilot.context.includeImports": true,

  // 隐私配置
  "claudeCopilot.privacy.excludePatterns": [
    "**/.env*",
    "**/secrets/**"
  ],

  // 显示配置
  "claudeCopilot.ui.showTokenUsage": true,
  "claudeCopilot.ui.showModelInStatusBar": true
}
```

---

## 9. 开发路线图

### Phase 1: 基础功能 (MVP)
- [ ] 项目初始化与架构搭建
- [ ] API 客户端封装
- [ ] 基础代码补全
- [ ] 简单对话面板
- [ ] 模型配置支持

### Phase 2: 核心体验
- [ ] 内联对话 (Inline Chat)
- [ ] 代码命令 (/explain, /fix, /refactor)
- [ ] 上下文管理优化
- [ ] 多模型切换
- [ ] 流式响应

### Phase 3: 高级功能
- [ ] @file, @workspace 引用
- [ ] Git 集成
- [ ] 历史记录管理
- [ ] 自定���命令

### Phase 4: 优化与扩展
- [ ] 性能优化
- [ ] 缓存策略
- [ ] 多语言适配
- [ ] 企业级功能

---

## 10. 成功指标

| 指标 | 目标 |
|------|------|
| 补全接受率 | > 30% |
| 响应延迟 | < 500ms (补全) / < 2s (对话) |
| 用户满意度 | > 4.0/5.0 |
| 日活用户 | 持续增长 |

---

## 11. 竞品对比

| 功能 | GitHub Copilot | Claude Copilot (本项目) |
|------|---------------|----------------------|
| 代码补全 | Yes | Yes |
| Chat 对话 | Yes | Yes |
| 内联对话 | Yes | Yes |
| 自定义模型 | No | Yes |
| 自定义 API 端点 | No | Yes |
| 开源 | No | Yes |
| Claude 模型 | No | Yes |
| 长上下文 | 受限 | 200K tokens |
| 多模态输入 | No | Yes (图片) |
| 定价透明 | 订阅制 | 按量付费 |

---

*文档版本: v1.0*
*最后更新: 2024-12*
