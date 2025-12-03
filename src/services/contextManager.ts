import * as vscode from 'vscode';
import * as path from 'path';
import { CompletionContext, FileContext } from '../types';
import { ConfigManager } from './configManager';

export class ContextManager {
  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  public async getCompletionContext(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<CompletionContext> {
    const text = document.getText();
    const offset = document.offsetAt(position);

    const prefix = text.substring(0, offset);
    const suffix = text.substring(offset);

    const config = this.configManager.getConfig();
    let relatedFiles: FileContext[] = [];

    if (config.context.includeImports) {
      relatedFiles = await this.getRelatedFiles(document);
    }

    return {
      prefix,
      suffix,
      language: document.languageId,
      filename: path.basename(document.fileName),
      relatedFiles,
    };
  }

  public async getSelectionContext(editor: vscode.TextEditor): Promise<string> {
    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);
    const languageId = editor.document.languageId;
    const filename = path.basename(editor.document.fileName);

    return `File: ${filename}\nLanguage: ${languageId}\n\n\`\`\`${languageId}\n${selectedText}\n\`\`\``;
  }

  public async getFileContext(uri: vscode.Uri): Promise<FileContext | null> {
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      return {
        path: vscode.workspace.asRelativePath(uri),
        content: document.getText(),
        language: document.languageId,
      };
    } catch (error) {
      console.error(`Failed to read file ${uri.fsPath}:`, error);
      return null;
    }
  }

  private async getRelatedFiles(document: vscode.TextDocument): Promise<FileContext[]> {
    const config = this.configManager.getConfig();
    const relatedFiles: FileContext[] = [];
    const imports = this.extractImports(document);
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);

    if (!workspaceFolder) {
      return relatedFiles;
    }

    for (const importPath of imports.slice(0, config.context.maxFiles)) {
      const resolvedPath = this.resolveImportPath(importPath, document.uri, workspaceFolder.uri);
      if (resolvedPath && !this.isExcluded(resolvedPath)) {
        const fileContext = await this.getFileContext(resolvedPath);
        if (fileContext) {
          relatedFiles.push(fileContext);
        }
      }
    }

    return relatedFiles;
  }

  private extractImports(document: vscode.TextDocument): string[] {
    const text = document.getText();
    const imports: string[] = [];

    // JavaScript/TypeScript imports
    const jsImportRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = jsImportRegex.exec(text)) !== null) {
      imports.push(match[1]);
    }

    // Python imports
    const pyImportRegex = /(?:from|import)\s+([^\s]+)/g;
    while ((match = pyImportRegex.exec(text)) !== null) {
      imports.push(match[1]);
    }

    // Go imports
    const goImportRegex = /import\s+(?:\(\s*)?["']([^"']+)["']/g;
    while ((match = goImportRegex.exec(text)) !== null) {
      imports.push(match[1]);
    }

    return [...new Set(imports)];
  }

  private resolveImportPath(
    importPath: string,
    documentUri: vscode.Uri,
    workspaceUri: vscode.Uri
  ): vscode.Uri | null {
    // Skip node_modules and external packages
    if (
      !importPath.startsWith('.') &&
      !importPath.startsWith('/') &&
      !importPath.startsWith('@/')
    ) {
      return null;
    }

    const documentDir = path.dirname(documentUri.fsPath);
    let resolvedPath: string;

    if (importPath.startsWith('@/')) {
      // Handle alias paths (common in Vue/React projects)
      resolvedPath = path.join(workspaceUri.fsPath, 'src', importPath.substring(2));
    } else {
      resolvedPath = path.resolve(documentDir, importPath);
    }

    // Try common extensions
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.vue', '.py', '.go'];
    for (const ext of extensions) {
      const fullPath = resolvedPath + ext;
      try {
        return vscode.Uri.file(fullPath);
      } catch {
        continue;
      }
    }

    // Try index files
    const indexExtensions = [
      '/index.ts',
      '/index.tsx',
      '/index.js',
      '/index.jsx',
      '/index.vue',
    ];
    for (const indexExt of indexExtensions) {
      const fullPath = resolvedPath + indexExt;
      try {
        return vscode.Uri.file(fullPath);
      } catch {
        continue;
      }
    }

    return null;
  }

  private isExcluded(uri: vscode.Uri): boolean {
    const config = this.configManager.getConfig();
    const relativePath = vscode.workspace.asRelativePath(uri);

    for (const pattern of config.privacy.excludePatterns) {
      // Simple glob matching
      const regex = new RegExp(
        '^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$'
      );
      if (regex.test(relativePath)) {
        return true;
      }
    }

    return false;
  }

  public async getWorkspaceContext(query: string): Promise<FileContext[]> {
    const config = this.configManager.getConfig();
    const files: FileContext[] = [];

    // Search for relevant files based on query
    const searchPattern = `**/*{${query.split(' ').join(',')}*}*`;
    const uris = await vscode.workspace.findFiles(searchPattern, '**/node_modules/**', config.context.maxFiles);

    for (const uri of uris) {
      if (!this.isExcluded(uri)) {
        const fileContext = await this.getFileContext(uri);
        if (fileContext) {
          files.push(fileContext);
        }
      }
    }

    return files;
  }
}
