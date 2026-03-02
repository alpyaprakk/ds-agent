import { apiGet } from '../client.js';
import { z } from 'zod';

// ── get_console_logs Schema ────────────────────────────────────────────────────

export const GetConsoleLogsInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
  limit: z.number().min(1).max(1000).optional().describe('Maximum number of logs to return (default: 100, max: 1000)'),
  level: z.enum(['all', 'log', 'info', 'warn', 'error']).optional().describe('Filter by log level (default: all)'),
  source: z.enum(['all', 'plugin', 'server']).optional().describe('Filter by source (default: all)'),
}).describe('Retrieve recent console logs from Figma plugin and server for debugging');

type Input = z.infer<typeof GetConsoleLogsInputSchema>;

interface ConsoleLog {
  id: string;
  timestamp: string;
  level: 'log' | 'info' | 'warn' | 'error';
  source: 'plugin' | 'server';
  message: string;
  data?: any;
}

interface GetConsoleLogsResponse {
  logs: ConsoleLog[];
  totalCount: number;
  oldestTimestamp?: string;
  newestTimestamp?: string;
}

export async function getConsoleLogs(input: Input): Promise<string> {
  const { workspaceId, limit = 100, level = 'all', source = 'all' } = input;

  const params = new URLSearchParams({
    limit: String(limit),
    ...(level !== 'all' && { level }),
    ...(source !== 'all' && { source }),
  });

  const data = await apiGet<GetConsoleLogsResponse>(
    `/api/workspaces/${workspaceId}/console-logs?${params}`
  );

  return JSON.stringify({
    workspaceId,
    totalCount: data.totalCount,
    logCount: data.logs.length,
    oldestTimestamp: data.oldestTimestamp,
    newestTimestamp: data.newestTimestamp,
    logs: data.logs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      level: log.level,
      source: log.source,
      message: log.message,
      data: log.data,
    })),
  }, null, 2);
}
