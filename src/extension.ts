import * as vscode from 'vscode';
import { ApiClient, ConfigManager, ContextManager, ModelManager, ChatSessionManager } from './services';
import { registerCompletionProvider } from './providers';
import { ChatViewProvider } from './webview';
import { registerCommands } from './commands';

export function activate(context: vscode.ExtensionContext): void {
  console.log('Claude Copilot is now active!');

  // Initialize services
  const configManager = ConfigManager.getInstance();
  const apiClient = new ApiClient(configManager);
  const contextManager = new ContextManager(configManager);
  const modelManager = new ModelManager(configManager);
  const sessionManager = new ChatSessionManager(context);

  // Check API key configuration
  if (!configManager.isApiKeyConfigured()) {
    showApiKeyNotification();
  }

  // Register Chat View Provider
  const chatViewProvider = new ChatViewProvider(
    context.extensionUri,
    apiClient,
    contextManager,
    configManager,
    sessionManager,
    modelManager
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

  // Add model manager to subscriptions for cleanup
  context.subscriptions.push({ dispose: () => modelManager.dispose() });
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

export function deactivate(): void {
  console.log('Claude Copilot is now deactivated');
}
