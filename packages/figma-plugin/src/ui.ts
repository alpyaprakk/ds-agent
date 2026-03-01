import { io, Socket } from 'socket.io-client';

const SERVER_URL = 'https://ds-agent.alpy.io';

// crypto.randomUUID is not available in Figma plugin sandbox
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

let socket: Socket | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

// ─── Auth State ───────────────────────────────────────────────────────────────

interface AuthState {
  token: string;
  userId: string;
  userName: string;
  userEmail: string;
  workspaceId: string;
  workspaceName: string;
}

let auth: AuthState | null = null;

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
  badge.id = 'mcp-badge';
  badge.className = connected ? 'connected' : 'disconnected';
  lbl.textContent = label ?? (connected ? 'MCP Ready' : 'Connecting…');
}

// ─── Collapse / Expand ────────────────────────────────────────────────────────

let collapsed = false;

function toggleCollapse() {
  collapsed = !collapsed;
  document.body.classList.toggle('collapsed', collapsed);
  parent.postMessage({
    pluginMessage: {
      type: 'resize',
      width: 300,
      height: collapsed ? 48 : 420,
    }
  }, '*');
}

// ─── Screen management ────────────────────────────────────────────────────────

function showScreen(screen: 'auth' | 'main') {
  const authScreen = document.getElementById('auth-screen')!;
  const mainContent = document.getElementById('main-content')!;
  const userBar = document.getElementById('user-bar')!;

  authScreen.style.display = screen === 'auth' ? 'flex' : 'none';
  mainContent.style.display = screen === 'main' ? 'flex' : 'none';
  userBar.style.display = screen === 'main' ? 'flex' : 'none';

  if (screen === 'main') {
    const height = collapsed ? 48 : 420;
    parent.postMessage({ pluginMessage: { type: 'resize', width: 300, height } }, '*');
  } else {
    parent.postMessage({ pluginMessage: { type: 'resize', width: 300, height: 320 } }, '*');
  }
}

// ─── Auth persistence ─────────────────────────────────────────────────────────

function saveAuth(authState: AuthState) {
  parent.postMessage({ pluginMessage: { type: 'save-auth', auth: authState } }, '*');
}

function clearAuth() {
  parent.postMessage({ pluginMessage: { type: 'clear-auth' } }, '*');
}

// ─── Login flow (browser polling) ────────────────────────────────────────────

let pollInterval: ReturnType<typeof setInterval> | null = null;
let pollTimeout: ReturnType<typeof setTimeout> | null = null;

function stopPolling() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  if (pollTimeout) { clearTimeout(pollTimeout); pollTimeout = null; }
}

async function handleLogin() {
  const errorEl = document.getElementById('auth-error')!;
  const btn = document.getElementById('auth-btn') as HTMLButtonElement;
  const statusEl = document.getElementById('auth-status')!;

  btn.disabled = true;
  btn.textContent = 'Opening browser…';
  errorEl.textContent = '';
  statusEl.textContent = '';

  try {
    const sessionId = generateUUID();

    const startRes = await fetch(`${SERVER_URL}/api/auth/plugin-session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    if (!startRes.ok) throw new Error('Could not start login session');
    const { loginUrl } = await startRes.json();

    // Open browser
    parent.postMessage({ pluginMessage: { type: 'open-external', url: loginUrl } }, '*');

    btn.textContent = 'Waiting for browser…';
    statusEl.textContent = 'Complete sign in on the browser tab that just opened';

    // Poll for completion every 2s
    stopPolling();
    pollInterval = setInterval(async () => {
      try {
        const statusRes = await fetch(`${SERVER_URL}/api/auth/plugin-session/${sessionId}/status`);

        if (statusRes.status === 410) {
          stopPolling();
          errorEl.textContent = 'Session expired. Try again.';
          btn.disabled = false;
          btn.textContent = 'Sign in with browser';
          statusEl.textContent = '';
          return;
        }

        if (!statusRes.ok) return;

        const data = await statusRes.json();
        if (data.status === 'completed') {
          stopPolling();

          // Try to get workspace name
          let workspace = { id: data.workspaceId || '', name: 'My Workspace' };
          if (data.workspaceId) {
            try {
              const wsRes = await fetch(`${SERVER_URL}/api/workspaces`, {
                headers: { Authorization: `Bearer ${data.token}` },
              });
              const wsData = await wsRes.json();
              const workspaces: Array<{ id: string; name: string }> = wsData.workspaces ?? wsData;
              const found = workspaces.find(w => w.id === data.workspaceId);
              if (found) workspace = found;
            } catch { /* use default */ }
          }

          completeLogin(data.token, data.user, workspace);
        }
      } catch { /* network hiccup, keep polling */ }
    }, 2000);

    // Timeout after 5 minutes
    pollTimeout = setTimeout(() => {
      stopPolling();
      errorEl.textContent = 'Login timed out. Please try again.';
      btn.disabled = false;
      btn.textContent = 'Sign in with browser';
      statusEl.textContent = '';
    }, 5 * 60 * 1000);

  } catch (err: any) {
    errorEl.textContent = err.message || 'Login failed';
    btn.disabled = false;
    btn.textContent = 'Sign in with browser';
  }
}

function completeLogin(token: string, user: any, workspace: { id: string; name: string }) {
  auth = {
    token,
    userId: user.id,
    userName: user.name || user.email,
    userEmail: user.email,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
  };

  saveAuth(auth);
  updateUserBar();
  showScreen('main');
  connectToServer();
}

function updateUserBar() {
  if (!auth) return;
  const nameEl = document.getElementById('user-bar-name')!;
  const wsEl = document.getElementById('user-bar-workspace')!;
  nameEl.textContent = auth.userName;
  wsEl.textContent = auth.workspaceName;
}

function handleLogout() {
  stopPolling();
  if (socket?.connected) socket.disconnect();
  socket = null;
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = null;
  auth = null;
  clearAuth();
  showScreen('auth');
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
  if (socket?.connected) socket.disconnect();

  socket = io(SERVER_URL, {
    path: '/api/socket.io',
    transports: ['websocket', 'polling'],
    query: { plugin: 'true' },
    auth: auth ? { token: auth.token } : {},
    reconnection: true,
    reconnectionDelay: 5000,
    reconnectionAttempts: Infinity,
  });

  socket.on('connect', () => {
    console.log('✅ Connected to Tokenhaus server');
    setMcpStatus(true, 'MCP Ready');
    socket!.emit('plugin-connect', {
      plugin: 'figma',
      timestamp: new Date().toISOString(),
      userId: auth?.userId,
      workspaceId: auth?.workspaceId,
    });
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
    socket!.emit('plugin-connect', {
      plugin: 'figma',
      timestamp: new Date().toISOString(),
      userId: auth?.userId,
      workspaceId: auth?.workspaceId,
    });
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

  if (msg.type === 'auth-restored') {
    if (msg.auth) {
      auth = msg.auth as AuthState;
      updateUserBar();
      showScreen('main');
      connectToServer();
    } else {
      showScreen('auth');
    }
    return;
  }

  if (msg.type === 'sync-data') {
    const payload = {
      data: msg.data,
      workspaceId: auth?.workspaceId,
      userId: auth?.userId,
    };
    if (socket?.connected) {
      socket.emit('design-system-sync', payload);
    } else {
      connectToServer();
      const wait = setInterval(() => {
        if (socket?.connected) {
          clearInterval(wait);
          socket.emit('design-system-sync', payload);
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
  document.getElementById('auth-btn')!.onclick = handleLogin;
  document.getElementById('logout-btn')!.onclick = handleLogout;

  // Initial window size
  parent.postMessage({ pluginMessage: { type: 'resize', width: 300, height: 320 } }, '*');

  // Restore auth from clientStorage
  parent.postMessage({ pluginMessage: { type: 'get-auth' } }, '*');

  renderJobs();
});

window.onbeforeunload = () => {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  socket?.disconnect();
};
