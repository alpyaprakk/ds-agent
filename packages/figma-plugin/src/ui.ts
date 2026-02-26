import { io, Socket } from 'socket.io-client';

const SERVER_URL = 'https://ds-agent.alpy.io';

let socket: Socket | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

function setStatus(text: string) {
  const el = document.getElementById('status');
  if (el) el.textContent = text;
}

function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    if (socket && socket.connected) {
      socket.emit('heartbeat');
    }
  }, 30000);
}

function performSync() {
  setStatus('🔄 Syncing...');
  parent.postMessage({ pluginMessage: { type: 'full-sync' } }, '*');
}

function connectToServer() {
  try {
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
      setStatus('🟢 Connected to server');
      socket!.emit('plugin-connect', {
        plugin: 'figma',
        timestamp: new Date().toISOString(),
      });
      startHeartbeat();
    });

    socket.on('plugin-connected', (data: any) => {
      console.log('Plugin connected:', data);
    });

    socket.on('sync-request', () => {
      performSync();
    });

    socket.on('apply-fix', (msg: any) => {
      console.log('Applying fix from server:', msg);
      parent.postMessage({ pluginMessage: { type: 'apply-fix', fix: msg } }, '*');
      setStatus('🔧 Applying fix...');
    });

    socket.on('execute-command', (msg: any) => {
      console.log('🤖 Execute command from server:', msg.command?.type);
      parent.postMessage({ pluginMessage: { type: 'execute-command', command: msg.command, commandId: msg.commandId } }, '*');
      setStatus(`🤖 Executing: ${msg.command?.type}...`);
    });

    socket.on('sync-complete', (data: any) => {
      console.log('✅ Sync complete:', data);
      setStatus(`✅ Synced: ${data.stats.variables} variables, ${data.stats.components} components`);
    });

    socket.on('sync-error', (data: any) => {
      console.error('❌ Sync error:', data);
      setStatus('❌ Sync error: ' + data.error);
    });

    socket.on('disconnect', (reason: string) => {
      console.log('❌ Disconnected. Reason:', reason);
      setStatus('🔴 Disconnected - reconnecting...');
    });

    socket.on('reconnect', (attemptNumber: number) => {
      console.log('🔄 Reconnected after', attemptNumber, 'attempts');
      setStatus('🟢 Reconnected to server');
      socket!.emit('plugin-connect', {
        plugin: 'figma',
        timestamp: new Date().toISOString(),
      });
      startHeartbeat();
    });

    socket.on('reconnect_attempt', (attemptNumber: number) => {
      setStatus('🟡 Reconnecting... (attempt ' + attemptNumber + ')');
    });

    socket.on('connect_error', (error: Error) => {
      console.error('Connection error:', error.message);
      setStatus('🔴 Connection error - retrying...');
    });
  } catch (error) {
    console.error('Connection error:', error);
    setStatus('🔴 Failed to connect');
  }
}

window.onmessage = (event: MessageEvent) => {
  const msg = event.data?.pluginMessage;
  if (!msg) return;

  if (msg.type === 'variables-data') {
    setStatus(`Found ${msg.variables.length} variables`);
    console.log('Variables:', msg.variables);
  }

  if (msg.type === 'components-data') {
    setStatus(`Found ${msg.components.length} components`);
    console.log('Components:', msg.components);
  }

  if (msg.type === 'sync-data') {
    if (socket && socket.connected) {
      setStatus('📤 Sending data to server...');
      socket.emit('design-system-sync', { data: msg.data });
    } else {
      setStatus('❌ Not connected to server. Retrying...');
      connectToServer();
      const waitForConnection = setInterval(() => {
        if (socket && socket.connected) {
          clearInterval(waitForConnection);
          socket.emit('design-system-sync', { data: msg.data });
          setStatus('📤 Sending data to server...');
        }
      }, 1000);
      setTimeout(() => clearInterval(waitForConnection), 15000);
    }
  }

  if (msg.type === 'fix-applied') {
    setStatus('✅ Fix applied successfully');
    if (socket && socket.connected) {
      socket.emit('fix-applied', { conflictId: msg.conflictId, success: true });
    }
  }

  if (msg.type === 'fix-error') {
    setStatus('❌ Fix failed: ' + msg.error);
    if (socket && socket.connected) {
      socket.emit('fix-applied', {
        conflictId: msg.conflictId,
        success: false,
        error: msg.error,
      });
    }
  }

  if (msg.type === 'command-result') {
    const status = msg.result?.success ? `✅ Done: ${msg.result.message}` : `❌ Failed: ${msg.result?.message}`;
    setStatus(status);
    console.log('Command result:', msg.result);
    if (socket && socket.connected) {
      socket.emit('command-result', { commandId: msg.commandId, result: msg.result });
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('get-variables')!.onclick = () => {
    parent.postMessage({ pluginMessage: { type: 'get-variables' } }, '*');
    setStatus('Fetching variables...');
  };

  document.getElementById('get-components')!.onclick = () => {
    parent.postMessage({ pluginMessage: { type: 'get-components' } }, '*');
    setStatus('Fetching components...');
  };

  document.getElementById('sync')!.onclick = () => {
    performSync();
  };

  connectToServer();
});

window.onbeforeunload = () => {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (socket) socket.disconnect();
};
