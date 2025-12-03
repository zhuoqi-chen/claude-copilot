import * as vscode from 'vscode';
import { ApiClient, ConfigManager, ContextManager } from '../services';
import { ChatMessage } from '../types';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'claudeCopilot.chatView';

  private view?: vscode.WebviewView;
  private messages: ChatMessage[] = [];
  private apiClient: ApiClient;
  private contextManager: ContextManager;
  private configManager: ConfigManager;
  private extensionUri: vscode.Uri;

  constructor(
    extensionUri: vscode.Uri,
    apiClient: ApiClient,
    contextManager: ContextManager,
    configManager: ConfigManager
  ) {
    this.extensionUri = extensionUri;
    this.apiClient = apiClient;
    this.contextManager = contextManager;
    this.configManager = configManager;
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
        case 'sendMessage':
          await this.handleUserMessage(data.message);
          break;
        case 'clearChat':
          this.clearChat();
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
      }
    });
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
    this.messages.push(userMessage);
    this.view.webview.postMessage({ type: 'userMessage', message: userMessage });

    const config = this.configManager.getConfig();

    try {
      if (config.chat.streamResponse) {
        // Stream response
        this.view.webview.postMessage({ type: 'startAssistantMessage' });

        let fullContent = '';
        await this.apiClient.streamChatMessage(this.messages, {
          onToken: (token) => {
            fullContent += token;
            this.view?.webview.postMessage({ type: 'streamToken', token });
          },
          onComplete: (response) => {
            const assistantMessage: ChatMessage = {
              role: 'assistant',
              content: fullContent,
              timestamp: Date.now(),
            };
            this.messages.push(assistantMessage);
            this.view?.webview.postMessage({
              type: 'endAssistantMessage',
              usage: response.usage,
            });
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
        const response = await this.apiClient.sendChatMessage(this.messages);

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: response.content,
          timestamp: Date.now(),
        };
        this.messages.push(assistantMessage);

        this.view.webview.postMessage({
          type: 'assistantMessage',
          message: assistantMessage,
          usage: response.usage,
        });
        this.view.webview.postMessage({ type: 'loading', isLoading: false });
      }
    } catch (error) {
      this.view.webview.postMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      this.view.webview.postMessage({ type: 'loading', isLoading: false });
    }
  }

  public clearChat(): void {
    this.messages = [];
    this.view?.webview.postMessage({ type: 'clearChat' });
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

    .chat-container {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
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

    .message pre {
      background-color: var(--vscode-textBlockQuote-background);
      padding: 10px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 8px 0;
      position: relative;
    }

    .message code {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
    }

    .code-actions {
      display: flex;
      gap: 4px;
      margin-top: 4px;
    }

    .code-actions button {
      padding: 2px 8px;
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
  <div class="chat-container" id="chatContainer">
    <div class="welcome">
      <h2>Claude Copilot</h2>
      <p>Ask me anything about your code!</p>
      <p>Use commands like /explain, /fix, /refactor in your message.</p>
    </div>
  </div>

  <div class="input-container">
    <div class="toolbar">
      <button onclick="addContext()" title="Add selected code as context">+ Selection</button>
      <button onclick="clearChat()" title="Clear chat history">Clear</button>
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

    let isLoading = false;
    let currentStreamElement = null;

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

    function addContext() {
      vscode.postMessage({ type: 'addContext' });
    }

    function copyCode(code) {
      vscode.postMessage({ type: 'copyCode', code });
    }

    function insertCode(code) {
      vscode.postMessage({ type: 'insertCode', code });
    }

    function setLoading(loading) {
      isLoading = loading;
      sendButton.disabled = loading;
    }

    function removeWelcome() {
      const welcome = chatContainer.querySelector('.welcome');
      if (welcome) welcome.remove();
    }

    function formatMessage(content) {
      // Simple markdown-like formatting
      let formatted = content
        .replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, (match, lang, code) => {
          const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return '<pre><code class="language-' + lang + '">' + escapedCode + '</code></pre>' +
            '<div class="code-actions">' +
            '<button onclick="copyCode(decodeURIComponent(\\'' + encodeURIComponent(code) + '\\'))">Copy</button>' +
            '<button onclick="insertCode(decodeURIComponent(\\'' + encodeURIComponent(code) + '\\'))">Insert</button>' +
            '</div>';
        })
        .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
        .replace(/\\n/g, '<br>');
      return formatted;
    }

    function addMessage(role, content) {
      removeWelcome();
      const div = document.createElement('div');
      div.className = 'message ' + role;
      div.innerHTML = formatMessage(content);
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
        case 'userMessage':
          addMessage('user', data.message.content);
          break;

        case 'assistantMessage':
          addMessage('assistant', data.message.content);
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

        case 'streamToken':
          if (currentStreamElement) {
            currentStreamElement.innerHTML = formatMessage(
              currentStreamElement.textContent + data.token
            );
            chatContainer.scrollTop = chatContainer.scrollHeight;
          }
          break;

        case 'endAssistantMessage':
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
          chatContainer.innerHTML = '<div class="welcome"><h2>Claude Copilot</h2><p>Ask me anything about your code!</p></div>';
          usageDisplay.textContent = '';
          break;

        case 'addContext':
          messageInput.value = data.context + '\\n\\n' + messageInput.value;
          autoResize(messageInput);
          messageInput.focus();
          break;
      }
    });
  </script>
</body>
</html>`;
  }
}
