/**
 * AI End-to-End Test Script
 * Tests the full chat → EXECUTE → Figma Plugin pipeline
 *
 * Usage:
 *   node test-ai.mjs
 */

const BASE_URL = 'https://ds-agent.alpy.io';
const EMAIL = 'alpyaprakk@gmail.com';
const PASSWORD = '159456qW';

let token = null;
let workspaceId = null;
const history = [];

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(label, data) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`▶ ${label}`);
  if (data !== undefined) {
    console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  }
}

function pass(msg) { console.log(`  ✅ ${msg}`); }
function fail(msg) { console.log(`  ❌ ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, data: json };
}

// ─── Steps ──────────────────────────────────────────────────────────────────

async function stepLogin() {
  log('STEP 1: Login');
  const { status, data } = await api('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });

  if (status === 200 && data.token) {
    token = data.token;
    pass(`Logged in as ${data.user?.email}`);
    info(`User ID: ${data.user?.id}`);
  } else {
    fail(`Login failed: ${JSON.stringify(data)}`);
    process.exit(1);
  }
}

async function stepGetWorkspace() {
  log('STEP 2: Get Workspaces');
  const { status, data } = await api('GET', '/api/workspaces');

  const workspaces = data.workspaces || data;
  if (status === 200 && workspaces.length > 0) {
    // Prefer 'tokenhaus' workspace, otherwise use first
    const preferred = workspaces.find(w => w.name.toLowerCase().includes('tokenhaus')) || workspaces[0];
    workspaceId = preferred.id;
    pass(`Found ${workspaces.length} workspace(s)`);
    workspaces.forEach(w => info(`  - [${w.id}] ${w.name} (${w.member_role})`));
    info(`Using workspace: ${preferred.name} (${workspaceId})`);
  } else {
    fail(`Could not get workspaces (status ${status}): ${JSON.stringify(data)}`);
    process.exit(1);
  }
}

async function stepCheckPlugin() {
  log('STEP 3: Check Plugin Connection');
  // We'll infer plugin status from the first chat response's commandStatus
  info('Plugin status will be verified via first chat response (commandStatus field)');
}

async function chat(message, label) {
  log(`CHAT: ${label}`);
  info(`Message: "${message}"`);

  const { status, data } = await api('POST', '/api/chat', {
    message,
    history,
    workspaceId,
  });

  if (status !== 200) {
    fail(`HTTP ${status}: ${JSON.stringify(data)}`);
    return null;
  }

  // Add to history for multi-turn conversation
  history.push({ role: 'user', content: message });
  history.push({ role: 'assistant', content: data.reply });

  // Print AI reply
  console.log(`\n  AI Reply:\n  ${data.reply.replace(/\n/g, '\n  ')}`);

  // Validate fields
  console.log('');
  if (data.agentType) pass(`agentType: ${data.agentType}`);
  else fail('agentType missing');

  if (data.command) {
    pass(`EXECUTE block found → type: ${data.command.type}`);
    info(`Command: ${JSON.stringify(data.command, null, 4).replace(/\n/g, '\n    ')}`);

    if (data.commandStatus === 'sent') {
      pass('Command SENT to Figma plugin ✨');
    } else if (data.commandStatus === 'no_plugin') {
      fail('Plugin not connected — command NOT sent to Figma');
    }
  } else {
    info('No EXECUTE block in this response (informational message)');
  }

  return data;
}

// ─── Test Scenarios ──────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n🚀 DS Agent AI End-to-End Test');
  console.log(`   Target: ${BASE_URL}`);
  console.log(`   Time:   ${new Date().toISOString()}`);

  await stepLogin();
  await stepGetWorkspace();
  await stepCheckPlugin();

  // ── Turn 1: Context check ──────────────────────────────────────────────────
  await chat(
    'Ne var şu an sistemde? Kısaca özetle.',
    'Turn 1 — Context summary (should use design-system agent)'
  );

  // ── Turn 2: Color system ───────────────────────────────────────────────────
  await chat(
    'Tam bir renk sistemi oluştur. Primitif renkler (neutral, brand), semantik renkler (bg, text, border, semantic) ve dark mode desteği olsun.',
    'Turn 2 — Create full color system (should produce set_variable_value EXECUTE block)'
  );

  // ── Turn 3: Spacing & radius tokens ───────────────────────────────────────
  await chat(
    'Spacing ve border radius token\'larını da ekle.',
    'Turn 3 — Add spacing + radius tokens'
  );

  // ── Turn 4: Button component ───────────────────────────────────────────────
  await chat(
    'Button componenti oluştur. Size (Small, Medium, Large), Type (Primary, Secondary, Ghost, Destructive) ve State (Default, Hover, Pressed, Disabled) variantları olsun.',
    'Turn 4 — Create Button component (should produce create_component EXECUTE block)'
  );

  // ── Turn 5: Input component ────────────────────────────────────────────────
  await chat(
    'Input componenti de oluştur. State (Default, Focus, Error, Disabled) ve Size (Small, Medium, Large) variantları olsun.',
    'Turn 5 — Create Input component'
  );

  // ── Turn 6: UX evaluation ─────────────────────────────────────────────────
  await chat(
    'Oluşturduğumuz renk sistemini accessibility açısından değerlendir. WCAG AA standartlarını karşılıyor mu?',
    'Turn 6 — Accessibility evaluation (should route to uiux agent)'
  );

  log('TEST COMPLETE');
  console.log('\n📊 Summary:');
  console.log(`  - Total turns: ${history.filter(m => m.role === 'user').length}`);
  console.log(`  - Check Figma file for created components and variables`);
  console.log('');
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
