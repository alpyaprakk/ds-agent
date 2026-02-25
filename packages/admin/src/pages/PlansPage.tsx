import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getPlans, updatePlan, Plan } from '@/lib/admin-api';

const LIMIT_FIELDS: { key: keyof Plan; label: string; hint: string }[] = [
  { key: 'workspace_limit', label: 'Workspace Limit', hint: '-1 = unlimited' },
  { key: 'seat_limit', label: 'Seat Limit', hint: '-1 = unlimited' },
  { key: 'variable_limit', label: 'Variable Limit', hint: '-1 = unlimited' },
  { key: 'component_limit', label: 'Component Limit', hint: '-1 = unlimited' },
  { key: 'ai_messages_per_month', label: 'AI Messages / Month', hint: '-1 = unlimited' },
  { key: 'price_monthly_usd', label: 'Price (USD/mo)', hint: '0 = free' },
];

function formatLimit(n: number) {
  return n === -1 ? '∞' : n.toLocaleString();
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Plan>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getPlans();
      setPlans(res.plans);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const startEdit = (plan: Plan) => {
    setEditId(plan.id);
    setEditValues({
      display_name: plan.display_name,
      workspace_limit: plan.workspace_limit,
      seat_limit: plan.seat_limit,
      variable_limit: plan.variable_limit,
      component_limit: plan.component_limit,
      ai_messages_per_month: plan.ai_messages_per_month,
      price_monthly_usd: plan.price_monthly_usd,
    });
  };

  const handleSave = async () => {
    if (!editId) return;
    setSaving(true);
    try {
      await updatePlan(editId, editValues);
      toast.success('Plan updated');
      setEditId(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading plans...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Plans</h1>
        <p className="text-sm text-gray-500 mt-1">Manage plan limits and pricing</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {plans.map(plan => {
          const isEditing = editId === plan.id;
          const vals = isEditing ? editValues : plan;

          return (
            <div key={plan.id} className={`bg-white border rounded-xl overflow-hidden ${
              plan.name === 'pro' ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200'
            }`}>
              <div className={`px-5 py-4 border-b ${
                plan.name === 'pro' ? 'bg-gray-900' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    {isEditing ? (
                      <input
                        value={(vals as Partial<Plan>).display_name || ''}
                        onChange={e => setEditValues(v => ({ ...v, display_name: e.target.value }))}
                        className="font-bold text-lg bg-transparent border-b border-dashed border-gray-400 focus:outline-none text-inherit w-full"
                      />
                    ) : (
                      <h2 className={`font-bold text-lg ${plan.name === 'pro' ? 'text-white' : 'text-gray-900'}`}>
                        {plan.display_name}
                      </h2>
                    )}
                    <p className={`text-xs mt-0.5 font-mono ${plan.name === 'pro' ? 'text-gray-400' : 'text-gray-400'}`}>
                      {plan.name}
                    </p>
                  </div>
                  <span className={`text-sm ${plan.is_active ? (plan.name === 'pro' ? 'text-green-400' : 'text-green-600') : 'text-red-400'}`}>
                    {plan.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              <div className="px-5 py-4 space-y-3">
                {LIMIT_FIELDS.map(field => (
                  <div key={field.key} className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-700">{field.label}</p>
                      <p className="text-xs text-gray-400">{field.hint}</p>
                    </div>
                    {isEditing ? (
                      <input
                        type="number"
                        value={(vals as any)[field.key] ?? ''}
                        onChange={e => setEditValues(v => ({ ...v, [field.key]: parseFloat(e.target.value) }))}
                        className="w-24 text-right text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-900"
                      />
                    ) : (
                      <span className="text-sm font-mono font-medium text-gray-900">
                        {field.key === 'price_monthly_usd'
                          ? `$${Number(plan[field.key]).toFixed(2)}`
                          : formatLimit(plan[field.key] as number)}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="px-5 py-3 border-t border-gray-100 flex gap-2 justify-end">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setEditId(null)}
                      className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => startEdit(plan)}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
                  >
                    Edit Limits
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
