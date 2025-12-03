import * as vscode from 'vscode';
import { ClaudeConfig } from '../types';

export class ConfigManager {
  private static instance: ConfigManager;

  private constructor() {}

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  public getConfig(): ClaudeConfig {
    const config = vscode.workspace.getConfiguration('claudeCopilot');

    return {
      apiKey: config.get<string>('apiKey', ''),
      baseUrl: config.get<string>('baseUrl', 'https://api.anthropic.com'),
      model: {
        completion: config.get<string>('model.completion', 'claude-3-5-haiku-20241022'),
        chat: config.get<string>('model.chat', 'claude-sonnet-4-20250514'),
      },
      completion: {
        enable: config.get<boolean>('completion.enable', true),
        delay: config.get<number>('completion.delay', 150),
        maxTokens: config.get<number>('completion.maxTokens', 150),
      },
      chat: {
        maxTokens: config.get<number>('chat.maxTokens', 4096),
        temperature: config.get<number>('chat.temperature', 0.7),
        streamResponse: config.get<boolean>('chat.streamResponse', true),
      },
      context: {
        maxFiles: config.get<number>('context.maxFiles', 10),
        includeImports: config.get<boolean>('context.includeImports', true),
      },
      privacy: {
        excludePatterns: config.get<string[]>('privacy.excludePatterns', [
          '**/.env*',
          '**/secrets/**',
        ]),
      },
      ui: {
        showTokenUsage: config.get<boolean>('ui.showTokenUsage', true),
        showModelInStatusBar: config.get<boolean>('ui.showModelInStatusBar', true),
      },
    };
  }

  public async setApiKey(apiKey: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('claudeCopilot');
    await config.update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
  }

  public async setModel(type: 'completion' | 'chat', model: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('claudeCopilot');
    await config.update(`model.${type}`, model, vscode.ConfigurationTarget.Global);
  }

  public async setCompletionEnabled(enabled: boolean): Promise<void> {
    const config = vscode.workspace.getConfiguration('claudeCopilot');
    await config.update('completion.enable', enabled, vscode.ConfigurationTarget.Global);
  }

  public isApiKeyConfigured(): boolean {
    return this.getConfig().apiKey.length > 0;
  }

  public onConfigChange(callback: (e: vscode.ConfigurationChangeEvent) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('claudeCopilot')) {
        callback(e);
      }
    });
  }
}
