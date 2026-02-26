import { io, Socket } from 'socket.io-client';

const SERVER_URL = 'https://ds-agent.alpy.io';

let socket: Socket | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

// ─── Job Queue State ──────────────────────────────────────────────────────────

type JobStatus = 'pending' | 'running' | 'success' | 'error';

interface Job {
  id: string;
  type: string;
  label: string;
  status: JobStatus;
  detail: string;
  progress: number; // 0-100
  startedAt: number;
  finishedAt?: number;
}

const jobs = new Map<string, Job>();
let doneCount = 0;
let errorCount = 0;

function jobTypeLabel(type: string): string {
  const map: Record<string, string> = {
    create_component: 'Create Component',
    set_variable_value: 'Set Tokens',
    rename_variable: 'Rename Variable',
    sync: 'Sync',
  };
  return map[type] || type;
}

function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

function renderJobs() {
  const list = document.getElementById('job-list')!;
  const empty = document.getElementById('empty-state');
  const countEl = document.getElementById('queue-count');

  const all = Array.from(jobs.values()).reverse(); // newest first

  // Stats chips
  const running = all.filter(j => j.status === 'running' || j.status === 'pending').length;
  (document.getElementById('chip-done')   as HTMLElement).textContent = String(doneCount);
  (document.getElementById('chip-errors') as HTMLElement).textContent = String(errorCount);
  (document.getElementById('chip-running') as HTMLElement).textContent = String(running);

  if (countEl) countEl.textContent = all.length > 0 ? `${all.length} job${all.length !== 1 ? 's' : ''}` : '';

  if (all.length === 0) {
    if (!empty) {
      list.innerHTML = `
        <div id="empty-state">
          <div class="empty-icon">⚡</div>
          <p>Waiting for commands from<br>Claude or the Dashboard</p>
        </div>`;
    }
    return;
  }

  // Remove empty state if present
  if (empty) empty.remove();

  // Build or update each card
  all.forEach(job => {
    let card = document.getElementById(`job-${job.id}`);
    if (!card) {
      card = document.createElement('div');
      card.id = `job-${job.id}`;
      card.className = `job-card ${job.status}`;
      list.prepend(card); // prepend = newest first
    } else {
      card.className = `job-card ${job.status}`;
    }

    const fillClass = (job.status === 'running') ? 'indeterminate' : '';
    const fillWidth = job.status === 'success' || job.status === 'error' ? '100' : String(job.progress);
    const timeStr = job.finishedAt ? timeAgo(job.finishedAt) : timeAgo(job.startedAt);
    const detailClass = job.status === 'error' ? 'err' : '';

    card.innerHTML = `
      <div class="job-top">
        <span class="job-name">${job.label}</span>
        <span class="job-status-badge ${job.status}">${job.status}</span>
      </div>
      <div class="job-progress">
        <div class="job-progress-fill ${fillClass}" style="width:${fillWidth}%"></div>
      </div>
      <div class="job-meta">
        <span class="job-detail ${detailClass}">${job.detail}</span>
        <span class="job-time">${timeStr}</span>
      </div>`;
  });

  // Prune cards not in jobs map anymore
  Array.from(list.children).forEach(el => {
    const id = el.id.replace('job-', '');
    if (id && !jobs.has(id) && el.id !== 'empty-state') el.remove();
  });
}

function addJob(commandId: string, type: string, detail: string): Job {
  const job: Job = {
    id: commandId,
    type,
    label: jobTypeLabel(type),
    status: 'running',
    detail,
    progress: 0,
    startedAt: Date.now(),
  };
  jobs.set(commandId, job);
  renderJobs();
  return job;
}

function updateJob(commandId: string, status: JobStatus, detail: string) {
  const job = jobs.get(commandId);
  if (!job) return;
  job.status = status;
  job.detail = detail;
  job.progress = status === 'success' || status === 'error' ? 100 : job.progress;
  if (status === 'success' || status === 'error') {
    job.finishedAt = Date.now();
    if (status === 'success') doneCount++;
    else errorCount++;
  }
  jobs.set(commandId, job);
  renderJobs();

  // Auto-remove finished jobs after 30s
  if (status === 'success' || status === 'error') {
    setTimeout(() => {
      jobs.delete(commandId);
      // Remove the card from DOM
      const card = document.getElementById(`job-${commandId}`);
      if (card) card.remove();
      if (jobs.size === 0) {
        const list = document.getElementById('job-list')!;
        list.innerHTML = `
          <div id="empty-state">
            <div class="empty-icon">⚡</div>
            <p>Waiting for commands from<br>Claude or the Dashboard</p>
          </div>`;
      }
      renderJobs();
    }, 30_000);
  }
}

// ─── Connection status ────────────────────────────────────────────────────────

function setMcpStatus(connected: boolean, label?: string) {
  const badge = document.getElementById('mcp-badge')!;
  const lbl = document.getElementById('mcp-label')!;
  badge.className = `mcp-badge ${connected ? 'connected' : 'disconnected'}`;
  // also set id for CSS targeting
  badge.id = 'mcp-badge';
  badge.className = connected ? 'connected' : 'disconnected';
  // re-add id (className overwrite doesn't touch id)
  lbl.textContent = label ?? (connected ? 'MCP Ready' : 'Connecting…');
}

// ─── Collapse / Expand ────────────────────────────────────────────────────────

let collapsed = false;

function toggleCollapse() {
  collapsed = !collapsed;
  document.body.classList.toggle('collapsed', collapsed);
  // Resize plugin window
  parent.postMessage({
    pluginMessage: {
      type: 'resize',
      width: 300,
      height: collapsed ? 48 : 420,
    }
  }, '*');
}

// ─── Socket.IO ────────────────────────────────────────────────────────────────

function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    if (socket?.connected) socket.emit('heartbeat');
  }, 30_000);
}

function performSync() {
  parent.postMessage({ pluginMessage: { type: 'full-sync' } }, '*');
}

function connectToServer() {
  socket = io(SERVER_URL, {
    path: '/api/socket.io',
    transports: ['websocket', 'polling'],
    query: { plugin: 'true' },
    reconnection: true,
    reconnectionDelay: 5000,
    reconnectionAttempts: Infinity,
  });

  socket.on('connect', () => {
    console.log('✅ Connected to Tokenhaus server');
    setMcpStatus(true, 'MCP Ready');
    socket!.emit('plugin-connect', { plugin: 'figma', timestamp: new Date().toISOString() });
    startHeartbeat();
  });

  socket.on('plugin-connected', () => {
    setMcpStatus(true, 'MCP Ready');
  });

  socket.on('sync-request', () => {
    performSync();
  });

  socket.on('apply-fix', (msg: any) => {
    parent.postMessage({ pluginMessage: { type: 'apply-fix', fix: msg } }, '*');
  });

  socket.on('execute-command', (msg: any) => {
    const type = msg.command?.type ?? 'unknown';
    const detail = buildJobDetail(msg.command);
    addJob(msg.commandId, type, detail);
    parent.postMessage({
      pluginMessage: { type: 'execute-command', command: msg.command, commandId: msg.commandId }
    }, '*');
  });

  socket.on('sync-complete', (data: any) => {
    console.log('✅ Sync complete:', data);
  });

  socket.on('sync-error', (data: any) => {
    console.error('❌ Sync error:', data);
  });

  socket.on('disconnect', () => {
    setMcpStatus(false, 'Disconnected');
  });

  socket.on('reconnect', () => {
    setMcpStatus(true, 'MCP Ready');
    socket!.emit('plugin-connect', { plugin: 'figma', timestamp: new Date().toISOString() });
    startHeartbeat();
  });

  socket.on('connect_error', () => {
    setMcpStatus(false, 'Retrying…');
  });
}

function buildJobDetail(command: any): string {
  if (!command) return '';
  switch (command.type) {
    case 'create_component': {
      const s = command.spec;
      const variants = s?.variants?.length ?? 0;
      return `${s?.componentName ?? '?'} · ${variants} variants`;
    }
    case 'set_variable_value': {
      const count = Array.isArray(command.spec) ? command.spec.length : 1;
      return `${count} token${count !== 1 ? 's' : ''}`;
    }
    case 'rename_variable':
      return `${command.spec?.oldName ?? '?'} → ${command.spec?.newName ?? '?'}`;
    default:
      return command.type;
  }
}

// ─── Message from code thread ─────────────────────────────────────────────────

window.onmessage = (event: MessageEvent) => {
  const msg = event.data?.pluginMessage;
  if (!msg) return;

  if (msg.type === 'sync-data') {
    if (socket?.connected) {
      socket.emit('design-system-sync', { data: msg.data });
    } else {
      connectToServer();
      const wait = setInterval(() => {
        if (socket?.connected) {
          clearInterval(wait);
          socket.emit('design-system-sync', { data: msg.data });
        }
      }, 1000);
      setTimeout(() => clearInterval(wait), 15_000);
    }
  }

  if (msg.type === 'fix-applied') {
    socket?.emit('fix-applied', { conflictId: msg.conflictId, success: true });
  }

  if (msg.type === 'fix-error') {
    socket?.emit('fix-applied', { conflictId: msg.conflictId, success: false, error: msg.error });
  }

  if (msg.type === 'command-result') {
    const success = msg.result?.success === true;
    const detail = msg.result?.message ?? (success ? 'Done' : 'Failed');
    updateJob(msg.commandId, success ? 'success' : 'error', detail);
    socket?.emit('command-result', { commandId: msg.commandId, result: msg.result });
  }
};

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('toggle-btn')!.onclick = toggleCollapse;

  // Initial window size
  parent.postMessage({ pluginMessage: { type: 'resize', width: 300, height: 420 } }, '*');

  connectToServer();
  renderJobs();
});

window.onbeforeunload = () => {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  socket?.disconnect();
};
