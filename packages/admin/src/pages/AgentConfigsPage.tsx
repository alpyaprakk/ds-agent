import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getAgentConfigs, getWorkspaces, getWorkspaceAgentConfigs, saveAgentConfig, AgentConfigRow, AdminWorkspaceRow } from '@/lib/admin-api';

const AGENT_TYPES = ['design-system', 'uiux'];

const DEFAULT_CONFIG: Partial<AgentConfigRow> = {
  name: '',
  identity: '',
  tone: '',
  system_prompt: '',
  context_rules: '',
  capabilities: [],
  is_active: true,
};

export default function AgentConfigsPage() {
  const [allConfigs, setAllConfigs] = useState<AgentConfigRow[]>([]);
  const [workspaces, setWorkspaces] = useState<AdminWorkspaceRow[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [selectedAgentType, setSelectedAgentType] = useState<string>(AGENT_TYPES[0]);
  const [form, setForm] = useState<Partial<AgentConfigRow>>(DEFAULT_CONFIG);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load all workspaces + all configs overview
  useEffect(() => {
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
    loadAll();
  }, []);

  // Load config when workspace + type selection changes
  useEffect(() => {
    if (!selectedWorkspaceId) return;
    const loadConfig = async () => {
      setLoadingConfigs(true);
      try {
        const res = await getWorkspaceAgentConfigs(selectedWorkspaceId);
        const found = res.configs.find(c => c.agent_type === selectedAgentType);
        setForm(found || { ...DEFAULT_CONFIG, agent_type: selectedAgentType });
      } catch {
        setForm({ ...DEFAULT_CONFIG, agent_type: selectedAgentType });
      } finally {
        setLoadingConfigs(false);
      }
    };
    loadConfig();
  }, [selectedWorkspaceId, selectedAgentType]);

  const handleSave = async () => {
    if (!selectedWorkspaceId) return;
    setSaving(true);
    try {
      await saveAgentConfig(selectedWorkspaceId, selectedAgentType, form);
      toast.success('Agent config saved');
      // Refresh overview
      const cfgRes = await getAgentConfigs();
      setAllConfigs(cfgRes.configs);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const configuredCount = new Set(allConfigs.map(c => c.workspace_id)).size;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Agent Configs</h1>
        <p className="text-sm text-gray-500 mt-1">
          {loadingAll ? 'Loading...' : `${allConfigs.length} configurations across ${configuredCount} workspaces`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Workspace + Type selector */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Select Workspace</h2>
            <select
              value={selectedWorkspaceId}
              onChange={e => setSelectedWorkspaceId(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="">— Choose workspace —</option>
              {workspaces.map(ws => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>

            {selectedWorkspaceId && (
              <div className="mt-3 flex gap-2">
                {AGENT_TYPES.map(type => (
                  <button
                    key={type}
                    onClick={() => setSelectedAgentType(type)}
                    className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${
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

          {/* Overview list */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">All Configs</h2>
            {loadingAll ? (
              <p className="text-xs text-gray-400">Loading...</p>
            ) : allConfigs.length === 0 ? (
              <p className="text-xs text-gray-400">No configs yet</p>
            ) : (
              <div className="space-y-2">
                {allConfigs.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedWorkspaceId(c.workspace_id);
                      setSelectedAgentType(c.agent_type);
                    }}
                    className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                      selectedWorkspaceId === c.workspace_id && selectedAgentType === c.agent_type
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <p className="text-xs font-medium text-gray-900 truncate">{c.workspace_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{c.agent_type}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Config form */}
        <div className="lg:col-span-2">
          {!selectedWorkspaceId ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 flex items-center justify-center">
              <p className="text-gray-400 text-sm">Select a workspace to view or edit its agent config</p>
            </div>
          ) : loadingConfigs ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 flex items-center justify-center">
              <p className="text-gray-400 text-sm">Loading config...</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    {workspaces.find(w => w.id === selectedWorkspaceId)?.name} — {selectedAgentType}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {form.is_active ? 'Active config' : 'Inactive config'}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={!!form.is_active}
                    onChange={e => setForm(v => ({ ...v, is_active: e.target.checked }))}
                    className="rounded"
                  />
                  Active
                </label>
              </div>

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
                    placeholder="Custom system prompt for this agent..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Context Rules</label>
                  <textarea
                    value={form.context_rules || ''}
                    onChange={e => setForm(v => ({ ...v, context_rules: e.target.value }))}
                    rows={4}
                    placeholder="Rules for how the agent uses the design system context..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Capabilities <span className="text-gray-400">(comma-separated)</span>
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

              <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40"
                >
                  {saving ? 'Saving...' : 'Save Config'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
