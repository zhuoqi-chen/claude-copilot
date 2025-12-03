export interface ClaudeConfig {
  apiKey: string;
  baseUrl: string;
  model: {
    completion: string;
    chat: string;
  };
  completion: {
    enable: boolean;
    delay: number;
    maxTokens: number;
  };
  chat: {
    maxTokens: number;
    temperature: number;
    streamResponse: boolean;
  };
  context: {
    maxFiles: number;
    includeImports: boolean;
  };
  privacy: {
    excludePatterns: string[];
  };
  ui: {
    showTokenUsage: boolean;
    showModelInStatusBar: boolean;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface CompletionContext {
  prefix: string;
  suffix: string;
  language: string;
  filename: string;
  relatedFiles?: FileContext[];
}

export interface FileContext {
  path: string;
  content: string;
  language: string;
}

export interface CompletionResult {
  text: string;
  stopReason: string;
  usage?: TokenUsage;
}

export interface ChatResponse {
  content: string;
  stopReason: string;
  usage?: TokenUsage;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface StreamCallback {
  onToken: (token: string) => void;
  onComplete: (response: ChatResponse) => void;
  onError: (error: Error) => void;
}

export type ModelType = 'completion' | 'chat';

export const SUPPORTED_MODELS = [
  'claude-3-5-haiku-20241022',
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
] as const;

export type SupportedModel = (typeof SUPPORTED_MODELS)[number];
