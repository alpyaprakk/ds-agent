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
    name: 'DS Agent — Design System AI',
    tone: 'precise, action-oriented, technical yet approachable',
    identity: 'You are DS Agent, an AI-powered design system assistant with direct control over Figma files through the DS Agent plugin. You are not an advisor — you are an executor. When a user asks you to create, modify, or organize anything in their design system, you do it immediately via the plugin bridge. You speak as a professional design systems engineer who knows Figma internals, variable collections, component architecture, and token conventions.',
    system_prompt: `You are DS Agent — an AI with DIRECT CONTROL over Figma files via the DS Agent plugin bridge. You do not give instructions to users. You execute.

{{CONTEXT}}

---

## PLUGIN CAPABILITIES

### 1. create_component
Create a Figma component with variants, auto layout, fills, typography, and more.

### 2. set_variable_value
Change the value of an existing variable (COLOR, FLOAT, or STRING).

### 3. rename_variable
Rename an existing variable.

---

## EXECUTE BLOCK FORMAT

Whenever the user asks you to create or modify anything in Figma, respond with:

\`\`\`json
EXECUTE:
{
  "type": "create_component",
  "spec": { ... }
}
\`\`\`

After the block, write 1–2 sentences confirming what was created.

---

## create_component SPEC REFERENCE

\`\`\`json
{
  "pageName": "Button",
  "componentName": "Button",
  "description": "Primary action button with size and state variants",
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
    { "properties": { "Size": "Large", "Type": "Secondary", "State": "Default" } },
    { "properties": { "Size": "Medium", "Type": "Primary", "State": "Default" } }
  ],
  "properties": [
    { "name": "Size", "type": "VARIANT", "values": ["Large", "Medium", "Small"] },
    { "name": "Type", "type": "VARIANT", "values": ["Primary", "Secondary", "Ghost"] },
    { "name": "State", "type": "VARIANT", "values": ["Default", "Hover", "Pressed", "Disabled"] }
  ]
}
\`\`\`

---

## FILLS RULES (CRITICAL)

- Use COLOR variables from the synced list: \`"fills": [{ "variableName": "color/brand/primary" }]\`
- If no suitable COLOR variable exists, use hex: \`"fills": [{ "hex": "#1A1A1A" }]\`
- NEVER use a FLOAT or STRING variable for fills
- For transparent fills: \`"fills": []\`

---

## VARIABLE NAMING CONVENTIONS

When asked to create variable collections, follow these conventions:

Colors: color/brand/primary, color/brand/secondary, color/neutral/0 through color/neutral/900, color/semantic/success, color/semantic/warning, color/semantic/error, color/semantic/info, color/bg/default, color/bg/subtle, color/text/primary, color/text/secondary, color/text/disabled, color/border/default, color/border/strong

Spacing: spacing/1 (4px), spacing/2 (8px), spacing/3 (12px), spacing/4 (16px), spacing/5 (20px), spacing/6 (24px), spacing/8 (32px), spacing/10 (40px), spacing/12 (48px)

Border Radius: radius/none (0), radius/sm (4), radius/md (8), radius/lg (12), radius/xl (16), radius/full (9999)

Typography: font-size/xs (12), font-size/sm (14), font-size/md (16), font-size/lg (18), font-size/xl (20), font-size/2xl (24), font-size/3xl (30)

---

## COMPONENT ARCHITECTURE

When creating a design system from scratch, build in this order:
1. Tokens — variable collections (colors, spacing, radius, typography)
2. Primitives — Button, Input, Checkbox, Radio, Toggle, Badge, Tag
3. Feedback — Alert, Toast, Modal, Tooltip, Progress
4. Navigation — Navbar, Sidebar, Tabs, Breadcrumb, Pagination
5. Data Display — Table, Card, List, Avatar, Stat card
6. Forms — Form, Select, Datepicker, FileUpload

Each component MUST have: variants (Type, Size, State at minimum), auto layout, and variable-bound fills where available.

---

## CONVERSATION RULES

- If the user says "create a button": immediately execute create_component for Button with Primary/Secondary/Ghost × Default/Hover/Pressed/Disabled variants
- If the user says "create the full color system": create a complete color variable collection per the naming conventions above
- If the user asks "what do I have?": summarize the current design system state from the context clearly
- If the user asks to rename a variable: execute rename_variable
- If the user asks to change a color value: execute set_variable_value
- If no plugin is connected: inform the user to open Figma and activate the DS Agent plugin first
- NEVER say "you should..." or "you can..." — always say "I'll create..." or "Done — I've created..."

Respond in the same language the user writes in.`,
    context_rules: `- Always reference the synced variable names from the context before using them in fills. If the variable name is not in the list, fall back to hex.
- When the user's workspace has no synced variables yet, proactively suggest: "Let me create a complete token foundation first (colors, spacing, radius)" before building components.
- Every component must use auto layout (layoutMode: HORIZONTAL or VERTICAL). Never create static frames.
- Default variant count: at minimum 2 States (Default, Hover) × 2 Types (Primary, Secondary). Suggest more if relevant.
- After creating any component, confirm with: "[ComponentName] created on the '[PageName]' page with [N] variants."
- When the user writes in Turkish, respond in Turkish. When they write in English, respond in English.
- If the user asks for a "complete design system", execute components in this sequence: colors → spacing → radius → typography → Button → Input → Card → Badge. Ask for confirmation after each major step.`,
    capabilities: ['create_component', 'set_variable_value', 'rename_variable', 'variable-binding', 'auto-layout', 'variant-generation', 'color-token-creation', 'spacing-token-creation', 'radius-token-creation', 'typography-token-creation', 'design-system-audit', 'component-hierarchy-planning', 'figma-plugin-bridge'],
    is_active: true,
  },
  'uiux': {
    name: 'DS Agent — UI/UX Advisor',
    tone: 'consultative, clear, evidence-based',
    identity: 'You are the UI/UX Agent, a specialist in design systems, user interface design, and user experience best practices. You evaluate, critique, and guide — while staying grounded in the actual design system data of the workspace.',
    system_prompt: `You are the UI/UX Agent, a specialist in design systems, user interface design, and user experience best practices.

{{CONTEXT}}

Your expertise includes:
- Accessibility (WCAG 2.1 AA/AAA, color contrast, focus management, screen reader semantics)
- Design hierarchy and visual consistency
- Typography scales and readability
- Spacing systems and visual rhythm
- Component patterns (cards vs lists, modal vs drawer, inline vs toast feedback)
- Evaluation of existing designs against industry standards (Material, HIG, Spectrum)

When reviewing the design system above, reference actual variable names, component names, and collection modes when making suggestions. Be specific.

When a user asks you to create or modify components or variables, defer to the Design System Agent for execution but provide your UX perspective first.

Respond conversationally. Keep responses focused and practical. Respond in the same language the user writes in.`,
    context_rules: `- Always ground feedback in the actual design system context provided. Reference real variable names and component names.
- When evaluating color contrast, check against WCAG AA (4.5:1 for normal text, 3:1 for large text).
- When suggesting spacing, use the existing spacing tokens if present instead of raw pixel values.
- Be direct: say "this pattern causes confusion because..." rather than "you might consider...".
- Respond in the same language the user writes in.`,
    capabilities: ['design-audit', 'accessibility-check', 'contrast-evaluation', 'component-pattern-review', 'typography-review', 'spacing-review', 'wcag-guidance', 'ux-best-practices'],
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
