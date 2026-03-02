import { apiPost, apiGet } from '../client.js';
import { z } from 'zod';

// ── capture_screenshot Schema ───────────────────────────────────────────────────

export const CaptureScreenshotInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
  nodeId: z.string().describe(
    'Figma node ID to capture (e.g. "123:456"). Can be any visible node: frame, component, group, etc.'
  ),
  format: z.enum(['PNG', 'JPG', 'SVG', 'PDF']).default('PNG').optional().describe(
    'Image format for the screenshot. PNG recommended for designs with transparency.'
  ),
  scale: z.number().min(1).max(4).default(2).optional().describe(
    'Export scale factor (1x, 2x, 3x, 4x). Higher values = higher resolution but larger file size. Default: 2x for retina displays.'
  ),
});

type Input = z.infer<typeof CaptureScreenshotInputSchema>;

interface ExecuteResponse { commandStatus: string; commandId: string; }
interface PollResponse {
  status: string;
  commandId: string;
  message?: string;
  imageData?: string;
  mimeType?: string;
  width?: number;
  height?: number;
}

/** Poll for a command result, waiting up to maxWaitMs (default 60s). */
async function pollResult(commandId: string, maxWaitMs = 60_000): Promise<PollResponse> {
  const interval = 2_000;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, interval));
    const res = await apiGet<PollResponse>(`/api/commands/${commandId}/result`);
    if (res.status !== 'pending') return res;
  }

  return { status: 'timeout', commandId, message: 'Plugin did not respond within 60s' };
}

export async function captureScreenshot(input: Input): Promise<string> {
  const { workspaceId, ...params } = input;

  const command = {
    type: 'capture_screenshot',
    params: {
      nodeId: params.nodeId,
      format: params.format || 'PNG',
      scale: params.scale || 2,
    },
  };

  const result = await apiPost<ExecuteResponse>(
    '/api/commands/execute',
    { workspaceId, command }
  );

  if (result.commandStatus === 'no_plugin') {
    return JSON.stringify({
      status: 'no_plugin',
      nodeId: params.nodeId,
      message: '⚠️ No Figma plugin connected — open the Tokenhaus plugin in Figma first',
    }, null, 2);
  }

  // Poll until plugin confirms completion
  const poll = await pollResult(result.commandId);

  if (poll.status === 'success' && poll.imageData) {
    const sizeKB = Math.round(poll.imageData.length * 0.75 / 1024); // Rough base64 → bytes estimate

    return JSON.stringify({
      status: 'success',
      nodeId: params.nodeId,
      format: params.format || 'PNG',
      scale: params.scale || 2,
      imageData: poll.imageData,
      mimeType: poll.mimeType,
      dimensions: poll.width && poll.height ? `${poll.width}x${poll.height}` : undefined,
      sizeKB,
      message: `✅ Screenshot captured (${params.format || 'PNG'}, ${params.scale || 2}x, ~${sizeKB}KB)`,
    }, null, 2);
  }

  if (poll.status === 'timeout') {
    return JSON.stringify({
      status: 'timeout',
      nodeId: params.nodeId,
      message: '⏱ Screenshot capture timed out — node may be too large or complex',
    }, null, 2);
  }

  return JSON.stringify({
    status: 'error',
    nodeId: params.nodeId,
    message: `❌ Screenshot capture failed: ${poll.message ?? 'unknown error'}`,
  }, null, 2);
}
