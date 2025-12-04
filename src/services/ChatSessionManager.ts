import * as vscode from 'vscode';
import { ChatMessage } from '../types';

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface StorageData {
  currentSessionId: string | null;
  sessions: ChatSession[];
}

export class ChatSessionManager {
  private static readonly STORAGE_KEY = 'claudeCopilot.chatSessions';
  private static readonly MAX_SESSIONS = 50;

  private context: vscode.ExtensionContext;
  private currentSessionId: string | null = null;
  private sessions: Map<string, ChatSession> = new Map();

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    const data = this.context.globalState.get<StorageData>(ChatSessionManager.STORAGE_KEY);
    if (data) {
      this.currentSessionId = data.currentSessionId;
      this.sessions.clear();
      for (const session of data.sessions) {
        this.sessions.set(session.id, session);
      }
    }
  }

  private async saveToStorage(): Promise<void> {
    const data: StorageData = {
      currentSessionId: this.currentSessionId,
      sessions: Array.from(this.sessions.values()),
    };
    await this.context.globalState.update(ChatSessionManager.STORAGE_KEY, data);
  }

  private generateId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateTitle(messages: ChatMessage[]): string {
    // Use first user message as title, truncated
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (firstUserMessage) {
      const content = firstUserMessage.content;
      return content.length > 50 ? content.substring(0, 50) + '...' : content;
    }
    return 'New Chat';
  }

  public getCurrentSession(): ChatSession | null {
    if (!this.currentSessionId) {
      return null;
    }
    return this.sessions.get(this.currentSessionId) || null;
  }

  public getCurrentMessages(): ChatMessage[] {
    const session = this.getCurrentSession();
    return session ? session.messages : [];
  }

  public async createNewSession(): Promise<ChatSession> {
    const session: ChatSession = {
      id: this.generateId(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.sessions.set(session.id, session);
    this.currentSessionId = session.id;

    // Limit number of sessions
    await this.pruneOldSessions();
    await this.saveToStorage();

    return session;
  }

  public async getOrCreateCurrentSession(): Promise<ChatSession> {
    let session = this.getCurrentSession();
    if (!session) {
      session = await this.createNewSession();
    }
    return session;
  }

  public async addMessage(message: ChatMessage): Promise<void> {
    const session = await this.getOrCreateCurrentSession();
    session.messages.push(message);
    session.updatedAt = Date.now();

    // Update title if this is the first user message
    if (message.role === 'user' && session.title === 'New Chat') {
      session.title = this.generateTitle(session.messages);
    }

    await this.saveToStorage();
  }

  public async updateLastAssistantMessage(content: string): Promise<void> {
    const session = this.getCurrentSession();
    if (!session) return;

    const lastMessage = session.messages[session.messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant') {
      lastMessage.content = content;
      session.updatedAt = Date.now();
      await this.saveToStorage();
    }
  }

  public async switchSession(sessionId: string): Promise<ChatSession | null> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.currentSessionId = sessionId;
      await this.saveToStorage();
      return session;
    }
    return null;
  }

  public async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);

    if (this.currentSessionId === sessionId) {
      // Switch to most recent session or create new one
      const sessions = this.getAllSessions();
      if (sessions.length > 0) {
        this.currentSessionId = sessions[0].id;
      } else {
        this.currentSessionId = null;
      }
    }

    await this.saveToStorage();
  }

  public async clearCurrentSession(): Promise<void> {
    const session = this.getCurrentSession();
    if (session) {
      session.messages = [];
      session.title = 'New Chat';
      session.updatedAt = Date.now();
      await this.saveToStorage();
    }
  }

  public getAllSessions(): ChatSession[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  private async pruneOldSessions(): Promise<void> {
    const sessions = this.getAllSessions();
    if (sessions.length > ChatSessionManager.MAX_SESSIONS) {
      const toDelete = sessions.slice(ChatSessionManager.MAX_SESSIONS);
      for (const session of toDelete) {
        this.sessions.delete(session.id);
      }
    }
  }

  public async renameSession(sessionId: string, title: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.title = title;
      await this.saveToStorage();
    }
  }
}
