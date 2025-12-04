import * as vscode from 'vscode';
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js/lib/core';
// Import only common languages to reduce bundle size
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import csharp from 'highlight.js/lib/languages/csharp';
import cpp from 'highlight.js/lib/languages/cpp';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import sql from 'highlight.js/lib/languages/sql';
import bash from 'highlight.js/lib/languages/bash';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';

import { ApiClient, ConfigManager, ContextManager, ChatSessionManager, ModelManager } from '../services';
import { ChatMessage } from '../types';

// Register languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('java', java);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('cs', csharp);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('c', cpp);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'claudeCopilot.chatView';

  private view?: vscode.WebviewView;
  private apiClient: ApiClient;
  private contextManager: ContextManager;
  private configManager: ConfigManager;
  private sessionManager: ChatSessionManager;
  private modelManager: ModelManager;
  private extensionUri: vscode.Uri;
  private marked: Marked;

  constructor(
    extensionUri: vscode.Uri,
    apiClient: ApiClient,
    contextManager: ContextManager,
    configManager: ConfigManager,
    sessionManager: ChatSessionManager,
    modelManager: ModelManager
  ) {
    this.extensionUri = extensionUri;
    this.apiClient = apiClient;
    this.contextManager = contextManager;
    this.configManager = configManager;
    this.sessionManager = sessionManager;
    this.modelManager = modelManager;

    // Initialize marked with highlight.js
    this.marked = new Marked(
      markedHighlight({
        langPrefix: 'hljs language-',
        highlight(code, lang) {
          const language = hljs.getLanguage(lang) ? lang : 'plaintext';
          return hljs.highlight(code, { language }).value;
        }
      })
    );

    // Configure marked options
    this.marked.setOptions({
      gfm: true,
      breaks: true,
    });
  }

  private renderMarkdown(content: string): string {
    try {
      // Add copy/insert buttons to code blocks
      let html = this.marked.parse(content) as string;

      // Wrap code blocks with action buttons
      html = html.replace(
        /<pre><code class="hljs language-(\w+)">([\s\S]*?)<\/code><\/pre>/g,
        (_, lang, code) => {
          const decodedCode = this.decodeHtmlEntities(code);
          const encodedCode = encodeURIComponent(decodedCode);
          return `
            <div class="code-block-wrapper">
              <div class="code-block-header">
                <span class="code-lang">${lang}</span>
                <div class="code-actions">
                  <button onclick="copyCode('${encodedCode}')">Copy</button>
                  <button onclick="insertCode('${encodedCode}')">Insert</button>
                </div>
              </div>
              <pre><code class="hljs language-${lang}">${code}</code></pre>
            </div>`;
        }
      );

      // Handle code blocks without language
      html = html.replace(
        /<pre><code class="hljs">([\s\S]*?)<\/code><\/pre>/g,
        (_, code) => {
          const decodedCode = this.decodeHtmlEntities(code);
          const encodedCode = encodeURIComponent(decodedCode);
          return `
            <div class="code-block-wrapper">
              <div class="code-block-header">
                <span class="code-lang">code</span>
                <div class="code-actions">
                  <button onclick="copyCode('${encodedCode}')">Copy</button>
                  <button onclick="insertCode('${encodedCode}')">Insert</button>
                </div>
              </div>
              <pre><code class="hljs">${code}</code></pre>
            </div>`;
        }
      );

      return html;
    } catch {
      return content;
    }
  }

  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'ready':
          // Webview is ready, restore session
          await this.restoreSession();
          break;
        case 'sendMessage':
          await this.handleUserMessage(data.message);
          break;
        case 'clearChat':
          await this.clearChat();
          break;
        case 'newSession':
          await this.createNewSession();
          break;
        case 'switchSession':
          await this.switchSession(data.sessionId);
          break;
        case 'deleteSession':
          await this.deleteSession(data.sessionId);
          break;
        case 'getSessions':
          this.sendSessionsList();
          break;
        case 'copyCode':
          await vscode.env.clipboard.writeText(data.code);
          vscode.window.showInformationMessage('Code copied to clipboard');
          break;
        case 'insertCode':
          await this.insertCodeToEditor(data.code);
          break;
        case 'addContext':
          await this.addSelectionContext();
          break;
        case 'switchModel':
          await this.handleSwitchModel();
          break;
        case 'getModelInfo':
          this.sendModelInfo();
          break;
      }
    });

    // Listen for config changes to update model info
    this.configManager.onConfigChange(() => {
      this.sendModelInfo();
    });
  }

  private sendModelInfo(): void {
    if (!this.view) return;

    const chatModel = this.modelManager.getCurrentModel('chat');
    const shortName = this.modelManager.getShortModelName(chatModel);

    this.view.webview.postMessage({
      type: 'modelInfo',
      model: shortName,
      fullModel: chatModel,
    });
  }

  private async handleSwitchModel(): Promise<void> {
    await this.modelManager.switchModel('chat');
    this.sendModelInfo();
  }

  private async restoreSession(): Promise<void> {
    if (!this.view) return;

    const session = await this.sessionManager.getOrCreateCurrentSession();
    const sessions = this.sessionManager.getAllSessions();

    // Send current session data
    const renderedMessages = session.messages.map(msg => ({
      ...msg,
      html: msg.role === 'assistant' ? this.renderMarkdown(msg.content) : undefined,
    }));

    this.view.webview.postMessage({
      type: 'restoreSession',
      session: {
        id: session.id,
        title: session.title,
        messages: renderedMessages,
      },
      sessions: sessions.map(s => ({
        id: s.id,
        title: s.title,
        updatedAt: s.updatedAt,
        messageCount: s.messages.length,
      })),
    });

    // Also send model info
    this.sendModelInfo();
  }

  private sendSessionsList(): void {
    if (!this.view) return;

    const sessions = this.sessionManager.getAllSessions();
    const currentSession = this.sessionManager.getCurrentSession();

    this.view.webview.postMessage({
      type: 'sessionsList',
      currentSessionId: currentSession?.id,
      sessions: sessions.map(s => ({
        id: s.id,
        title: s.title,
        updatedAt: s.updatedAt,
        messageCount: s.messages.length,
      })),
    });
  }

  private async createNewSession(): Promise<void> {
    if (!this.view) return;

    await this.sessionManager.createNewSession();
    await this.restoreSession();
  }

  private async switchSession(sessionId: string): Promise<void> {
    if (!this.view) return;

    await this.sessionManager.switchSession(sessionId);
    await this.restoreSession();
  }

  private async deleteSession(sessionId: string): Promise<void> {
    if (!this.view) return;

    await this.sessionManager.deleteSession(sessionId);
    await this.restoreSession();
  }

  private async handleUserMessage(message: string): Promise<void> {
    if (!this.view) return;

    // Check API configuration
    if (!this.apiClient.isConfigured()) {
      this.view.webview.postMessage({
        type: 'error',
        message: 'Please configure your API key in settings.',
      });
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };
    await this.sessionManager.addMessage(userMessage);
    this.view.webview.postMessage({ type: 'userMessage', message: userMessage });

    const config = this.configManager.getConfig();
    const messages = this.sessionManager.getCurrentMessages();

    try {
      if (config.chat.streamResponse) {
        // Stream response
        this.view.webview.postMessage({ type: 'startAssistantMessage' });

        let fullContent = '';

        // Add placeholder assistant message
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
        };
        await this.sessionManager.addMessage(assistantMessage);

        await this.apiClient.streamChatMessage(messages, {
          onToken: (token) => {
            fullContent += token;
            // Render markdown and send full HTML each time
            const html = this.renderMarkdown(fullContent);
            this.view?.webview.postMessage({ type: 'streamUpdate', html });
          },
          onComplete: async (response) => {
            // Update the assistant message with final content
            await this.sessionManager.updateLastAssistantMessage(fullContent);

            // Send final rendered HTML
            const html = this.renderMarkdown(fullContent);
            this.view?.webview.postMessage({
              type: 'endAssistantMessage',
              html,
              usage: response.usage,
            });

            // Update sessions list (title may have changed)
            this.sendSessionsList();
          },
          onError: (error) => {
            this.view?.webview.postMessage({
              type: 'error',
              message: error.message,
            });
          },
        });
      } else {
        // Non-streaming response
        this.view.webview.postMessage({ type: 'loading', isLoading: true });
        const response = await this.apiClient.sendChatMessage(messages);

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: response.content,
          timestamp: Date.now(),
        };
        await this.sessionManager.addMessage(assistantMessage);

        // Render markdown
        const html = this.renderMarkdown(response.content);
        this.view.webview.postMessage({
          type: 'assistantMessage',
          message: assistantMessage,
          html,
          usage: response.usage,
        });
        this.view.webview.postMessage({ type: 'loading', isLoading: false });

        // Update sessions list
        this.sendSessionsList();
      }
    } catch (error) {
      this.view.webview.postMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      this.view.webview.postMessage({ type: 'loading', isLoading: false });
    }
  }

  public async clearChat(): Promise<void> {
    await this.sessionManager.clearCurrentSession();
    this.view?.webview.postMessage({ type: 'clearChat' });
    this.sendSessionsList();
  }

  private async insertCodeToEditor(code: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      await editor.edit((editBuilder) => {
        editBuilder.insert(editor.selection.active, code);
      });
    } else {
      vscode.window.showWarningMessage('No active editor to insert code');
    }
  }

  private async addSelectionContext(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (editor && !editor.selection.isEmpty) {
      const context = await this.contextManager.getSelectionContext(editor);
      this.view?.webview.postMessage({ type: 'addContext', context });
    } else {
      vscode.window.showWarningMessage('Please select some code first');
    }
  }

  public async sendCodeCommand(command: string, code: string): Promise<void> {
    if (!this.view) return;

    const prompts: Record<string, string> = {
      explain: `Please explain the following code:\n\n${code}`,
      fix: `Please fix any issues in the following code:\n\n${code}`,
      refactor: `Please refactor the following code for better readability and performance:\n\n${code}`,
      optimize: `Please optimize the following code:\n\n${code}`,
      doc: `Please generate documentation comments for the following code:\n\n${code}`,
      tests: `Please generate unit tests for the following code:\n\n${code}`,
      review: `Please review the following code and provide suggestions:\n\n${code}`,
    };

    const message = prompts[command] || `${command}:\n\n${code}`;
    await this.handleUserMessage(message);
  }

  private getHtmlContent(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>Claude Copilot Chat</title>
  <style>
    :root {
      --vscode-font-family: var(--vscode-editor-font-family, 'Segoe UI', sans-serif);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: 13px;
      color: var(--vscode-foreground);
      background-color: var(--vscode-sideBar-background);
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Session Header */
    .session-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background-color: var(--vscode-editor-background);
    }

    .session-title {
      font-weight: 500;
      font-size: 12px;
      color: var(--vscode-foreground);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }

    .session-actions {
      display: flex;
      gap: 4px;
    }

    .session-btn {
      padding: 4px 8px;
      font-size: 11px;
      background: transparent;
      color: var(--vscode-foreground);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 3px;
      cursor: pointer;
    }

    .session-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
    }

    /* Sessions Panel */
    .sessions-panel {
      display: none;
      position: absolute;
      top: 40px;
      left: 0;
      right: 0;
      max-height: 300px;
      overflow-y: auto;
      background-color: var(--vscode-editor-background);
      border-bottom: 1px solid var(--vscode-panel-border);
      z-index: 100;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .sessions-panel.show {
      display: block;
    }

    .session-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      cursor: pointer;
    }

    .session-item:hover {
      background-color: var(--vscode-list-hoverBackground);
    }

    .session-item.active {
      background-color: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground);
    }

    .session-info {
      flex: 1;
      overflow: hidden;
    }

    .session-item-title {
      font-size: 12px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .session-meta {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      margin-top: 2px;
    }

    .session-delete {
      padding: 2px 6px;
      font-size: 10px;
      background: transparent;
      color: var(--vscode-errorForeground);
      border: none;
      border-radius: 3px;
      cursor: pointer;
      opacity: 0;
    }

    .session-item:hover .session-delete {
      opacity: 1;
    }

    .session-delete:hover {
      background: var(--vscode-inputValidation-errorBackground);
    }

    .chat-container {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      position: relative;
    }

    .message {
      padding: 10px 14px;
      border-radius: 8px;
      max-width: 95%;
      line-height: 1.5;
    }

    .message.user {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }

    .message.assistant {
      background-color: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      align-self: flex-start;
      border-bottom-left-radius: 4px;
    }

    /* Markdown Styles */
    .message h1, .message h2, .message h3, .message h4, .message h5, .message h6 {
      margin: 16px 0 8px 0;
      font-weight: 600;
      line-height: 1.3;
    }
    .message h1 { font-size: 1.4em; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 4px; }
    .message h2 { font-size: 1.25em; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 4px; }
    .message h3 { font-size: 1.1em; }
    .message h4 { font-size: 1em; }

    .message p { margin: 8px 0; line-height: 1.6; }
    .message strong { font-weight: 600; }
    .message em { font-style: italic; }
    .message del { text-decoration: line-through; opacity: 0.7; }

    .message ul, .message ol { margin: 8px 0; padding-left: 24px; }
    .message li { margin: 4px 0; line-height: 1.5; }
    .message ul { list-style-type: disc; }
    .message ol { list-style-type: decimal; }

    .message blockquote {
      margin: 8px 0;
      padding: 8px 12px;
      border-left: 3px solid var(--vscode-textBlockQuote-border, var(--vscode-button-background));
      background-color: var(--vscode-textBlockQuote-background);
      color: var(--vscode-textBlockQuote-foreground);
    }
    .message blockquote p { margin: 0; }

    .message hr {
      margin: 16px 0;
      border: none;
      border-top: 1px solid var(--vscode-panel-border);
    }

    .message a {
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
    }
    .message a:hover { text-decoration: underline; }

    .message table {
      border-collapse: collapse;
      margin: 8px 0;
      width: 100%;
    }
    .message th, .message td {
      border: 1px solid var(--vscode-panel-border);
      padding: 6px 10px;
      text-align: left;
    }
    .message th {
      background-color: var(--vscode-editor-background);
      font-weight: 600;
    }

    .message code {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
      background-color: var(--vscode-textCodeBlock-background);
      padding: 2px 4px;
      border-radius: 3px;
    }

    .message pre {
      background-color: var(--vscode-textCodeBlock-background);
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 0;
    }

    .message pre code {
      background: none;
      padding: 0;
      font-size: 12px;
      line-height: 1.5;
    }

    /* Code block wrapper */
    .code-block-wrapper {
      margin: 12px 0;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid var(--vscode-panel-border);
    }

    .code-block-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 12px;
      background-color: var(--vscode-editor-background);
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .code-lang {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
    }

    .code-actions {
      display: flex;
      gap: 6px;
    }

    .code-actions button {
      padding: 3px 10px;
      font-size: 11px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 3px;
      cursor: pointer;
    }

    .code-actions button:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .code-block-wrapper pre {
      margin: 0;
      border-radius: 0;
      border: none;
    }

    /* Highlight.js Theme - VSCode Dark+ inspired */
    .hljs { color: var(--vscode-editor-foreground, #d4d4d4); }
    .hljs-keyword { color: #569cd6; }
    .hljs-built_in { color: #4ec9b0; }
    .hljs-type { color: #4ec9b0; }
    .hljs-literal { color: #569cd6; }
    .hljs-number { color: #b5cea8; }
    .hljs-string { color: #ce9178; }
    .hljs-regexp { color: #d16969; }
    .hljs-symbol { color: #b5cea8; }
    .hljs-comment { color: #6a9955; font-style: italic; }
    .hljs-function { color: #dcdcaa; }
    .hljs-class { color: #4ec9b0; }
    .hljs-params { color: #9cdcfe; }
    .hljs-attr { color: #9cdcfe; }
    .hljs-attribute { color: #9cdcfe; }
    .hljs-variable { color: #9cdcfe; }
    .hljs-property { color: #9cdcfe; }
    .hljs-title { color: #dcdcaa; }
    .hljs-title.function_ { color: #dcdcaa; }
    .hljs-title.class_ { color: #4ec9b0; }
    .hljs-meta { color: #c586c0; }
    .hljs-meta-keyword { color: #569cd6; }
    .hljs-meta-string { color: #ce9178; }
    .hljs-tag { color: #569cd6; }
    .hljs-name { color: #569cd6; }
    .hljs-selector-tag { color: #d7ba7d; }
    .hljs-selector-id { color: #d7ba7d; }
    .hljs-selector-class { color: #d7ba7d; }
    .hljs-doctag { color: #608b4e; }
    .hljs-strong { font-weight: bold; }
    .hljs-emphasis { font-style: italic; }
    .hljs-addition { color: #b5cea8; background-color: rgba(155, 185, 85, 0.2); }
    .hljs-deletion { color: #ce9178; background-color: rgba(206, 145, 120, 0.2); }

    /* Input area */
    .input-container {
      padding: 12px;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .input-row {
      display: flex;
      gap: 8px;
    }

    #messageInput {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid var(--vscode-input-border);
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 4px;
      font-family: inherit;
      font-size: 13px;
      resize: none;
      min-height: 36px;
      max-height: 120px;
    }

    #messageInput:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }

    .send-button {
      padding: 8px 16px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }

    .send-button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    .send-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .toolbar {
      display: flex;
      gap: 4px;
    }

    .toolbar button {
      padding: 4px 8px;
      font-size: 11px;
      background: transparent;
      color: var(--vscode-foreground);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 3px;
      cursor: pointer;
    }

    .toolbar button:hover {
      background: var(--vscode-toolbar-hoverBackground);
    }

    .loading {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px;
      color: var(--vscode-descriptionForeground);
    }

    .loading-dots {
      display: flex;
      gap: 4px;
    }

    .loading-dots span {
      width: 6px;
      height: 6px;
      background-color: var(--vscode-button-background);
      border-radius: 50%;
      animation: bounce 1.4s infinite ease-in-out both;
    }

    .loading-dots span:nth-child(1) { animation-delay: -0.32s; }
    .loading-dots span:nth-child(2) { animation-delay: -0.16s; }

    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }

    .error {
      color: var(--vscode-errorForeground);
      background-color: var(--vscode-inputValidation-errorBackground);
      padding: 8px 12px;
      border-radius: 4px;
      border: 1px solid var(--vscode-inputValidation-errorBorder);
    }

    .welcome {
      text-align: center;
      padding: 40px 20px;
      color: var(--vscode-descriptionForeground);
    }

    .welcome h2 {
      margin-bottom: 12px;
      color: var(--vscode-foreground);
    }

    .welcome p {
      margin-bottom: 8px;
    }

    .usage {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      text-align: right;
      padding: 4px 0;
    }
  </style>
</head>
<body>
  <div class="session-header">
    <span class="session-title" id="sessionTitle">New Chat</span>
    <div class="session-actions">
      <button class="session-btn" onclick="toggleSessions()" title="Session History">History</button>
      <button class="session-btn" onclick="newSession()" title="New Chat">+ New</button>
    </div>
  </div>

  <div class="sessions-panel" id="sessionsPanel">
    <div id="sessionsList"></div>
  </div>

  <div class="chat-container" id="chatContainer">
    <div class="welcome">
      <h2>Claude Copilot</h2>
      <p>Ask me anything about your code!</p>
      <p>Use commands like /explain, /fix, /refactor in your message.</p>
    </div>
  </div>

  <div class="input-container">
    <div class="toolbar">
      <button onclick="switchModel()" title="Click to switch model" id="modelButton">Model: ...</button>
      <button onclick="addContext()" title="Add selected code as context">+ Selection</button>
      <button onclick="clearChat()" title="Clear current chat">Clear</button>
    </div>
    <div class="input-row">
      <textarea
        id="messageInput"
        placeholder="Ask Claude..."
        rows="1"
        onkeydown="handleKeyDown(event)"
        oninput="autoResize(this)"
      ></textarea>
      <button class="send-button" id="sendButton" onclick="sendMessage()">Send</button>
    </div>
    <div class="usage" id="usage"></div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const chatContainer = document.getElementById('chatContainer');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const usageDisplay = document.getElementById('usage');
    const sessionTitle = document.getElementById('sessionTitle');
    const sessionsPanel = document.getElementById('sessionsPanel');
    const sessionsList = document.getElementById('sessionsList');
    const modelButton = document.getElementById('modelButton');

    let isLoading = false;
    let currentStreamElement = null;
    let currentSessionId = null;
    let sessions = [];

    // Notify extension that webview is ready
    vscode.postMessage({ type: 'ready' });

    function switchModel() {
      vscode.postMessage({ type: 'switchModel' });
    }

    function updateModelInfo(data) {
      if (data.model) {
        modelButton.textContent = 'Model: ' + data.model;
        modelButton.title = data.fullModel || data.model;
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    }

    function autoResize(textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    function sendMessage() {
      const message = messageInput.value.trim();
      if (!message || isLoading) return;

      vscode.postMessage({ type: 'sendMessage', message });
      messageInput.value = '';
      messageInput.style.height = 'auto';
    }

    function clearChat() {
      vscode.postMessage({ type: 'clearChat' });
    }

    function newSession() {
      vscode.postMessage({ type: 'newSession' });
      hideSessions();
    }

    function toggleSessions() {
      if (sessionsPanel.classList.contains('show')) {
        hideSessions();
      } else {
        showSessions();
      }
    }

    function showSessions() {
      vscode.postMessage({ type: 'getSessions' });
      sessionsPanel.classList.add('show');
    }

    function hideSessions() {
      sessionsPanel.classList.remove('show');
    }

    function switchSession(sessionId) {
      vscode.postMessage({ type: 'switchSession', sessionId });
      hideSessions();
    }

    function deleteSession(sessionId, event) {
      event.stopPropagation();
      if (confirm('Delete this chat session?')) {
        vscode.postMessage({ type: 'deleteSession', sessionId });
      }
    }

    function renderSessionsList(sessionsData, currentId) {
      sessionsList.innerHTML = sessionsData.map(s => {
        const date = new Date(s.updatedAt);
        const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isActive = s.id === currentId;
        return \`
          <div class="session-item \${isActive ? 'active' : ''}" onclick="switchSession('\${s.id}')">
            <div class="session-info">
              <div class="session-item-title">\${escapeHtml(s.title)}</div>
              <div class="session-meta">\${s.messageCount} messages · \${timeStr}</div>
            </div>
            <button class="session-delete" onclick="deleteSession('\${s.id}', event)">Delete</button>
          </div>
        \`;
      }).join('');
    }

    function addContext() {
      vscode.postMessage({ type: 'addContext' });
    }

    function copyCode(encodedCode) {
      const code = decodeURIComponent(encodedCode);
      vscode.postMessage({ type: 'copyCode', code });
    }

    function insertCode(encodedCode) {
      const code = decodeURIComponent(encodedCode);
      vscode.postMessage({ type: 'insertCode', code });
    }

    function setLoading(loading) {
      isLoading = loading;
      sendButton.disabled = loading;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function clearMessages() {
      chatContainer.innerHTML = '<div class="welcome"><h2>Claude Copilot</h2><p>Ask me anything about your code!</p></div>';
    }

    function removeWelcome() {
      const welcome = chatContainer.querySelector('.welcome');
      if (welcome) welcome.remove();
    }

    function addUserMessage(content) {
      removeWelcome();
      const div = document.createElement('div');
      div.className = 'message user';
      div.textContent = content;
      chatContainer.appendChild(div);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function addAssistantMessage(html) {
      removeWelcome();
      const div = document.createElement('div');
      div.className = 'message assistant';
      div.innerHTML = html;
      chatContainer.appendChild(div);
      chatContainer.scrollTop = chatContainer.scrollHeight;
      return div;
    }

    function showLoading() {
      removeWelcome();
      const div = document.createElement('div');
      div.className = 'loading';
      div.id = 'loadingIndicator';
      div.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div><span>Thinking...</span>';
      chatContainer.appendChild(div);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function hideLoading() {
      const loading = document.getElementById('loadingIndicator');
      if (loading) loading.remove();
    }

    function showError(message) {
      const div = document.createElement('div');
      div.className = 'error';
      div.textContent = message;
      chatContainer.appendChild(div);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function updateUsage(usage) {
      if (usage) {
        usageDisplay.textContent = 'Tokens: ' + usage.inputTokens + ' in / ' + usage.outputTokens + ' out';
      }
    }

    // Handle messages from extension
    window.addEventListener('message', event => {
      const data = event.data;

      switch (data.type) {
        case 'restoreSession':
          // Restore session
          currentSessionId = data.session.id;
          sessionTitle.textContent = data.session.title;
          sessions = data.sessions;

          // Clear and restore messages
          clearMessages();
          if (data.session.messages.length > 0) {
            removeWelcome();
            data.session.messages.forEach(msg => {
              if (msg.role === 'user') {
                addUserMessage(msg.content);
              } else {
                addAssistantMessage(msg.html || msg.content);
              }
            });
          }
          break;

        case 'modelInfo':
          updateModelInfo(data);
          break;

        case 'sessionsList':
          currentSessionId = data.currentSessionId;
          sessions = data.sessions;
          renderSessionsList(sessions, currentSessionId);
          // Update title
          const current = sessions.find(s => s.id === currentSessionId);
          if (current) {
            sessionTitle.textContent = current.title;
          }
          break;

        case 'userMessage':
          addUserMessage(data.message.content);
          break;

        case 'assistantMessage':
          addAssistantMessage(data.html);
          updateUsage(data.usage);
          setLoading(false);
          break;

        case 'startAssistantMessage':
          removeWelcome();
          currentStreamElement = document.createElement('div');
          currentStreamElement.className = 'message assistant';
          chatContainer.appendChild(currentStreamElement);
          setLoading(true);
          break;

        case 'streamUpdate':
          if (currentStreamElement) {
            currentStreamElement.innerHTML = data.html;
            chatContainer.scrollTop = chatContainer.scrollHeight;
          }
          break;

        case 'endAssistantMessage':
          if (currentStreamElement) {
            currentStreamElement.innerHTML = data.html;
          }
          currentStreamElement = null;
          updateUsage(data.usage);
          setLoading(false);
          break;

        case 'loading':
          if (data.isLoading) {
            showLoading();
          } else {
            hideLoading();
          }
          setLoading(data.isLoading);
          break;

        case 'error':
          hideLoading();
          showError(data.message);
          setLoading(false);
          break;

        case 'clearChat':
          clearMessages();
          usageDisplay.textContent = '';
          break;

        case 'addContext':
          messageInput.value = data.context + '\\n\\n' + messageInput.value;
          autoResize(messageInput);
          messageInput.focus();
          break;
      }
    });

    // Close sessions panel when clicking outside
    document.addEventListener('click', (e) => {
      if (!sessionsPanel.contains(e.target) && !e.target.closest('.session-btn')) {
        hideSessions();
      }
    });
  </script>
</body>
</html>`;
  }
}
