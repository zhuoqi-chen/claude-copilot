import * as vscode from 'vscode';
import { ConfigManager } from './configManager';
import { SUPPORTED_MODELS, SupportedModel, ModelType } from '../types';

export class ModelManager {
  private configManager: ConfigManager;
  private statusBarItem: vscode.StatusBarItem;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = 'claudeCopilot.switchModel';
    this.updateStatusBar();

    // Listen for config changes
    configManager.onConfigChange(() => {
      this.updateStatusBar();
    });
  }

  public getCurrentModel(type: ModelType): string {
    const config = this.configManager.getConfig();
    return type === 'completion' ? config.model.completion : config.model.chat;
  }

  public getSupportedModels(): readonly string[] {
    return SUPPORTED_MODELS;
  }

  public async switchModel(type: ModelType): Promise<void> {
    const currentModel = this.getCurrentModel(type);
    const models = this.getSupportedModels();

    const selected = await vscode.window.showQuickPick(
      models.map((model) => ({
        label: model,
        description: model === currentModel ? '(current)' : '',
        picked: model === currentModel,
      })),
      {
        placeHolder: `Select ${type} model`,
        title: `Switch ${type} Model`,
      }
    );

    if (selected) {
      await this.configManager.setModel(type, selected.label);
      vscode.window.showInformationMessage(
        `Claude Copilot: ${type} model switched to ${selected.label}`
      );
    }
  }

  public async showModelSwitcher(): Promise<void> {
    const options = [
      { label: 'Completion Model', type: 'completion' as ModelType },
      { label: 'Chat Model', type: 'chat' as ModelType },
    ];

    const selected = await vscode.window.showQuickPick(options, {
      placeHolder: 'Which model do you want to switch?',
    });

    if (selected) {
      await this.switchModel(selected.type);
    }
  }

  private updateStatusBar(): void {
    const config = this.configManager.getConfig();
    if (config.ui.showModelInStatusBar) {
      const chatModel = this.getShortModelName(config.model.chat);
      this.statusBarItem.text = `$(hubot) ${chatModel}`;
      this.statusBarItem.tooltip = `Claude Copilot\nChat: ${config.model.chat}\nCompletion: ${config.model.completion}\nClick to switch model`;
      this.statusBarItem.show();
    } else {
      this.statusBarItem.hide();
    }
  }

  private getShortModelName(model: string): string {
    if (model.includes('haiku')) return 'Haiku';
    if (model.includes('sonnet')) return 'Sonnet';
    if (model.includes('opus')) return 'Opus';
    return model;
  }

  public dispose(): void {
    this.statusBarItem.dispose();
  }
}
