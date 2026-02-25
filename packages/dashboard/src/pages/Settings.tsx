import { useState, useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  AiCloudIcon, SaveMoneyDollarIcon, User02Icon, FigmaIcon,
  UserGroupIcon, Mail01Icon, Delete02Icon, Crown02Icon,
  Tick02Icon, Cancel01Icon,
} from '@hugeicons/core-free-icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/store/auth-store';
import { useWorkspaceStore } from '@/store/workspace-store';
import { toast } from 'sonner';

export function Settings() {
  const { user, settings: userSettings, fetchSettings, updateSettings, updateProfile } = useAuthStore();
  const {
    currentWorkspace, members, invitations, myInvitations,
    fetchMembers, fetchInvitations, inviteMember, removeMember,
    updateMemberRole, cancelInvitation, fetchMyInvitations,
    acceptInvitation, rejectInvitation,
  } = useWorkspaceStore();

  const [aiProvider, setAiProvider] = useState<'anthropic' | 'openai'>('anthropic');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [figmaToken, setFigmaToken] = useState('');
  const [profileName, setProfileName] = useState('');
  const [savingKeys, setSavingKeys] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchMyInvitations();
  }, []);

  useEffect(() => {
    if (currentWorkspace) {
      fetchMembers(currentWorkspace.id);
      const myRole = currentWorkspace.member_role;
      if (myRole === 'owner' || myRole === 'admin') {
        fetchInvitations(currentWorkspace.id);
      }
    }
  }, [currentWorkspace]);

  useEffect(() => {
    if (userSettings) {
      setAiProvider((userSettings.ai_provider as 'anthropic' | 'openai') || 'anthropic');
    }
  }, [userSettings]);

  useEffect(() => {
    if (user) setProfileName(user.name);
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

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !currentWorkspace) return;
    setInviting(true);
    try {
      await inviteMember(currentWorkspace.id, inviteEmail.trim(), inviteRole);
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setInviteRole('member');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string, name: string) => {
    if (!currentWorkspace) return;
    try {
      await removeMember(currentWorkspace.id, userId);
      toast.success(`${name} removed from workspace`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to remove member');
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    if (!currentWorkspace) return;
    try {
      await updateMemberRole(currentWorkspace.id, userId, role);
      toast.success('Role updated');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update role');
    }
  };

  const handleCancelInvite = async (invitationId: string) => {
    if (!currentWorkspace) return;
    try {
      await cancelInvitation(currentWorkspace.id, invitationId);
      toast.success('Invitation cancelled');
    } catch {
      toast.error('Failed to cancel invitation');
    }
  };

  const handleAcceptInvitation = async (token: string, workspaceName: string) => {
    try {
      await acceptInvitation(token);
      toast.success(`Joined workspace "${workspaceName}"`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to accept invitation');
    }
  };

  const handleRejectInvitation = async (token: string) => {
    try {
      await rejectInvitation(token);
      toast.success('Invitation declined');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to decline invitation');
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const myRole = currentWorkspace?.member_role;
  const isOwnerOrAdmin = myRole === 'owner' || myRole === 'admin';

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto space-y-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-3">
            Manage your profile, workspace team, and API keys
          </p>
        </div>

        <Separator />

        {/* Profile Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <HugeiconsIcon icon={User02Icon} size={20} className="text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Profile</CardTitle>
                <CardDescription className="mt-1">Your personal information</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="flex items-center gap-5">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user?.avatar || ''} />
                <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                  {user ? getInitials(user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-base">{user?.name}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{user?.email}</p>
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
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

        {/* My Pending Invitations */}
        {myInvitations.length > 0 && (
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <HugeiconsIcon icon={Mail01Icon} size={20} className="text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Pending Invitations</CardTitle>
                  <CardDescription className="mt-1">
                    You have {myInvitations.length} workspace invitation{myInvitations.length !== 1 ? 's' : ''}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {myInvitations.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 p-4 rounded-lg bg-card border">
                  <span className="text-xl flex-shrink-0">{inv.workspace_icon || '📦'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{inv.workspace_name || 'Workspace'}</p>
                    <p className="text-xs text-muted-foreground">
                      Invited by {inv.inviter_name || 'someone'} as <span className="capitalize font-medium">{inv.role}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRejectInvitation(inv.token)}
                    >
                      <HugeiconsIcon icon={Cancel01Icon} size={14} className="mr-1.5" />
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAcceptInvitation(inv.token, inv.workspace_name || 'Workspace')}
                    >
                      <HugeiconsIcon icon={Tick02Icon} size={14} className="mr-1.5" />
                      Accept
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Team / Members Card */}
        {currentWorkspace && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <HugeiconsIcon icon={UserGroupIcon} size={20} className="text-blue-500" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">Team Members</CardTitle>
                  <CardDescription className="mt-1">
                    {currentWorkspace.name} - {members.length} member{members.length !== 1 ? 's' : ''}
                  </CardDescription>
                </div>
                {myRole && (
                  <Badge variant="secondary" className="capitalize">{myRole}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Invite Form */}
              {isOwnerOrAdmin && (
                <>
                  <div className="space-y-3">
                    <Label>Invite by Email</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <HugeiconsIcon icon={Mail01Icon} size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="colleague@company.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          className="pl-9"
                          onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                        />
                      </div>
                      <Select value={inviteRole} onValueChange={setInviteRole}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          {myRole === 'owner' && <SelectItem value="admin">Admin</SelectItem>}
                        </SelectContent>
                      </Select>
                      <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                        {inviting ? 'Sending...' : 'Invite'}
                      </Button>
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Pending Invitations */}
              {isOwnerOrAdmin && invitations.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">Pending Invitations</Label>
                  <div className="space-y-2">
                    {invitations.map((inv) => (
                      <div key={inv.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-dashed">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                            <HugeiconsIcon icon={Mail01Icon} size={14} />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{inv.email}</p>
                          <p className="text-xs text-muted-foreground">Invited as {inv.role}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">Pending</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleCancelInvite(inv.id)}
                        >
                          <HugeiconsIcon icon={Delete02Icon} size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Separator />
                </div>
              )}

              {/* Members List */}
              <div className="space-y-3">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Members</Label>
                <div className="space-y-2">
                  {members.map((member) => {
                    const isMe = member.user_id === user?.id;
                    const isOwner = member.role === 'owner';

                    return (
                      <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={member.avatar || ''} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{member.name}</p>
                            {isMe && <Badge variant="outline" className="text-[10px] py-0">You</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                        </div>

                        {isOwner ? (
                          <div className="flex items-center gap-1.5">
                            <HugeiconsIcon icon={Crown02Icon} size={14} className="text-amber-500" />
                            <span className="text-xs font-medium text-amber-600">Owner</span>
                          </div>
                        ) : myRole === 'owner' && !isMe ? (
                          <Select
                            value={member.role}
                            onValueChange={(val) => handleRoleChange(member.user_id, val)}
                          >
                            <SelectTrigger className="w-[100px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="member">Member</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="secondary" className="text-xs capitalize">{member.role}</Badge>
                        )}

                        {myRole === 'owner' && !isMe && !isOwner && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveMember(member.user_id, member.name)}
                          >
                            <HugeiconsIcon icon={Delete02Icon} size={14} />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Figma Token Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                <HugeiconsIcon icon={FigmaIcon} size={20} className="text-purple-500" />
              </div>
              <div>
                <CardTitle className="text-base">Figma Access Token</CardTitle>
                <CardDescription className="mt-1">Required for direct Figma API access</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-3">
              <Label htmlFor="figma-token">Personal Access Token</Label>
              <Input
                id="figma-token"
                type="password"
                placeholder={userSettings?.has_figma_token ? 'Token saved - enter new to replace' : 'figd_...'}
                value={figmaToken}
                onChange={(e) => setFigmaToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Generate a token from{' '}
                <a href="https://www.figma.com/developers/api#access-tokens" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Figma Settings &gt; Personal Access Tokens
                </a>
              </p>
            </div>
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
              <div className={`h-2 w-2 rounded-full ${userSettings?.has_figma_token ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-sm font-medium">
                {userSettings?.has_figma_token ? 'Figma Token Configured' : 'Token Required'}
              </span>
              {userSettings?.figma_access_token_preview && (
                <Badge variant="secondary" className="ml-auto text-xs">{userSettings.figma_access_token_preview}</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI Configuration */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <HugeiconsIcon icon={AiCloudIcon} size={20} className="text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">AI Configuration</CardTitle>
                <CardDescription className="mt-1">Configure AI providers for design system analysis</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-3">
              <Label>AI Provider</Label>
              <div className="flex gap-3">
                <Button variant={aiProvider === 'anthropic' ? 'default' : 'outline'} onClick={() => setAiProvider('anthropic')} className="flex-1">
                  <HugeiconsIcon icon={AiCloudIcon} size={18} className="mr-2" />
                  Anthropic Claude
                  <Badge variant="secondary" className="ml-2">Recommended</Badge>
                </Button>
                <Button variant={aiProvider === 'openai' ? 'default' : 'outline'} onClick={() => setAiProvider('openai')} className="flex-1">
                  <HugeiconsIcon icon={AiCloudIcon} size={18} className="mr-2" />
                  OpenAI GPT
                </Button>
              </div>
            </div>

            <Separator />

            {aiProvider === 'anthropic' && (
              <div className="space-y-3">
                <Label htmlFor="anthropic-key">Anthropic API Key</Label>
                <Input id="anthropic-key" type="password" placeholder={userSettings?.has_anthropic_key ? 'Key saved - enter new to replace' : 'sk-ant-...'} value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  Get your API key from{' '}
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Anthropic Console</a>
                </p>
              </div>
            )}

            {aiProvider === 'openai' && (
              <div className="space-y-3">
                <Label htmlFor="openai-key">OpenAI API Key</Label>
                <Input id="openai-key" type="password" placeholder={userSettings?.has_openai_key ? 'Key saved - enter new to replace' : 'sk-...'} value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  Get your API key from{' '}
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">OpenAI Platform</a>
                </p>
              </div>
            )}

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${
                  (aiProvider === 'anthropic' && userSettings?.has_anthropic_key) || (aiProvider === 'openai' && userSettings?.has_openai_key)
                    ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`} />
                <span className="text-sm font-medium">
                  {(aiProvider === 'anthropic' && userSettings?.has_anthropic_key) || (aiProvider === 'openai' && userSettings?.has_openai_key)
                    ? 'AI Ready' : 'API Key Required'}
                </span>
              </div>
              {aiProvider === 'anthropic' && userSettings?.anthropic_api_key_preview && (
                <Badge variant="secondary" className="text-xs">{userSettings.anthropic_api_key_preview}</Badge>
              )}
              {aiProvider === 'openai' && userSettings?.openai_api_key_preview && (
                <Badge variant="secondary" className="text-xs">{userSettings.openai_api_key_preview}</Badge>
              )}
            </div>

            <Button onClick={saveApiKeys} disabled={savingKeys} className="w-full">
              <HugeiconsIcon icon={SaveMoneyDollarIcon} size={18} className="mr-2" />
              {savingKeys ? 'Saving...' : 'Save API Keys & Tokens'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
