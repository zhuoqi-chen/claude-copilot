import * as vscode from 'vscode';
import { ApiClient, ConfigManager, ContextManager, ModelManager } from '../services';
import { ChatViewProvider } from '../webview';

export function registerCommands(
  context: vscode.ExtensionContext,
  apiClient: ApiClient,
  contextManager: ContextManager,
  configManager: ConfigManager,
  modelManager: ModelManager,
  chatViewProvider: ChatViewProvider
): void {
  // Open Chat command
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCopilot.openChat', () => {
      vscode.commands.executeCommand('claudeCopilot.chatView.focus');
    })
  );

  // Inline Chat command
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCopilot.inlineChat', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);

      const input = await vscode.window.showInputBox({
        prompt: 'What would you like Claude to do?',
        placeHolder: selectedText ? 'e.g., refactor, explain, fix...' : 'Ask Claude anything...',
      });

      if (!input) return;

      const message = selectedText ? `${input}\n\n\`\`\`\n${selectedText}\n\`\`\`` : input;

      // Focus chat view and send message
      await vscode.commands.executeCommand('claudeCopilot.chatView.focus');
      await chatViewProvider.sendCodeCommand('custom', message);
    })
  );

  // Explain Code command
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCopilot.explainCode', async () => {
      await executeCodeCommand('explain', contextManager, chatViewProvider);
    })
  );

  // Fix Code command
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCopilot.fixCode', async () => {
      await executeCodeCommand('fix', contextManager, chatViewProvider);
    })
  );

  // Refactor Code command
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCopilot.refactorCode', async () => {
      await executeCodeCommand('refactor', contextManager, chatViewProvider);
    })
  );

  // Generate Docs command
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCopilot.generateDocs', async () => {
      await executeCodeCommand('doc', contextManager, chatViewProvider);
    })
  );

  // Generate Tests command
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCopilot.generateTests', async () => {
      await executeCodeCommand('tests', contextManager, chatViewProvider);
    })
  );

  // Switch Model command
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCopilot.switchModel', async () => {
      await modelManager.showModelSwitcher();
    })
  );

  // Clear Chat command
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCopilot.clearChat', () => {
      chatViewProvider.clearChat();
    })
  );

  // Toggle Completion command
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeCopilot.toggleCompletion', async () => {
      const config = configManager.getConfig();
      await configManager.setCompletionEnabled(!config.completion.enable);
      vscode.window.showInformationMessage(
        `Claude Copilot: Code completion ${!config.completion.enable ? 'enabled' : 'disabled'}`
      );
    })
  );
}

async function executeCodeCommand(
  command: string,
  contextManager: ContextManager,
  chatViewProvider: ChatViewProvider
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor');
    return;
  }

  if (editor.selection.isEmpty) {
    vscode.window.showWarningMessage('Please select some code first');
    return;
  }

  const context = await contextManager.getSelectionContext(editor);

  // Focus chat view and send command
  await vscode.commands.executeCommand('claudeCopilot.chatView.focus');
  await chatViewProvider.sendCodeCommand(command, context);
}
