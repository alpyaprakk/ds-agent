import { randomUUID } from 'crypto';

// ─── Console Log Storage Service ──────────────────────────────────────────────
// In-memory circular buffer for storing console logs from plugin and server
// Logs are stored per workspace with a 1000-entry limit (oldest entries auto-removed)

export type LogLevel = 'log' | 'info' | 'warn' | 'error';
export type LogSource = 'plugin' | 'server';

export interface ConsoleLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: LogSource;
  workspaceId: string;
  message: string;
  data?: any;
}

class ConsoleLoggerService {
  private logs: Map<string, ConsoleLog[]> = new Map(); // workspaceId -> logs array
  private readonly MAX_LOGS_PER_WORKSPACE = 1000;

  /** Add a console log entry for a specific workspace */
  addLog(
    workspaceId: string,
    level: LogLevel,
    source: LogSource,
    message: string,
    data?: any
  ): void {
    const log: ConsoleLog = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      level,
      source,
      workspaceId,
      message,
      data,
    };

    // Get or create logs array for this workspace
    let workspaceLogs = this.logs.get(workspaceId);
    if (!workspaceLogs) {
      workspaceLogs = [];
      this.logs.set(workspaceId, workspaceLogs);
    }

    // Add new log at the end
    workspaceLogs.push(log);

    // Enforce circular buffer limit (keep most recent logs)
    if (workspaceLogs.length > this.MAX_LOGS_PER_WORKSPACE) {
      workspaceLogs.shift(); // Remove oldest log
    }
  }

  /** Retrieve logs for a workspace with optional filters */
  getLogs(
    workspaceId: string,
    options?: {
      limit?: number;
      level?: 'all' | LogLevel;
      source?: 'all' | LogSource;
    }
  ): ConsoleLog[] {
    const workspaceLogs = this.logs.get(workspaceId) || [];
    let filtered = workspaceLogs;

    // Filter by level if specified
    if (options?.level && options.level !== 'all') {
      filtered = filtered.filter(log => log.level === options.level);
    }

    // Filter by source if specified
    if (options?.source && options.source !== 'all') {
      filtered = filtered.filter(log => log.source === options.source);
    }

    // Apply limit (most recent logs first)
    const limit = Math.min(options?.limit || 100, 1000);
    return filtered.slice(-limit).reverse(); // Reverse to show newest first
  }

  /** Get total log count for a workspace */
  getLogCount(workspaceId: string): number {
    return (this.logs.get(workspaceId) || []).length;
  }

  /** Clear all logs for a workspace */
  clearLogs(workspaceId: string): void {
    this.logs.delete(workspaceId);
  }

  /** Clear all logs across all workspaces */
  clearAllLogs(): void {
    this.logs.clear();
  }
}

// Singleton instance
export const consoleLogger = new ConsoleLoggerService();
