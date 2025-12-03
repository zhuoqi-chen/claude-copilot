import * as vscode from 'vscode';
import { ApiClient, ConfigManager, ContextManager } from '../services';

interface CacheEntry {
  completion: string;
  timestamp: number;
  prefix: string;
}

export class CompletionProvider implements vscode.InlineCompletionItemProvider {
  private apiClient: ApiClient;
  private contextManager: ContextManager;
  private configManager: ConfigManager;
  private outputChannel: vscode.OutputChannel;

  // Cache for completions
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 30000; // 30 seconds
  private readonly MAX_CACHE_SIZE = 50;

  // Request management
  private lastRequestTime = 0;

  constructor(
    apiClient: ApiClient,
    contextManager: ContextManager,
    configManager: ConfigManager
  ) {
    this.apiClient = apiClient;
    this.contextManager = contextManager;
    this.configManager = configManager;
    this.outputChannel = vscode.window.createOutputChannel('Claude Copilot');
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
  }

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | undefined> {
    const config = this.configManager.getConfig();

    this.log(`Triggered at ${position.line}:${position.character}`);

    // Basic checks
    if (!config.completion.enable) {
      this.log('Completion disabled');
      return undefined;
    }

    if (!this.apiClient.isConfigured()) {
      this.log('API not configured');
      return undefined;
    }

    // Get current line context
    const lineText = document.lineAt(position).text;
    const linePrefix = lineText.substring(0, position.character);

    // Only skip truly empty lines
    if (linePrefix.trim().length === 0) {
      this.log('Empty line, skipping');
      return undefined;
    }

    // Check if cancelled
    if (token.isCancellationRequested) {
      this.log('Cancelled before start');
      return undefined;
    }

    // Debounce
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < config.completion.delay) {
      await this.delay(config.completion.delay - timeSinceLastRequest);
    }

    if (token.isCancellationRequested) {
      this.log('Cancelled after delay');
      return undefined;
    }

    this.lastRequestTime = Date.now();

    try {
      this.log(`Requesting completion for: "${linePrefix.slice(-40)}"`);

      const completionContext = await this.contextManager.getCompletionContext(document, position);

      this.log(`Context prefix length: ${completionContext.prefix.length}`);

      const result = await this.apiClient.getCompletion(completionContext);

      if (token.isCancellationRequested) {
        this.log('Cancelled after API call');
        return undefined;
      }

      if (!result.text || result.text.trim().length === 0) {
        this.log('Empty result from API');
        return undefined;
      }

      this.log(`Got completion (${result.text.length} chars): "${result.text.substring(0, 60)}..."`);

      const completionItem = new vscode.InlineCompletionItem(
        result.text,
        new vscode.Range(position, position)
      );

      return [completionItem];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`Error: ${errorMessage}`);
      console.error('Completion error:', error);
      return undefined;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public dispose(): void {
    this.outputChannel.dispose();
    this.cache.clear();
  }
}

export function registerCompletionProvider(
  apiClient: ApiClient,
  contextManager: ContextManager,
  configManager: ConfigManager
): vscode.Disposable {
  const provider = new CompletionProvider(apiClient, contextManager, configManager);

  const disposable = vscode.languages.registerInlineCompletionItemProvider(
    { pattern: '**' },
    provider
  );

  return {
    dispose: () => {
      disposable.dispose();
      provider.dispose();
    }
  };
}
