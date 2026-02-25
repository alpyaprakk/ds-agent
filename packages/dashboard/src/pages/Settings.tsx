import { useState, useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { AiCloudIcon, Key01Icon, SaveMoneyDollarIcon } from '@hugeicons/core-free-icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useWorkspaceStore } from '@/store/workspace-store';
import { toast } from 'sonner';

interface AISettings {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  provider?: 'openai' | 'anthropic';
}

export function Settings() {
  const { currentWorkspace } = useWorkspaceStore();
  const [settings, setSettings] = useState<AISettings>({
    provider: 'anthropic'
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentWorkspace) {
      fetchSettings();
    }
  }, [currentWorkspace]);

  const fetchSettings = async () => {
    if (!currentWorkspace) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/workspaces/${currentWorkspace.id}/settings`
      );

      if (response.ok) {
        const data = await response.json();
        setSettings(data.ai || { provider: 'anthropic' });
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!currentWorkspace) {
      toast.error('No workspace selected');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/workspaces/${currentWorkspace.id}/settings`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ai: settings })
        }
      );

      if (response.ok) {
        toast.success('Settings saved successfully');
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const maskApiKey = (key: string | undefined) => {
    if (!key || key.length < 8) return '';
    return key.slice(0, 8) + '•'.repeat(32);
  };

  const hasApiKey = settings.openaiApiKey || settings.anthropicApiKey;

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Configure AI analysis and workspace preferences
          </p>
        </div>

        <Separator />

        {/* AI Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <HugeiconsIcon icon={AiCloudIcon} size={20} className="text-primary" />
              </div>
              <div>
                <CardTitle>AI Configuration</CardTitle>
                <CardDescription>
                  Configure AI providers for design system analysis
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Provider Selection */}
            <div className="space-y-3">
              <Label>AI Provider</Label>
              <div className="flex gap-3">
                <Button
                  variant={settings.provider === 'anthropic' ? 'default' : 'outline'}
                  onClick={() => setSettings({ ...settings, provider: 'anthropic' })}
                  className="flex-1"
                >
                  <HugeiconsIcon icon={AiCloudIcon} size={18} className="mr-2" />
                  Anthropic Claude
                  <Badge variant="secondary" className="ml-2">Recommended</Badge>
                </Button>
                <Button
                  variant={settings.provider === 'openai' ? 'default' : 'outline'}
                  onClick={() => setSettings({ ...settings, provider: 'openai' })}
                  className="flex-1"
                >
                  <HugeiconsIcon icon={AiCloudIcon} size={18} className="mr-2" />
                  OpenAI GPT
                </Button>
              </div>
            </div>

            <Separator />

            {/* API Keys */}
            {settings.provider === 'anthropic' && (
              <div className="space-y-3">
                <Label htmlFor="anthropic-key">
                  <div className="flex items-center gap-2">
                    <HugeiconsIcon icon={Key01Icon} size={16} />
                    Anthropic API Key
                  </div>
                </Label>
                <Input
                  id="anthropic-key"
                  type="password"
                  placeholder="sk-ant-..."
                  value={settings.anthropicApiKey || ''}
                  onChange={(e) => setSettings({ ...settings, anthropicApiKey: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Get your API key from{' '}
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Anthropic Console
                  </a>
                </p>
              </div>
            )}

            {settings.provider === 'openai' && (
              <div className="space-y-3">
                <Label htmlFor="openai-key">
                  <div className="flex items-center gap-2">
                    <HugeiconsIcon icon={Key01Icon} size={16} />
                    OpenAI API Key
                  </div>
                </Label>
                <Input
                  id="openai-key"
                  type="password"
                  placeholder="sk-..."
                  value={settings.openaiApiKey || ''}
                  onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Get your API key from{' '}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    OpenAI Platform
                  </a>
                </p>
              </div>
            )}

            {/* Status */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${hasApiKey ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-sm font-medium">
                  {hasApiKey ? 'AI Ready' : 'API Key Required'}
                </span>
              </div>
              {hasApiKey && (
                <Badge variant="secondary">
                  Key: {maskApiKey(settings.provider === 'anthropic' ? settings.anthropicApiKey : settings.openaiApiKey)}
                </Badge>
              )}
            </div>

            {/* Save Button */}
            <Button
              onClick={saveSettings}
              disabled={saving || loading}
              className="w-full"
            >
              <HugeiconsIcon icon={SaveMoneyDollarIcon} size={18} className="mr-2" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </CardContent>
        </Card>

        {/* AI Features Info */}
        <Card>
          <CardHeader>
            <CardTitle>AI-Powered Features</CardTitle>
            <CardDescription>
              What you can do with AI analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 flex-shrink-0">
                  <span className="text-blue-500">🔍</span>
                </div>
                <div>
                  <p className="font-medium text-sm">Design System Analysis</p>
                  <p className="text-xs text-muted-foreground">
                    Automatically analyze your Figma files for conflicts, naming inconsistencies, and token errors
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 flex-shrink-0">
                  <span className="text-purple-500">⚡</span>
                </div>
                <div>
                  <p className="font-medium text-sm">Smart Conflict Resolution</p>
                  <p className="text-xs text-muted-foreground">
                    Get AI-powered suggestions to resolve variable conflicts and component issues
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10 flex-shrink-0">
                  <span className="text-green-500">🤖</span>
                </div>
                <div>
                  <p className="font-medium text-sm">Auto-Fix with Bridge Plugin</p>
                  <p className="text-xs text-muted-foreground">
                    Apply AI-generated fixes directly to your Figma files via the Bridge Plugin
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 flex-shrink-0">
                  <span className="text-orange-500">💬</span>
                </div>
                <div>
                  <p className="font-medium text-sm">Interactive AI Chat</p>
                  <p className="text-xs text-muted-foreground">
                    Chat with AI to understand problems and get step-by-step solutions
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
