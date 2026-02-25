import { useState, useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { AiCloudIcon, Key01Icon, SaveMoneyDollarIcon, User02Icon, FigmaIcon } from '@hugeicons/core-free-icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/store/auth-store';
import { toast } from 'sonner';

export function Settings() {
  const { user, settings: userSettings, fetchSettings, updateSettings, updateProfile } = useAuthStore();

  const [aiProvider, setAiProvider] = useState<'anthropic' | 'openai'>('anthropic');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [figmaToken, setFigmaToken] = useState('');
  const [profileName, setProfileName] = useState('');
  const [savingKeys, setSavingKeys] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (userSettings) {
      setAiProvider((userSettings.ai_provider as 'anthropic' | 'openai') || 'anthropic');
    }
  }, [userSettings]);

  useEffect(() => {
    if (user) {
      setProfileName(user.name);
    }
  }, [user]);

  const saveApiKeys = async () => {
    setSavingKeys(true);
    try {
      await updateSettings({
        ai_provider: aiProvider,
        ...(anthropicKey ? { anthropic_api_key: anthropicKey } : {}),
        ...(openaiKey ? { openai_api_key: openaiKey } : {}),
        ...(figmaToken ? { figma_access_token: figmaToken } : {}),
      });
      // Clear input fields after save
      setAnthropicKey('');
      setOpenaiKey('');
      setFigmaToken('');
      toast.success('Settings saved successfully');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSavingKeys(false);
    }
  };

  const saveProfile = async () => {
    if (!profileName.trim()) {
      toast.error('Name is required');
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfile({ name: profileName.trim() });
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your profile, API keys, and preferences
          </p>
        </div>

        <Separator />

        {/* Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <HugeiconsIcon icon={User02Icon} size={20} className="text-primary" />
              </div>
              <div>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Your personal information</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user?.avatar || ''} />
                <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                  {user ? getInitials(user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{user?.name}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-name">Display Name</Label>
              <Input
                id="profile-name"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            <Button onClick={saveProfile} disabled={savingProfile}>
              {savingProfile ? 'Saving...' : 'Update Profile'}
            </Button>
          </CardContent>
        </Card>

        {/* Figma Token Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                <HugeiconsIcon icon={FigmaIcon} size={20} className="text-purple-500" />
              </div>
              <div>
                <CardTitle>Figma Access Token</CardTitle>
                <CardDescription>
                  Required for direct Figma API access
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="figma-token">
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={Key01Icon} size={16} />
                  Personal Access Token
                </div>
              </Label>
              <Input
                id="figma-token"
                type="password"
                placeholder={userSettings?.has_figma_token ? 'Token saved - enter new to replace' : 'figd_...'}
                value={figmaToken}
                onChange={(e) => setFigmaToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Generate a token from{' '}
                <a
                  href="https://www.figma.com/developers/api#access-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Figma Settings &gt; Personal Access Tokens
                </a>
              </p>
            </div>

            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className={`h-2 w-2 rounded-full ${userSettings?.has_figma_token ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-sm font-medium">
                {userSettings?.has_figma_token ? 'Figma Token Configured' : 'Token Required'}
              </span>
              {userSettings?.figma_access_token_preview && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {userSettings.figma_access_token_preview}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

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
                  variant={aiProvider === 'anthropic' ? 'default' : 'outline'}
                  onClick={() => setAiProvider('anthropic')}
                  className="flex-1"
                >
                  <HugeiconsIcon icon={AiCloudIcon} size={18} className="mr-2" />
                  Anthropic Claude
                  <Badge variant="secondary" className="ml-2">Recommended</Badge>
                </Button>
                <Button
                  variant={aiProvider === 'openai' ? 'default' : 'outline'}
                  onClick={() => setAiProvider('openai')}
                  className="flex-1"
                >
                  <HugeiconsIcon icon={AiCloudIcon} size={18} className="mr-2" />
                  OpenAI GPT
                </Button>
              </div>
            </div>

            <Separator />

            {/* API Keys */}
            {aiProvider === 'anthropic' && (
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
                  placeholder={userSettings?.has_anthropic_key ? 'Key saved - enter new to replace' : 'sk-ant-...'}
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
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

            {aiProvider === 'openai' && (
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
                  placeholder={userSettings?.has_openai_key ? 'Key saved - enter new to replace' : 'sk-...'}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
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
                <div className={`h-2 w-2 rounded-full ${
                  (aiProvider === 'anthropic' && userSettings?.has_anthropic_key) ||
                  (aiProvider === 'openai' && userSettings?.has_openai_key)
                    ? 'bg-green-500 animate-pulse'
                    : 'bg-red-500'
                }`} />
                <span className="text-sm font-medium">
                  {(aiProvider === 'anthropic' && userSettings?.has_anthropic_key) ||
                   (aiProvider === 'openai' && userSettings?.has_openai_key)
                    ? 'AI Ready'
                    : 'API Key Required'}
                </span>
              </div>
              {aiProvider === 'anthropic' && userSettings?.anthropic_api_key_preview && (
                <Badge variant="secondary" className="text-xs">{userSettings.anthropic_api_key_preview}</Badge>
              )}
              {aiProvider === 'openai' && userSettings?.openai_api_key_preview && (
                <Badge variant="secondary" className="text-xs">{userSettings.openai_api_key_preview}</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Save All Keys */}
        <Button
          onClick={saveApiKeys}
          disabled={savingKeys}
          className="w-full"
          size="lg"
        >
          <HugeiconsIcon icon={SaveMoneyDollarIcon} size={18} className="mr-2" />
          {savingKeys ? 'Saving...' : 'Save All API Keys'}
        </Button>
      </div>
    </div>
  );
}
