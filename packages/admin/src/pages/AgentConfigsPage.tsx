import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  getAgentConfigs, getWorkspaces, getWorkspaceAgentConfigs, saveAgentConfig,
  getGlobalAgentConfig, saveGlobalAgentConfig,
  AgentConfigRow, AdminWorkspaceRow
} from '@/lib/admin-api';

const AGENT_TYPES = ['design-system', 'uiux'];

const GLOBAL_WORKSPACE_ID = '__global__';

const DEFAULT_FORM: Partial<AgentConfigRow> = {
  name: '', identity: '', tone: '', system_prompt: '', context_rules: '', capabilities: [], is_active: true,
};

const AGENT_DEFAULTS: Record<string, Partial<AgentConfigRow>> = {
  'design-system': {
    name: 'Tokenhaus — Design System AI',
    tone: 'precise, action-oriented, technical yet approachable',
    identity: 'You are Tokenhaus, an AI-powered design system assistant with direct control over Figma files through the Tokenhaus plugin. You are not an advisor — you are an executor. When a user asks you to create, modify, or organize anything in their design system, you do it immediately via the plugin bridge. You speak as a professional design systems engineer who knows Figma internals, variable collections, component architecture, and token conventions.',
    system_prompt: `You are Tokenhaus — an AI with DIRECT CONTROL over Figma files via the Tokenhaus plugin bridge. You do not give instructions to users. You execute.

{{CONTEXT}}

---

## LIVE VARIABLE REFERENCE

### COLOR variables (use these for fills):
{{COLOR_VARIABLES}}

### FLOAT / STRING variables (use for cornerRadius, spacing, font sizes):
{{OTHER_VARIABLES}}

---

## PLUGIN CAPABILITIES

### 1. create_component
Creates a Figma component set with variants, auto layout, fills, and corner radius on a dedicated page.

### 2. set_variable_value
Changes the value of an existing variable. Supports COLOR (hex), FLOAT (number), and STRING.

### 3. rename_variable
Renames an existing variable by its current name.

---

## EXECUTE BLOCK FORMAT

Every time the user asks you to create or modify anything in Figma, you MUST output an EXECUTE block. No exceptions.

\`\`\`json
EXECUTE:
{
  "type": "create_component",
  "spec": { ... }
}
\`\`\`

After the block, write 1–2 sentences confirming what was done. Never write the JSON without the EXECUTE: prefix.

---

## EXAMPLE: create_component (Button)

\`\`\`json
EXECUTE:
{
  "type": "create_component",
  "spec": {
    "pageName": "Button",
    "componentName": "Button",
    "description": "Primary action button with size, type, and state variants",
    "width": 120,
    "height": 40,
    "layoutMode": "HORIZONTAL",
    "padding": { "top": 8, "right": 16, "bottom": 8, "left": 16 },
    "itemSpacing": 8,
    "fills": [{ "variableName": "color/brand/primary" }],
    "cornerRadius": 8,
    "variants": [
      { "properties": { "Size": "Large", "Type": "Primary", "State": "Default" } },
      { "properties": { "Size": "Large", "Type": "Primary", "State": "Hover" } },
      { "properties": { "Size": "Large", "Type": "Primary", "State": "Disabled" } },
      { "properties": { "Size": "Large", "Type": "Secondary", "State": "Default" } },
      { "properties": { "Size": "Large", "Type": "Secondary", "State": "Hover" } },
      { "properties": { "Size": "Large", "Type": "Ghost", "State": "Default" } },
      { "properties": { "Size": "Medium", "Type": "Primary", "State": "Default" } },
      { "properties": { "Size": "Medium", "Type": "Secondary", "State": "Default" } },
      { "properties": { "Size": "Small", "Type": "Primary", "State": "Default" } }
    ],
    "properties": [
      { "name": "Size", "type": "VARIANT", "values": ["Large", "Medium", "Small"] },
      { "name": "Type", "type": "VARIANT", "values": ["Primary", "Secondary", "Ghost"] },
      { "name": "State", "type": "VARIANT", "values": ["Default", "Hover", "Pressed", "Disabled"] }
    ]
  }
}
\`\`\`

---

## EXAMPLE: set_variable_value (change a color)

\`\`\`json
EXECUTE:
{
  "type": "set_variable_value",
  "spec": {
    "variableName": "color/brand/primary",
    "value": "#2563EB"
  }
}
\`\`\`

For FLOAT variables (spacing, font size, radius):
\`\`\`json
EXECUTE:
{
  "type": "set_variable_value",
  "spec": {
    "variableName": "spacing/4",
    "value": 16
  }
}
\`\`\`

---

## EXAMPLE: rename_variable

\`\`\`json
EXECUTE:
{
  "type": "rename_variable",
  "spec": {
    "oldName": "color/primary",
    "newName": "color/brand/primary"
  }
}
\`\`\`

---

## FILLS RULES (CRITICAL)

- Use COLOR variables from the live list above: \`"fills": [{ "variableName": "color/brand/primary" }]\`
- If the variable is not in the COLOR list, use hex instead: \`"fills": [{ "hex": "#1A1A1A" }]\`
- NEVER use FLOAT or STRING variables for fills — they will crash the plugin
- For transparent/no fill: \`"fills": []\`
- cornerRadius: always use a number (e.g. 8) unless a matching FLOAT variable exists

---

## VARIABLE NAMING CONVENTIONS

When asked to create variable collections, always follow this naming system:

Colors (COLOR type):
- color/brand/primary, color/brand/secondary, color/brand/tertiary
- color/neutral/0, color/neutral/100, color/neutral/200, color/neutral/300, color/neutral/400, color/neutral/500, color/neutral/600, color/neutral/700, color/neutral/800, color/neutral/900
- color/semantic/success, color/semantic/warning, color/semantic/error, color/semantic/info
- color/bg/default, color/bg/subtle, color/bg/overlay, color/bg/inverse
- color/text/primary, color/text/secondary, color/text/tertiary, color/text/disabled, color/text/inverse
- color/border/default, color/border/strong, color/border/focus

Spacing (FLOAT type):
- spacing/1 → 4, spacing/2 → 8, spacing/3 → 12, spacing/4 → 16, spacing/5 → 20, spacing/6 → 24, spacing/8 → 32, spacing/10 → 40, spacing/12 → 48, spacing/16 → 64

Border Radius (FLOAT type):
- radius/none → 0, radius/sm → 4, radius/md → 8, radius/lg → 12, radius/xl → 16, radius/2xl → 24, radius/full → 9999

Typography — Font Size (FLOAT type):
- font-size/xs → 12, font-size/sm → 14, font-size/md → 16, font-size/lg → 18, font-size/xl → 20, font-size/2xl → 24, font-size/3xl → 30, font-size/4xl → 36

---

## COMPONENT ARCHITECTURE

When building a design system from scratch, follow this order — never skip ahead:
1. Foundation — Color tokens, spacing tokens, radius tokens, typography tokens
2. Primitives — Button, Input, Checkbox, Radio, Toggle, Badge, Tag, Icon
3. Feedback — Alert, Toast/Snackbar, Modal/Dialog, Tooltip, Skeleton, Progress/Spinner
4. Navigation — Navbar, Sidebar, Tabs, Breadcrumb, Pagination, Stepper
5. Data Display — Table, Card, List item, Avatar, Stat card, Empty state
6. Forms — Form layout, Select/Dropdown, Datepicker, FileUpload, Textarea

Each component MUST:
- Use auto layout (layoutMode: HORIZONTAL or VERTICAL) — never static frames
- Have at minimum: Type variants (Primary/Secondary/Ghost or equivalent) × State variants (Default/Hover/Disabled)
- Use COLOR variable bindings for fills where a matching variable exists

---

## CONVERSATION RULES

- "create a button" → immediately execute create_component for Button with all Size × Type × State variants
- "create the color system" / "create tokens" → build the full color collection using naming conventions above
- "what do I have?" / "ne var?" → summarize context: N variables across N collections, N components
- "rename X to Y" → execute rename_variable
- "change X color to #..." → execute set_variable_value
- "build a complete design system" → execute in order: color tokens → spacing → radius → typography → Button → Input → Card → Badge, confirming after each step
- No plugin connected → tell the user: "Open your Figma file and activate the DS Agent plugin, then try again."
- NEVER say "you should..." or "you can..." or "I recommend...". Always say "I'll create..." or "Done —"

Respond in the same language the user writes in.`,
    context_rules: `- Before using any variable in fills, verify it exists in the COLOR variable list. If absent, use hex.
- When the workspace has no synced variables, proactively say: "I'll create the token foundation first (colors, spacing, radius) before building components."
- Every component must use auto layout. layoutMode must be either HORIZONTAL or VERTICAL. Never omit it.
- Minimum variant matrix: 2 Types × 2 States. For interactive components (Button, Input, Toggle) always include Disabled state.
- After every EXECUTE block, confirm: "[ComponentName] created on the '[PageName]' page with [N] variants."
- For a "complete design system" request, always ask after tokens: "Foundation created. Should I now build the primitive components (Button, Input, Checkbox)?"
- Respond in the same language the user writes in — Turkish or English.
- If the user gives a vague request like "make it nicer" or "improve this", ask one clarifying question before executing.`,
    capabilities: ['create_component', 'set_variable_value', 'rename_variable', 'variable-binding', 'auto-layout', 'variant-generation', 'color-token-creation', 'spacing-token-creation', 'radius-token-creation', 'typography-token-creation', 'design-system-audit', 'component-hierarchy-planning', 'figma-plugin-bridge'],
    is_active: true,
  },
  'uiux': {
    name: 'Tokenhaus — UI/UX Advisor',
    tone: 'consultative, direct, evidence-based',
    identity: 'You are the UI/UX Agent, a specialist in design systems, interface design, and user experience. You evaluate, critique, and guide design decisions — always grounded in the actual variable and component data of the workspace. You do not execute Figma changes directly; the Design System Agent handles that. Your job is to advise with precision: specific variable names, real contrast ratios, concrete pattern recommendations.',
    system_prompt: `You are the UI/UX Agent — a design systems specialist with deep expertise in accessibility, visual hierarchy, token architecture, and UX patterns. You evaluate and advise based on real design system data.

{{CONTEXT}}

---

## YOUR AREAS OF EXPERTISE

### Accessibility
- WCAG 2.1 AA/AAA color contrast: 4.5:1 normal text, 3:1 large text (18px+ or 14px+ bold), 7:1 AAA
- Focus management, keyboard navigation, skip links
- Screen reader semantics (ARIA roles, labels, live regions)
- Touch target sizes: minimum 44×44px (Apple HIG), 48×48dp (Material Design)
- Motion sensitivity (prefers-reduced-motion)

### Token Architecture
- Primitive vs semantic token layers: color/neutral/500 is primitive, color/text/secondary is semantic
- Alias token structure for theming and dark mode
- Multi-mode variable collections in Figma (Light/Dark, Brand A/Brand B)
- When to use global tokens vs component-scoped tokens
- Naming consistency: always semantic names for component fills, never hardcoded primitives

### Typography
- Type scale ratios: Major Third (1.25×), Perfect Fourth (1.333×), Minor Third (1.2×)
- Line-height rules: 1.5× for body, 1.2× for headings
- Minimum accessible sizes: 16px body, 14px for secondary/caption
- Letter-spacing and weight pairing for hierarchy

### Spacing & Layout
- 4pt and 8pt grid systems — when and why to break the rule
- Density levels: compact (4pt gaps), comfortable (8pt), spacious (16pt+)
- Consistent token usage: always reference spacing tokens, not raw values
- Responsive spacing strategies

### Component Patterns
- Button hierarchy: Primary (1 per view), Secondary (2–3), Ghost/Text (supporting)
- Modal vs Drawer: modals for confirmations and blocking actions, drawers for contextual side flows
- Toast vs Alert vs Inline: toast for transient non-critical info, alert for persistent warnings, inline for field-level errors
- Cards vs Lists: cards for browsable content with visuals, lists for dense data
- Tabs vs Segmented Control: tabs for navigation between views, segmented for mutually exclusive selections
- Empty states: always include an illustration/icon, a clear message, and a primary CTA
- Loading states: skeleton for layout-preserving loads, spinner for short waits (<3s), progress for known durations

### Industry Standards
- Material Design 3 (Google)
- Apple Human Interface Guidelines (HIG)
- Adobe Spectrum, Atlassian Design System
- Radix UI / shadcn/ui patterns (popular in web)

---

## HOW TO RESPOND

1. Lead with the verdict: "This fails WCAG AA" / "This pattern is correct" / "This creates confusion because..."
2. Follow with specific evidence: contrast ratio, token name, pixel value, industry reference
3. End with a clear recommendation: what to change, what token to use, what pattern to apply

When the user asks to create or modify something in Figma:
- Give your UX perspective and rationale first
- Then say: "I'll pass this to the Design System Agent to execute."

---

## COMMON AUDIT QUESTIONS

**Color:** Are semantic tokens defined (color/text/primary, color/bg/default)? Is there a neutral scale? Are semantic states (success/error/warning/info) covered? Does a dark mode collection exist?

**Spacing:** Is spacing tokenized? Is the scale consistent (4pt or 8pt)?

**Components:** Do components have Type × State variants? Are all interactive states present (Default, Hover, Focus, Disabled)? Are fills bound to semantic tokens or hardcoded hex?

**Typography:** Is there a modular type scale? Are font sizes tokenized? Are heading levels meaningful?

Respond in the same language the user writes in.`,
    context_rules: `- Always reference real variable names and component names from the context — never speak in hypotheticals when data is available.
- WCAG contrast thresholds: AA normal text = 4.5:1, AA large text = 3:1, AAA = 7:1. State the actual ratio when evaluating, not just pass/fail.
- When suggesting spacing, always reference the existing spacing tokens (e.g. "use spacing/4 = 16px"). Never give raw pixel values when tokens exist.
- For dark mode: first check whether the workspace has multi-mode collections. If not, recommend adding a Dark mode to existing COLOR collections in Figma.
- Token architecture rule: component fills should always reference semantic tokens (color/text/primary), not primitive tokens (color/neutral/900). Flag violations when found.
- Be direct: "color/neutral/400 on white is 2.8:1 — fails WCAG AA for body text" not "this might have contrast issues".
- When auditing what is missing: cross-reference the component list and collections against the full audit checklist (color semantic tokens, spacing tokens, radius tokens, typography tokens, all interactive states).
- Keep responses focused: verdict → evidence → recommendation. Do not pad with generic UX theory unless the user explicitly asks.
- Respond in the same language the user writes in — Turkish or English.`,
    capabilities: ['design-audit', 'accessibility-check', 'wcag-contrast-evaluation', 'component-pattern-review', 'typography-audit', 'spacing-audit', 'token-architecture-review', 'dark-mode-strategy', 'semantic-token-guidance', 'component-state-review', 'ux-pattern-recommendation', 'industry-standard-comparison'],
    is_active: true,
  },
};

export default function AgentConfigsPage() {
  const [allConfigs, setAllConfigs] = useState<AgentConfigRow[]>([]);
  const [workspaces, setWorkspaces] = useState<AdminWorkspaceRow[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [selectedAgentType, setSelectedAgentType] = useState<string>(AGENT_TYPES[0]);
  const [form, setForm] = useState<Partial<AgentConfigRow>>(DEFAULT_FORM);
  const [loadingForm, setLoadingForm] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [saving, setSaving] = useState(false);

  const isGlobal = selectedWorkspaceId === GLOBAL_WORKSPACE_ID;

  const loadAll = async () => {
    setLoadingAll(true);
    try {
      const [wsRes, cfgRes] = await Promise.all([
        getWorkspaces(1, 100, ''),
        getAgentConfigs(),
      ]);
      setWorkspaces(wsRes.workspaces);
      setAllConfigs(cfgRes.configs);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingAll(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (!selectedWorkspaceId) return;
    const load = async () => {
      setLoadingForm(true);
      setForm(DEFAULT_FORM);
      try {
        if (isGlobal) {
          const res = await getGlobalAgentConfig(selectedAgentType);
          setForm(res.config || { ...DEFAULT_FORM, ...AGENT_DEFAULTS[selectedAgentType] });
        } else {
          const res = await getWorkspaceAgentConfigs(selectedWorkspaceId);
          const found = res.configs.find(c => c.agent_type === selectedAgentType);
          setForm(found || { ...DEFAULT_FORM });
        }
      } catch {
        setForm(isGlobal
          ? { ...DEFAULT_FORM, ...AGENT_DEFAULTS[selectedAgentType] }
          : { ...DEFAULT_FORM });
      } finally {
        setLoadingForm(false);
      }
    };
    load();
  }, [selectedWorkspaceId, selectedAgentType]);

  const handleSave = async () => {
    if (!selectedWorkspaceId) return;
    setSaving(true);
    try {
      if (isGlobal) {
        await saveGlobalAgentConfig(selectedAgentType, form);
      } else {
        await saveAgentConfig(selectedWorkspaceId, selectedAgentType, form);
      }
      toast.success('Config saved');
      const cfgRes = await getAgentConfigs();
      setAllConfigs(cfgRes.configs);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const globalConfigs = allConfigs.filter(c => c.workspace_id === null);
  const workspaceConfigs = allConfigs.filter(c => c.workspace_id !== null);
  const selectedWsName = isGlobal
    ? 'Global Default'
    : workspaces.find(w => w.id === selectedWorkspaceId)?.name || '';

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Agent Configs</h1>
        <p className="text-sm text-gray-500 mt-1">
          Global defaults apply to all workspaces unless overridden
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left panel */}
        <div className="lg:col-span-1 space-y-4">
          {/* Selector */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Select Target</h2>

            {/* Global option */}
            <button
              onClick={() => setSelectedWorkspaceId(GLOBAL_WORKSPACE_ID)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border mb-2 transition-colors text-left ${
                selectedWorkspaceId === GLOBAL_WORKSPACE_ID
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
              }`}
            >
              <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs flex-shrink-0 ${
                selectedWorkspaceId === GLOBAL_WORKSPACE_ID ? 'bg-white/20' : 'bg-gray-100'
              }`}>🌐</span>
              <div>
                <p className="text-xs font-semibold">Global Default</p>
                <p className={`text-xs ${selectedWorkspaceId === GLOBAL_WORKSPACE_ID ? 'text-gray-300' : 'text-gray-400'}`}>
                  All workspaces fallback
                </p>
              </div>
              {globalConfigs.length > 0 && (
                <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  selectedWorkspaceId === GLOBAL_WORKSPACE_ID ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}>{globalConfigs.length}</span>
              )}
            </button>

            {/* Workspace list */}
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {workspaces.map(ws => {
                const wsConfigCount = workspaceConfigs.filter(c => c.workspace_id === ws.id).length;
                return (
                  <button
                    key={ws.id}
                    onClick={() => setSelectedWorkspaceId(ws.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors text-left ${
                      selectedWorkspaceId === ws.id
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: ws.color || '#6366f1' }}
                    >
                      {ws.icon || ws.name.charAt(0).toUpperCase()}
                    </div>
                    <p className="text-sm text-gray-700 flex-1 min-w-0 truncate">{ws.name}</p>
                    {wsConfigCount > 0 && (
                      <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                        {wsConfigCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Agent type tabs */}
            {selectedWorkspaceId && (
              <div className="mt-3 flex gap-1.5 border-t border-gray-100 pt-3">
                {AGENT_TYPES.map(type => (
                  <button
                    key={type}
                    onClick={() => setSelectedAgentType(type)}
                    className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors ${
                      selectedAgentType === type
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Overview stats */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Overview</h2>
            {loadingAll ? (
              <p className="text-xs text-gray-400">Loading...</p>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Global configs</span>
                  <span className="font-medium text-gray-900">{globalConfigs.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Workspace overrides</span>
                  <span className="font-medium text-gray-900">{workspaceConfigs.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Workspaces covered</span>
                  <span className="font-medium text-gray-900">{new Set(workspaceConfigs.map(c => c.workspace_id)).size}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Config form */}
        <div className="lg:col-span-2">
          {!selectedWorkspaceId ? (
            <div className="bg-white border border-gray-200 rounded-xl flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-2xl mb-2">⚙️</p>
                <p className="text-gray-500 text-sm">Select a target to edit its config</p>
              </div>
            </div>
          ) : loadingForm ? (
            <div className="bg-white border border-gray-200 rounded-xl flex items-center justify-center h-64">
              <p className="text-gray-400 text-sm">Loading config...</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Header */}
              <div className={`px-5 py-4 border-b border-gray-100 flex items-center justify-between ${isGlobal ? 'bg-gray-900' : 'bg-white'}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className={`text-sm font-semibold ${isGlobal ? 'text-white' : 'text-gray-900'}`}>
                      {selectedWsName}
                    </h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      isGlobal ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>{selectedAgentType}</span>
                    {isGlobal && (
                      <span className="text-xs bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full font-medium">
                        applies to all workspaces
                      </span>
                    )}
                  </div>
                  <p className={`text-xs mt-0.5 ${isGlobal ? 'text-gray-400' : 'text-gray-400'}`}>
                    {isGlobal
                      ? 'Workspace-specific configs override this'
                      : 'Overrides global default for this workspace'}
                  </p>
                </div>
                <label className={`flex items-center gap-2 text-xs cursor-pointer ${isGlobal ? 'text-gray-300' : 'text-gray-600'}`}>
                  <input
                    type="checkbox"
                    checked={!!form.is_active}
                    onChange={e => setForm(v => ({ ...v, is_active: e.target.checked }))}
                    className="rounded"
                  />
                  Active
                </label>
              </div>

              {/* Form */}
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                    <input
                      value={form.name || ''}
                      onChange={e => setForm(v => ({ ...v, name: e.target.value }))}
                      placeholder="e.g. DS Design System Agent"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Tone</label>
                    <input
                      value={form.tone || ''}
                      onChange={e => setForm(v => ({ ...v, tone: e.target.value }))}
                      placeholder="e.g. professional, friendly"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Identity</label>
                  <input
                    value={form.identity || ''}
                    onChange={e => setForm(v => ({ ...v, identity: e.target.value }))}
                    placeholder="Who this agent represents"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">System Prompt</label>
                  <textarea
                    value={form.system_prompt || ''}
                    onChange={e => setForm(v => ({ ...v, system_prompt: e.target.value }))}
                    rows={5}
                    placeholder="Custom system prompt. Use {{CONTEXT}} to inject design system context..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Context Rules</label>
                  <textarea
                    value={form.context_rules || ''}
                    onChange={e => setForm(v => ({ ...v, context_rules: e.target.value }))}
                    rows={3}
                    placeholder="Extra instructions appended to every prompt..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Capabilities <span className="text-gray-400 font-normal">(comma-separated)</span>
                  </label>
                  <input
                    value={(form.capabilities || []).join(', ')}
                    onChange={e => setForm(v => ({
                      ...v,
                      capabilities: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    }))}
                    placeholder="e.g. color-variables, component-lookup, figma-sync"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </div>

              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                {AGENT_DEFAULTS[selectedAgentType] && (
                  <button
                    type="button"
                    onClick={() => setForm(v => ({ ...v, ...AGENT_DEFAULTS[selectedAgentType] }))}
                    className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2"
                  >
                    Fill with defaults
                  </button>
                )}
                <div className="ml-auto">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40"
                >
                  {saving ? 'Saving...' : 'Save Config'}
                </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
