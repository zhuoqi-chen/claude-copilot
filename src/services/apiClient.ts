import Anthropic from '@anthropic-ai/sdk';
import * as vscode from 'vscode';
import {
  ChatMessage,
  ChatResponse,
  CompletionContext,
  CompletionResult,
  StreamCallback,
  TokenUsage,
} from '../types';
import { ConfigManager } from './configManager';

export class ApiClient {
  private client: Anthropic | null = null;
  private configManager: ConfigManager;
  private totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.initClient();

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration('claudeCopilot.apiKey') ||
        e.affectsConfiguration('claudeCopilot.baseUrl')
      ) {
        this.initClient();
      }
    });
  }

  private initClient(): void {
    const config = this.configManager.getConfig();
    if (config.apiKey) {
      this.client = new Anthropic({
        apiKey: config.apiKey,
        baseURL: config.baseUrl || undefined,
      });
    } else {
      this.client = null;
    }
  }

  public isConfigured(): boolean {
    return this.client !== null;
  }

  public getTotalUsage(): TokenUsage {
    return { ...this.totalUsage };
  }

  public resetUsage(): void {
    this.totalUsage = { inputTokens: 0, outputTokens: 0 };
  }

  private updateUsage(usage: TokenUsage): void {
    this.totalUsage.inputTokens += usage.inputTokens;
    this.totalUsage.outputTokens += usage.outputTokens;
  }

  public async getCompletion(context: CompletionContext): Promise<CompletionResult> {
    if (!this.client) {
      throw new Error('API client not configured. Please set your API key.');
    }

    const config = this.configManager.getConfig();

    // Build optimized FIM prompt
    const { prompt, systemPrompt } = this.buildFIMPrompt(context);

    try {
      const response = await this.client.messages.create({
        model: config.model.completion,
        max_tokens: config.completion.maxTokens,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
        system: systemPrompt,
      });

      const usage: TokenUsage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
      this.updateUsage(usage);

      const textContent = response.content.find((block) => block.type === 'text');
      const text = textContent && 'text' in textContent ? textContent.text : '';

      return {
        text: this.cleanCompletionResponse(text, context),
        stopReason: response.stop_reason || 'unknown',
        usage,
      };
    } catch (error) {
      console.error('Completion error:', error);
      throw error;
    }
  }

  public async sendChatMessage(
    messages: ChatMessage[],
    systemPrompt?: string
  ): Promise<ChatResponse> {
    if (!this.client) {
      throw new Error('API client not configured. Please set your API key.');
    }

    const config = this.configManager.getConfig();

    try {
      const response = await this.client.messages.create({
        model: config.model.chat,
        max_tokens: config.chat.maxTokens,
        temperature: config.chat.temperature,
        system: systemPrompt || this.getChatSystemPrompt(),
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      });

      const usage: TokenUsage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
      this.updateUsage(usage);

      const textContent = response.content.find((block) => block.type === 'text');
      const content = textContent && 'text' in textContent ? textContent.text : '';

      return {
        content,
        stopReason: response.stop_reason || 'unknown',
        usage,
      };
    } catch (error) {
      console.error('Chat error:', error);
      throw error;
    }
  }

  public async streamChatMessage(
    messages: ChatMessage[],
    callback: StreamCallback,
    systemPrompt?: string
  ): Promise<void> {
    if (!this.client) {
      callback.onError(new Error('API client not configured. Please set your API key.'));
      return;
    }

    const config = this.configManager.getConfig();

    try {
      const stream = await this.client.messages.stream({
        model: config.model.chat,
        max_tokens: config.chat.maxTokens,
        temperature: config.chat.temperature,
        system: systemPrompt || this.getChatSystemPrompt(),
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      });

      let fullContent = '';

      stream.on('text', (text) => {
        fullContent += text;
        callback.onToken(text);
      });

      stream.on('message', (message) => {
        const usage: TokenUsage = {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
        };
        this.updateUsage(usage);

        callback.onComplete({
          content: fullContent,
          stopReason: message.stop_reason || 'unknown',
          usage,
        });
      });

      stream.on('error', (error) => {
        callback.onError(error);
      });
    } catch (error) {
      callback.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Build simple completion prompt
   */
  private buildFIMPrompt(context: CompletionContext): { prompt: string; systemPrompt: string } {
    // Limit context size for speed
    const maxPrefixChars = 2000;
    const maxSuffixChars = 500;

    const trimmedPrefix = context.prefix.slice(-maxPrefixChars);
    const trimmedSuffix = context.suffix.slice(0, maxSuffixChars);

    const systemPrompt = `You are a code completion assistant for ${context.language}. Output ONLY the code that should be inserted at the cursor position. No explanations, no markdown.`;

    const prompt = `Complete this ${context.language} code. Output only the completion, nothing else.

${trimmedPrefix}[CURSOR]${trimmedSuffix}

Code to insert at [CURSOR]:`;

    return { prompt, systemPrompt };
  }

  private cleanCompletionResponse(response: string, context: CompletionContext): string {
    let cleaned = response.trim();

    // Remove markdown code blocks
    if (cleaned.startsWith('```')) {
      const lines = cleaned.split('\n');
      lines.shift();
      if (lines[lines.length - 1]?.trim().startsWith('```')) {
        lines.pop();
      }
      cleaned = lines.join('\n');
    }

    // Remove unwanted patterns
    cleaned = cleaned
      .replace(/^\[CURSOR\]/g, '')
      .replace(/^(Here|The|Output|Complete).*?:/i, '')
      .trim();

    return cleaned;
  }

  private getChatSystemPrompt(): string {
    return `You are Claude Copilot, an intelligent coding assistant integrated into VS Code.
Your capabilities:
1. Explain code clearly and concisely
2. Fix bugs and suggest improvements
3. Refactor code for better readability and performance
4. Generate documentation and tests
5. Answer programming questions

Guidelines:
- Provide code in markdown code blocks with language specification
- Be concise but thorough
- Consider best practices and design patterns
- If you need more context, ask the user`;
  }
}
