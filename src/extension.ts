import * as vscode from 'vscode';
import { ApiClient, ConfigManager, ContextManager, ModelManager } from './services';
import { registerCompletionProvider } from './providers';
import { ChatViewProvider } from './webview';
import { registerCommands } from './commands';

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext): void {
  console.log('Claude Copilot is now active!');

  // Initialize services
  const configManager = ConfigManager.getInstance();
  const apiClient = new ApiClient(configManager);
  const contextManager = new ContextManager(configManager);
  const modelManager = new ModelManager(configManager);

  // Check API key configuration
  if (!configManager.isApiKeyConfigured()) {
    showApiKeyNotification();
  }

  // Register Chat View Provider
  const chatViewProvider = new ChatViewProvider(
    context.extensionUri,
    apiClient,
    contextManager,
    configManager
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatViewProvider)
  );

  // Register Completion Provider
  context.subscriptions.push(registerCompletionProvider(apiClient, contextManager, configManager));

  // Register Commands
  registerCommands(
    context,
    apiClient,
    contextManager,
    configManager,
    modelManager,
    chatViewProvider
  );

  // Create status bar items
  createStatusBarItems(context, apiClient, configManager);

  // Add model manager to subscriptions for cleanup
  context.subscriptions.push({ dispose: () => modelManager.dispose() });

  // Listen for configuration changes
  context.subscriptions.push(
    configManager.onConfigChange(() => {
      updateStatusBar(apiClient, configManager);
    })
  );
}

function showApiKeyNotification(): void {
  vscode.window
    .showWarningMessage(
      'Claude Copilot: API key not configured. Please set your API key to use the extension.',
      'Open Settings'
    )
    .then((selection) => {
      if (selection === 'Open Settings') {
        vscode.commands.executeCommand(
          'workbench.action.openSettings',
          'claudeCopilot.apiKey'
        );
      }
    });
}

function createStatusBarItems(
  context: vscode.ExtensionContext,
  apiClient: ApiClient,
  configManager: ConfigManager
): void {
  // Token usage status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
  statusBarItem.command = 'claudeCopilot.openChat';
  context.subscriptions.push(statusBarItem);

  updateStatusBar(apiClient, configManager);

  // Update token usage periodically
  const updateInterval = setInterval(() => {
    updateStatusBar(apiClient, configManager);
  }, 5000);

  context.subscriptions.push({
    dispose: () => clearInterval(updateInterval),
  });
}

function updateStatusBar(apiClient: ApiClient, configManager: ConfigManager): void {
  const config = configManager.getConfig();

  if (config.ui.showTokenUsage) {
    const usage = apiClient.getTotalUsage();
    const totalTokens = usage.inputTokens + usage.outputTokens;

    if (totalTokens > 0) {
      statusBarItem.text = `$(pulse) ${formatTokens(totalTokens)} tokens`;
      statusBarItem.tooltip = `Claude Copilot Token Usage\nInput: ${formatTokens(usage.inputTokens)}\nOutput: ${formatTokens(usage.outputTokens)}\nClick to open chat`;
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  } else {
    statusBarItem.hide();
  }
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return (tokens / 1000000).toFixed(1) + 'M';
  } else if (tokens >= 1000) {
    return (tokens / 1000).toFixed(1) + 'K';
  }
  return tokens.toString();
}

export function deactivate(): void {
  console.log('Claude Copilot is now deactivated');
}
