# Claude Copilot

An intelligent code assistant VSCode extension powered by Claude API with customizable model support.

## Features

- **Code Completion** - Real-time inline suggestions with context-aware completions
- **Chat Interface** - Multi-turn conversations with Markdown and code highlighting
- **Code Commands** - Explain, fix, refactor, generate docs and tests
- **Model Switching** - Quick switch between Haiku, Sonnet, and Opus models
- **Custom API Endpoint** - Support for self-hosted or proxy endpoints

## Installation

### From VSIX

1. Download the latest `.vsix` from [Releases](https://github.com/zhuoqi-chen/claude-copilot/releases)
2. Run `Extensions: Install from VSIX...` in VSCode
3. Select the downloaded file

### From Source

```bash
git clone https://github.com/zhuoqi-chen/claude-copilot.git
cd claude-copilot
npm install
npm run build
npm run package
code --install-extension claude-copilot-0.3.0.vsix
```

## Configuration

1. Get your API key from [Anthropic Console](https://console.anthropic.com/)
2. Open VSCode Settings and search "Claude Copilot"
3. Enter your API key

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `claudeCopilot.apiKey` | `""` | Claude API key |
| `claudeCopilot.baseUrl` | `https://api.anthropic.com` | API endpoint |
| `claudeCopilot.model.completion` | `claude-3-5-haiku-20241022` | Completion model |
| `claudeCopilot.model.chat` | `claude-sonnet-4-20250514` | Chat model |
| `claudeCopilot.completion.enable` | `true` | Enable completion |
| `claudeCopilot.completion.delay` | `150` | Trigger delay (ms) |
| `claudeCopilot.chat.maxTokens` | `4096` | Max response tokens |
| `claudeCopilot.chat.streamResponse` | `true` | Enable streaming |

## Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| Open Chat | - | Open chat panel |
| Inline Chat | `Ctrl+I` / `Cmd+I` | Inline chat at cursor |
| Explain Code | - | Explain selected code |
| Fix Code | - | Fix selected code |
| Refactor Code | - | Refactor selected code |
| Generate Docs | - | Generate documentation |
| Generate Tests | - | Generate unit tests |
| Switch Model | `Ctrl+Shift+M` / `Cmd+Shift+M` | Switch model |

## Development

```bash
npm install        # Install dependencies
npm run build      # Build extension
npm run build:watch # Watch mode
npm run lint       # Lint code
npm run package    # Package for distribution
```

## License

MIT License - see [LICENSE](LICENSE) for details.
