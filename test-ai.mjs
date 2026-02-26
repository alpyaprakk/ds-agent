/**
 * Tokenhaus AI — Full Design System E2E Test
 *
 * Scenarios:
 *   Phase 1 — Foundation tokens (colors, spacing, radius, typography)
 *   Phase 2 — Core components across dedicated pages
 *   Phase 3 — Compound/feedback components
 *   Phase 4 — UX evaluation pass
 *
 * Usage:
 *   node test-ai.mjs              # run all phases
 *   node test-ai.mjs --phase 2   # run specific phase only
 */

const BASE_URL   = 'https://ds-agent.alpy.io';
const EMAIL      = 'alpyaprakk@gmail.com';
const PASSWORD   = '159456qW';

const args       = process.argv.slice(2);
const phaseArg   = args.includes('--phase') ? parseInt(args[args.indexOf('--phase') + 1]) : null;

let token       = null;
let workspaceId = null;
const history   = [];

// ─── Helpers ──────────────────────────────────────────────────────────────

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  blue:   '\x1b[34m',
  gray:   '\x1b[90m',
};

let passCount = 0;
let failCount = 0;
let warnCount = 0;

function section(title) {
  console.log(`\n${C.bold}${'═'.repeat(64)}${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ${title}${C.reset}`);
  console.log(`${C.gray}${'─'.repeat(64)}${C.reset}`);
}

function step(label) {
  console.log(`\n${C.bold}▶ ${label}${C.reset}`);
}

function pass(msg)  { passCount++; console.log(`  ${C.green}✅ ${msg}${C.reset}`); }
function fail(msg)  { failCount++; console.log(`  ${C.red}❌ ${msg}${C.reset}`); }
function warn(msg)  { warnCount++; console.log(`  ${C.yellow}⚠️  ${msg}${C.reset}`); }
function info(msg)  { console.log(`  ${C.gray}ℹ  ${msg}${C.reset}`); }
function reply(msg) { console.log(`\n${C.dim}  ${msg.replace(/\n/g, '\n  ')}${C.reset}`); }

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

async function chat(message, label, opts = {}) {
  const { expectExecute = false, expectAgent = null, expectPage = null } = opts;
  step(label);
  info(`"${message}"`);

  const { status, data } = await api('POST', '/api/chat', { message, history, workspaceId });

  if (status !== 200) {
    fail(`HTTP ${status}: ${JSON.stringify(data)}`);
    return null;
  }

  history.push({ role: 'user',      content: message });
  // Use rawReply (includes EXECUTE block) so AI sees its own prior commands in context
  history.push({ role: 'assistant', content: data.rawReply || data.reply });

  reply(data.reply.slice(0, 300) + (data.reply.length > 300 ? '…' : ''));

  // Validate agent routing
  if (expectAgent) {
    if (data.agentType === expectAgent) pass(`agentType: ${data.agentType}`);
    else warn(`agentType: ${data.agentType} (expected ${expectAgent})`);
  } else {
    info(`agentType: ${data.agentType}`);
  }

  // Validate EXECUTE block
  if (data.command) {
    pass(`EXECUTE block → type: ${data.command.type}`);

    // Validate page targeting
    if (expectPage && data.command.spec?.pageName) {
      if (data.command.spec.pageName === expectPage)
        pass(`pageName: "${data.command.spec.pageName}"`);
      else
        warn(`pageName: "${data.command.spec.pageName}" (expected "${expectPage}")`);
    }

    // Validate tokenMappings presence for create_component
    if (data.command.type === 'create_component') {
      const hasTokenMappings = data.command.spec?.tokenMappings
        && Object.keys(data.command.spec.tokenMappings).length > 0;
      if (hasTokenMappings) {
        pass(`tokenMappings: ${Object.keys(data.command.spec.tokenMappings).length} entries`);
        Object.entries(data.command.spec.tokenMappings).slice(0, 4).forEach(([k, v]) =>
          info(`  "${k}" → "${v}"`)
        );
      } else {
        warn('tokenMappings missing — plugin will use fallback resolution');
      }

      const variantCount = data.command.spec?.variants?.length || 0;
      info(`variants: ${variantCount}`);
    }

    // Validate bulk set_variable_value
    if (data.command.type === 'set_variable_value') {
      const isArray = Array.isArray(data.command.spec);
      if (isArray) pass(`bulk set: ${data.command.spec.length} variables`);
      else info('single set_variable_value');
    }

    // Plugin status
    if (data.commandStatus === 'sent')      pass('Command SENT to Figma plugin ✨');
    else if (data.commandStatus === 'no_plugin') fail('Plugin not connected — command NOT sent');
    else info(`commandStatus: ${data.commandStatus}`);
  } else if (expectExecute) {
    fail('Expected EXECUTE block but none was produced');
  } else {
    info('No EXECUTE block (informational)');
  }

  return data;
}

// ─── Auth & Setup ──────────────────────────────────────────────────────────

async function setup() {
  section('SETUP');

  step('Login');
  const { status, data } = await api('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });
  if (status === 200 && data.token) {
    token = data.token;
    pass(`Logged in as ${data.user?.email}`);
  } else {
    fail(`Login failed: ${JSON.stringify(data)}`);
    process.exit(1);
  }

  step('Get Workspaces');
  const { status: ws, data: wd } = await api('GET', '/api/workspaces');
  const workspaces = wd.workspaces || wd;
  if (ws === 200 && workspaces.length > 0) {
    const preferred = workspaces.find(w => w.name.toLowerCase().includes('tokenhaus')) || workspaces[0];
    workspaceId = preferred.id;
    pass(`Using workspace: ${preferred.name}`);
    workspaces.forEach(w => info(`  [${w.id}] ${w.name}`));
  } else {
    fail('Could not get workspaces');
    process.exit(1);
  }
}

// ─── Phase 1: Foundation Tokens ───────────────────────────────────────────

async function phase1() {
  section('PHASE 1 — Foundation Tokens');

  await chat(
    'Ne var şu an sistemde? Kısaca özetle.',
    '1.1 — System snapshot',
    { expectAgent: 'design-system' }
  );

  await chat(
    `Komple bir renk sistemi oluştur. Şu katmanlar olsun:
- Primitives: neutral/0–900 (10 adım), brand/50–900 (6 adım), error/red (3 ton), success/green (3 ton), warning/amber (3 ton)
- Semantics: bg (default, subtle, inverse, overlay), text (primary, secondary, tertiary, disabled, inverse, on-brand), border (default, strong, focus, error), semantic (success, warning, error, info)
Her token bir primitife alias olsun.`,
    '1.2 — Full color system (primitives + semantics)',
    { expectExecute: true, expectAgent: 'design-system' }
  );

  await chat(
    `Spacing ve radius tokenlarını ekle:
- spacing/0→0, spacing/1→4, spacing/2→8, spacing/3→12, spacing/4→16, spacing/5→20, spacing/6→24, spacing/8→32, spacing/10→40, spacing/12→48, spacing/16→64, spacing/20→80
- radius/none→0, radius/xs→2, radius/sm→4, radius/md→8, radius/lg→12, radius/xl→16, radius/2xl→24, radius/full→9999`,
    '1.3 — Spacing & radius tokens',
    { expectExecute: true, expectAgent: 'design-system' }
  );

  await chat(
    `Typography tokenlarını da ekle:
- font-size/xs→12, sm→14, md→16, lg→18, xl→20, 2xl→24, 3xl→30, 4xl→36, 5xl→48
- font-weight/regular→400, medium→500, semibold→600, bold→700
- line-height/tight→1.25, normal→1.5, relaxed→1.75`,
    '1.4 — Typography scale tokens',
    { expectExecute: true, expectAgent: 'design-system' }
  );
}

// ─── Phase 2: Core Components ──────────────────────────────────────────────

async function phase2() {
  section('PHASE 2 — Core Components');

  await chat(
    `"Components/Buttons" sayfasında Button componenti oluştur.
Özellikler: Size (Small, Medium, Large), Type (Primary, Secondary, Ghost, Destructive, Link), State (Default, Hover, Pressed, Disabled, Loading).
Mevcut token sistemini inceleyerek tokenMappings'i doldur.`,
    '2.1 — Button (Components/Buttons page)',
    { expectExecute: true, expectAgent: 'design-system', expectPage: 'Components/Buttons' }
  );

  await chat(
    `"Components/Forms" sayfasında Input componenti oluştur.
Özellikler: Size (Small, Medium, Large), State (Default, Focus, Filled, Error, Disabled).
Label, placeholder, helper text katmanları olsun. tokenMappings ekle.`,
    '2.2 — Input (Components/Forms page)',
    { expectExecute: true, expectAgent: 'design-system', expectPage: 'Components/Forms' }
  );

  await chat(
    `"Components/Forms" sayfasında Checkbox componenti oluştur.
Özellikler: State (Unchecked, Checked, Indeterminate, Disabled).`,
    '2.3 — Checkbox (Components/Forms page)',
    { expectExecute: true, expectAgent: 'design-system', expectPage: 'Components/Forms' }
  );

  await chat(
    `"Components/Data Display" sayfasında Badge componenti oluştur.
Type: Default, Primary, Success, Warning, Destructive, Info.
Size: Small, Medium. tokenMappings ekle.`,
    '2.4 — Badge (Components/Data Display page)',
    { expectExecute: true, expectAgent: 'design-system', expectPage: 'Components/Data Display' }
  );

  await chat(
    `"Components/Data Display" sayfasında Avatar componenti oluştur.
Size: XSmall (24), Small (32), Medium (40), Large (48), XLarge (64).
Type: Image, Initials, Icon.`,
    '2.5 — Avatar (Components/Data Display page)',
    { expectExecute: true, expectAgent: 'design-system', expectPage: 'Components/Data Display' }
  );
}

// ─── Phase 3: Compound & Feedback Components ──────────────────────────────

async function phase3() {
  section('PHASE 3 — Compound & Feedback Components');

  await chat(
    `"Components/Feedback" sayfasında Alert componenti oluştur.
Type: Info, Success, Warning, Destructive. Her birinde icon alanı, title ve description olsun.
tokenMappings ekle.`,
    '3.1 — Alert (Components/Feedback page)',
    { expectExecute: true, expectAgent: 'design-system', expectPage: 'Components/Feedback' }
  );

  await chat(
    `"Components/Feedback" sayfasında Toast/Snackbar componenti oluştur.
Type: Default, Success, Warning, Error.
Position variant ekle: içerik hizalaması soldan.`,
    '3.2 — Toast (Components/Feedback page)',
    { expectExecute: true, expectAgent: 'design-system', expectPage: 'Components/Feedback' }
  );

  await chat(
    `"Components/Navigation" sayfasında Tab componenti oluştur.
State: Default, Active, Disabled. Size: Small, Medium, Large.`,
    '3.3 — Tab (Components/Navigation page)',
    { expectExecute: true, expectAgent: 'design-system', expectPage: 'Components/Navigation' }
  );

  await chat(
    `"Components/Data Display" sayfasında Card componenti oluştur.
Type: Default, Outlined, Elevated, Interactive.
Her varyant için bg, border, shadow state'lerini mevcut tokenlarla eşleştir.`,
    '3.4 — Card (Components/Data Display page)',
    { expectExecute: true, expectAgent: 'design-system', expectPage: 'Components/Data Display' }
  );
}

// ─── Phase 4: UX Evaluation ────────────────────────────────────────────────

async function phase4() {
  section('PHASE 4 — UX Evaluation');

  await chat(
    'Renk sistemimizi WCAG AA açısından değerlendir. text/primary ile bg/default, text/inverse ile brand/primary kombinasyonları için kontrast oranlarını hesapla.',
    '4.1 — WCAG contrast evaluation',
    { expectAgent: 'uiux' }
  );

  await chat(
    'Oluşturduğumuz component setini bir bütün olarak değerlendir. Eksik componentler var mı? Tasarım sistemi production-ready mi? Ne eklememiz gerekiyor?',
    '4.2 — System completeness audit',
    { expectAgent: 'uiux' }
  );

  await chat(
    'Button component\'imizin type hiyerarşisi doğru mu? Primary/Secondary/Ghost/Destructive kullanım senaryoları ve ne zaman hangisini kullanmamız gerektiği konusunda yönlendir.',
    '4.3 — Component pattern review',
    { expectAgent: 'uiux' }
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────

function summary() {
  const total = passCount + failCount + warnCount;
  section('TEST SUMMARY');
  console.log(`  ${C.green}✅ Passed:   ${passCount}${C.reset}`);
  console.log(`  ${C.yellow}⚠️  Warnings: ${warnCount}${C.reset}`);
  console.log(`  ${C.red}❌ Failed:   ${failCount}${C.reset}`);
  console.log(`  ${C.gray}   Total:    ${total}${C.reset}`);
  console.log(`\n  ${C.dim}Conversation turns: ${history.filter(m => m.role === 'user').length}${C.reset}`);
  console.log(`\n  ${C.bold}Check Figma for pages:${C.reset}`);
  console.log(`  ${C.dim}  • Foundation (tokens)${C.reset}`);
  console.log(`  ${C.dim}  • Components/Buttons${C.reset}`);
  console.log(`  ${C.dim}  • Components/Forms${C.reset}`);
  console.log(`  ${C.dim}  • Components/Data Display${C.reset}`);
  console.log(`  ${C.dim}  • Components/Feedback${C.reset}`);
  console.log(`  ${C.dim}  • Components/Navigation${C.reset}`);
  console.log('');

  if (failCount > 0) process.exit(1);
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${C.bold}${C.cyan}  🎨  Tokenhaus AI — Full Design System Test${C.reset}`);
  console.log(`  ${C.gray}Target: ${BASE_URL}${C.reset}`);
  console.log(`  ${C.gray}Time:   ${new Date().toISOString()}${C.reset}`);
  console.log(`  ${C.gray}Phase:  ${phaseArg ?? 'all'}${C.reset}`);

  await setup();

  if (!phaseArg || phaseArg === 1) await phase1();
  if (!phaseArg || phaseArg === 2) await phase2();
  if (!phaseArg || phaseArg === 3) await phase3();
  if (!phaseArg || phaseArg === 4) await phase4();

  summary();
}

main().catch(err => {
  console.error(`${C.red}Fatal error:${C.reset}`, err);
  process.exit(1);
});
