import { useState, useEffect, useRef } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  AiCloudIcon, SaveMoneyDollarIcon, User02Icon, FigmaIcon,
  UserGroupIcon, Mail01Icon, Delete02Icon, Crown02Icon,
  Tick02Icon, Cancel01Icon, Camera01Icon, Notification03Icon,
  LinkSquare01Icon, Settings02Icon, RefreshIcon, AlertCircleIcon,
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
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuthStore } from '@/store/auth-store';
import { useWorkspaceStore } from '@/store/workspace-store';
import { apiClient, getAvatarUrl } from '@/lib/api-client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export function Settings() {
  const navigate = useNavigate();
  const { user, settings: userSettings, fetchSettings, updateSettings, updateProfile, uploadAvatar } = useAuthStore();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const {
    currentWorkspace, members, invitations, myInvitations,
    fetchMembers, fetchInvitations, inviteMember, removeMember,
    updateMemberRole, cancelInvitation, fetchMyInvitations,
    acceptInvitation, rejectInvitation, fetchWorkspaces, setCurrentWorkspace,
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

  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});
  const [notifPrefsLoaded, setNotifPrefsLoaded] = useState(false);

  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [resettingWorkspace, setResettingWorkspace] = useState(false);
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchMyInvitations();
    apiClient.getNotificationPreferences().then(({ preferences }) => {
      setNotifPrefs(preferences);
      setNotifPrefsLoaded(true);
    }).catch(() => setNotifPrefsLoaded(true));
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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      await uploadAvatar(file);
      toast.success('Avatar updated');
    } catch {
      toast.error('Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
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

  const handleNotifPrefToggle = async (type: string, enabled: boolean) => {
    const prev = { ...notifPrefs };
    setNotifPrefs({ ...notifPrefs, [type]: enabled });
    try {
      await apiClient.updateNotificationPreferences({ [type]: enabled });
    } catch {
      setNotifPrefs(prev);
      toast.error('Failed to update preference');
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

  const handleResetWorkspace = async () => {
    if (!currentWorkspace) return;

    setResettingWorkspace(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/workspaces/${currentWorkspace.id}/reset`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reset workspace');
      }

      toast.success('Workspace data reset successfully');
      setShowResetDialog(false);

      // Refresh workspace data
      await fetchWorkspaces();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset workspace');
    } finally {
      setResettingWorkspace(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!currentWorkspace) return;

    setDeletingWorkspace(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/workspaces/${currentWorkspace.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete workspace');
      }

      toast.success('Workspace deleted successfully');
      setShowDeleteDialog(false);

      // Refresh workspaces and navigate away
      await fetchWorkspaces();
      const { workspaces } = useWorkspaceStore.getState();
      if (workspaces && workspaces.length > 0) {
        setCurrentWorkspace(workspaces[0]);
        navigate('/');
      } else {
        navigate('/');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete workspace');
    } finally {
      setDeletingWorkspace(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const myRole = currentWorkspace?.member_role;
  const isOwnerOrAdmin = myRole === 'owner' || myRole === 'admin';

  const notifCategories = [
    {
      group: 'Workspace',
      items: [
        { type: 'workspace_invitation', label: 'Workspace invitations', desc: 'When you are invited to a workspace' },
        { type: 'member_removed', label: 'Member removed', desc: 'When you are removed from a workspace' },
        { type: 'role_changed', label: 'Role changed', desc: 'When your workspace role is updated' },
      ],
    },
    {
      group: 'Invitations',
      items: [
        { type: 'invitation_accepted', label: 'Invitation accepted', desc: 'When someone accepts your invitation' },
        { type: 'invitation_rejected', label: 'Invitation rejected', desc: 'When someone declines your invitation' },
      ],
    },
    {
      group: 'Design System',
      items: [
        { type: 'figma_file_added', label: 'Figma file added', desc: 'When a Figma file is added to workspace' },
        { type: 'figma_file_removed', label: 'Figma file removed', desc: 'When a Figma file is removed' },
        { type: 'figma_synced', label: 'Figma synced', desc: 'When a Figma file is synced' },
        { type: 'conflict_detected', label: 'Conflicts detected', desc: 'When design system issues are found' },
        { type: 'conflict_resolved', label: 'Conflict resolved', desc: 'When a conflict is resolved' },
      ],
    },
  ];

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage your profile, workspace team, and integrations.
          </p>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="profile">
              <HugeiconsIcon icon={User02Icon} size={14} className="mr-1.5" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="team">
              <HugeiconsIcon icon={UserGroupIcon} size={14} className="mr-1.5" />
              Team
            </TabsTrigger>
            <TabsTrigger value="integrations">
              <HugeiconsIcon icon={LinkSquare01Icon} size={14} className="mr-1.5" />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <HugeiconsIcon icon={Notification03Icon} size={14} className="mr-1.5" />
              Notifications
            </TabsTrigger>
            {myRole === 'owner' && (
              <TabsTrigger value="workspace">
                <HugeiconsIcon icon={Settings02Icon} size={14} className="mr-1.5" />
                Workspace
              </TabsTrigger>
            )}
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">

        {/* My Pending Invitations - shown prominently at top */}
        {myInvitations.length > 0 && (
          <div className="space-y-2">
            {myInvitations.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/5 ring-1 ring-blue-500/20">
                <span className="text-base flex-shrink-0">{inv.workspace_icon || '📦'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{inv.workspace_name || 'Workspace'}</p>
                  <p className="text-xs text-muted-foreground">
                    Invited by {inv.inviter_name || 'someone'} as <span className="capitalize font-medium">{inv.role}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleRejectInvitation(inv.token)}
                  >
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAcceptInvitation(inv.token, inv.workspace_name || 'Workspace')}
                  >
                    <HugeiconsIcon icon={Tick02Icon} size={14} className="mr-1" />
                    Accept
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Profile */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <HugeiconsIcon icon={User02Icon} size={16} className="text-primary" />
              </div>
              <div>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Your personal information</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={getAvatarUrl(user?.avatar)} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-base font-semibold">
                    {user ? getInitials(user.name) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  {uploadingAvatar ? (
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <HugeiconsIcon icon={Camera01Icon} size={16} className="text-white" />
                  )}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="profile-name">Display Name</Label>
                <Input
                  id="profile-name"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Your name"
                  name="profile-name-nofill"
                  autoComplete="one-time-code"
                  data-form-type="other"
                  data-lpignore="true"
                />
              </div>
              <Button onClick={saveProfile} disabled={savingProfile} size="default">
                {savingProfile ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </CardContent>
        </Card>
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="team" className="space-y-6">
        {currentWorkspace && (
          <>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                  <HugeiconsIcon icon={UserGroupIcon} size={16} className="text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>
                    {currentWorkspace.name} &middot; {members.length} member{members.length !== 1 ? 's' : ''}
                  </CardDescription>
                </div>
                {myRole && (
                  <Badge variant="secondary" className="capitalize">{myRole}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Invite Form */}
              {isOwnerOrAdmin && (
                <>
                  <div className="space-y-2">
                    <Label>Invite by Email</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <HugeiconsIcon icon={Mail01Icon} size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="colleague@company.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          className="pl-8"
                          name="invite-email-nofill"
                          autoComplete="one-time-code"
                          data-form-type="other"
                          data-lpignore="true"
                          onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                        />
                      </div>
                      <Select value={inviteRole} onValueChange={setInviteRole}>
                        <SelectTrigger className="w-[110px]">
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
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Pending</p>
                  {invitations.map((inv) => (
                    <div key={inv.id} className="flex items-center gap-3 py-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                          <HugeiconsIcon icon={Mail01Icon} size={12} />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{inv.email}</p>
                        <p className="text-xs text-muted-foreground">Invited as {inv.role}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">Pending</Badge>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleCancelInvite(inv.id)}
                      >
                        <HugeiconsIcon icon={Cancel01Icon} size={14} />
                      </Button>
                    </div>
                  ))}
                  <Separator />
                </div>
              )}

              {/* Members List */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Members</p>
                {members.map((member) => {
                  const isMe = member.user_id === user?.id;
                  const isOwner = member.role === 'owner';

                  return (
                    <div key={member.id} className="flex items-center gap-3 py-2 rounded-lg hover:bg-muted/30 px-1 -mx-1 transition-colors">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={getAvatarUrl(member.avatar)} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-medium truncate">{member.name}</p>
                          {isMe && <Badge variant="outline" className="text-[10px] py-0 h-4">You</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      </div>

                      {isOwner ? (
                        <div className="flex items-center gap-1.5">
                          <HugeiconsIcon icon={Crown02Icon} size={12} className="text-amber-500" />
                          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Owner</span>
                        </div>
                      ) : myRole === 'owner' && !isMe ? (
                        <Select
                          value={member.role}
                          onValueChange={(val) => handleRoleChange(member.user_id, val)}
                        >
                          <SelectTrigger className="w-[100px] h-7 text-xs">
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
                          size="icon-sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveMember(member.user_id, member.name)}
                        >
                          <HugeiconsIcon icon={Delete02Icon} size={14} />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          </>
        )}
          </TabsContent>

          {/* Integrations Tab */}
          <TabsContent value="integrations" className="space-y-6">

        {/* Figma Token */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                <HugeiconsIcon icon={FigmaIcon} size={16} className="text-purple-500" />
              </div>
              <div className="flex-1">
                <CardTitle>Figma</CardTitle>
                <CardDescription>Connect your Figma account for design system access</CardDescription>
              </div>
              <div className={`h-2 w-2 rounded-full ${userSettings?.has_figma_token ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="figma-token">Personal Access Token</Label>
              <Input
                id="figma-token"
                type="text"
                placeholder={userSettings?.has_figma_token ? 'Token saved - enter new to replace' : 'figd_...'}
                value={figmaToken}
                onChange={(e) => setFigmaToken(e.target.value)}
                name="figma-token-nofill"
                autoComplete="one-time-code"
                data-form-type="other"
                data-lpignore="true"
                className="[-webkit-text-security:disc]"
              />
              <p className="text-xs text-muted-foreground">
                Generate a token from{' '}
                <a href="https://www.figma.com/developers/api#access-tokens" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                  Figma Settings <HugeiconsIcon icon={LinkSquare01Icon} size={10} />
                </a>
              </p>
            </div>
            {userSettings?.has_figma_token && userSettings?.figma_access_token_preview && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="text-green-600 dark:text-green-400 font-medium">Connected</span>
                <span className="text-muted-foreground/50">&middot;</span>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{userSettings.figma_access_token_preview}</code>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <HugeiconsIcon icon={AiCloudIcon} size={16} className="text-primary" />
              </div>
              <div className="flex-1">
                <CardTitle>AI Provider</CardTitle>
                <CardDescription>Configure AI for design system analysis</CardDescription>
              </div>
              <div className={`h-2 w-2 rounded-full ${
                (aiProvider === 'anthropic' && userSettings?.has_anthropic_key) || (aiProvider === 'openai' && userSettings?.has_openai_key)
                  ? 'bg-green-500' : 'bg-red-500'
              }`} />
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Provider</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAiProvider('anthropic')}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors ${
                    aiProvider === 'anthropic'
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'
                  }`}
                >
                  <HugeiconsIcon icon={AiCloudIcon} size={14} />
                  Anthropic Claude
                  {aiProvider === 'anthropic' && <Badge variant="secondary" className="ml-auto text-[10px]">Active</Badge>}
                </button>
                <button
                  type="button"
                  onClick={() => setAiProvider('openai')}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors ${
                    aiProvider === 'openai'
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'
                  }`}
                >
                  <HugeiconsIcon icon={AiCloudIcon} size={14} />
                  OpenAI GPT
                  {aiProvider === 'openai' && <Badge variant="secondary" className="ml-auto text-[10px]">Active</Badge>}
                </button>
              </div>
            </div>

            <Separator />

            {aiProvider === 'anthropic' && (
              <div className="space-y-2">
                <Label htmlFor="anthropic-key">Anthropic API Key</Label>
                <Input
                  id="anthropic-key"
                  type="text"
                  placeholder={userSettings?.has_anthropic_key ? 'Key saved - enter new to replace' : 'sk-ant-...'}
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  name="anthropic-key-nofill"
                  autoComplete="one-time-code"
                  data-form-type="other"
                  data-lpignore="true"
                  className="[-webkit-text-security:disc]"
                />
                <p className="text-xs text-muted-foreground">
                  Get your key from{' '}
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                    Anthropic Console <HugeiconsIcon icon={LinkSquare01Icon} size={10} />
                  </a>
                </p>
                {userSettings?.has_anthropic_key && userSettings?.anthropic_api_key_preview && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="text-green-600 dark:text-green-400 font-medium">Connected</span>
                    <span className="text-muted-foreground/50">&middot;</span>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{userSettings.anthropic_api_key_preview}</code>
                  </div>
                )}
              </div>
            )}

            {aiProvider === 'openai' && (
              <div className="space-y-2">
                <Label htmlFor="openai-key">OpenAI API Key</Label>
                <Input
                  id="openai-key"
                  type="text"
                  placeholder={userSettings?.has_openai_key ? 'Key saved - enter new to replace' : 'sk-...'}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  name="openai-key-nofill"
                  autoComplete="one-time-code"
                  data-form-type="other"
                  data-lpignore="true"
                  className="[-webkit-text-security:disc]"
                />
                <p className="text-xs text-muted-foreground">
                  Get your key from{' '}
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                    OpenAI Platform <HugeiconsIcon icon={LinkSquare01Icon} size={10} />
                  </a>
                </p>
                {userSettings?.has_openai_key && userSettings?.openai_api_key_preview && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="text-green-600 dark:text-green-400 font-medium">Connected</span>
                    <span className="text-muted-foreground/50">&middot;</span>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{userSettings.openai_api_key_preview}</code>
                  </div>
                )}
              </div>
            )}

            <Button onClick={saveApiKeys} disabled={savingKeys} className="w-full">
              <HugeiconsIcon icon={SaveMoneyDollarIcon} size={14} className="mr-1.5" />
              {savingKeys ? 'Saving...' : 'Save All Keys & Tokens'}
            </Button>
          </CardContent>
        </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
        {notifPrefsLoaded && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10">
                  <HugeiconsIcon icon={Notification03Icon} size={16} className="text-orange-500" />
                </div>
                <div>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>Choose which notifications you want to receive</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {notifCategories.map((category, catIdx) => (
                <div key={category.group}>
                  {catIdx > 0 && <Separator className="mb-4" />}
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-3">{category.group}</p>
                  <div className="space-y-0">
                    {category.items.map(({ type, label, desc }) => (
                      <div key={type} className="flex items-center justify-between py-2.5">
                        <div>
                          <p className="text-xs font-medium">{label}</p>
                          <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                        <Switch
                          checked={notifPrefs[type] !== false}
                          onCheckedChange={(checked) => handleNotifPrefToggle(type, checked)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
          </TabsContent>

          {/* Workspace Tab */}
          <TabsContent value="workspace" className="space-y-6">
        {currentWorkspace && myRole === 'owner' && (
          <Card className="border-destructive/20">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
                  <HugeiconsIcon icon={Settings02Icon} size={16} className="text-destructive" />
                </div>
                <div className="flex-1">
                  <CardTitle>Workspace Settings</CardTitle>
                  <CardDescription>Manage workspace data and configuration</CardDescription>
                </div>
                <Badge variant="secondary" className="text-amber-600 dark:text-amber-400">
                  <HugeiconsIcon icon={Crown02Icon} size={10} className="mr-1" />
                  Owner Only
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-orange-200 dark:border-orange-900/30 bg-orange-50 dark:bg-orange-950/10 p-4">
                <div className="flex items-start gap-3">
                  <HugeiconsIcon icon={RefreshIcon} size={16} className="text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div>
                      <h4 className="text-sm font-semibold text-orange-900 dark:text-orange-100">Reset Workspace Data</h4>
                      <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                        Delete all design tokens, components, and Figma files. Workspace members and settings will be preserved.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowResetDialog(true)}
                      className="border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-950/30"
                    >
                      <HugeiconsIcon icon={RefreshIcon} size={14} className="mr-1.5" />
                      Reset Data
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-start gap-3">
                  <HugeiconsIcon icon={AlertCircleIcon} size={16} className="text-destructive mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div>
                      <h4 className="text-sm font-semibold text-destructive">Delete Workspace</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Permanently delete this workspace and all its data. This action cannot be undone.
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={14} className="mr-1.5" />
                      Delete Workspace
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
          </TabsContent>
        </Tabs>

        {/* Reset Workspace Confirmation Dialog */}
        <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <HugeiconsIcon icon={RefreshIcon} size={18} className="text-orange-600 dark:text-orange-400" />
                Reset Workspace Data?
              </DialogTitle>
              <DialogDescription className="space-y-2 pt-2">
                <p>This will permanently delete:</p>
                <ul className="list-disc list-inside space-y-1 text-xs ml-2">
                  <li>All design tokens and collections</li>
                  <li>All components</li>
                  <li>All Figma files</li>
                  <li>All sync history and logs</li>
                  <li>All conflicts</li>
                </ul>
                <p className="pt-2 font-medium">Workspace members and settings will be preserved.</p>
                <p className="text-destructive font-semibold">This action cannot be undone.</p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setShowResetDialog(false)}
                disabled={resettingWorkspace}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={handleResetWorkspace}
                disabled={resettingWorkspace}
                className="border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-950/30"
              >
                {resettingWorkspace ? 'Resetting...' : 'Reset Data'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Workspace Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <HugeiconsIcon icon={AlertCircleIcon} size={18} />
                Delete Workspace?
              </DialogTitle>
              <DialogDescription className="space-y-2 pt-2">
                <p>
                  Are you sure you want to delete <span className="font-semibold">{currentWorkspace?.name}</span>?
                </p>
                <p>This will permanently delete:</p>
                <ul className="list-disc list-inside space-y-1 text-xs ml-2">
                  <li>All design tokens and collections</li>
                  <li>All components</li>
                  <li>All Figma files</li>
                  <li>All workspace members</li>
                  <li>All settings and history</li>
                </ul>
                <p className="text-destructive font-bold pt-2">This action cannot be undone.</p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                disabled={deletingWorkspace}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteWorkspace}
                disabled={deletingWorkspace}
              >
                {deletingWorkspace ? 'Deleting...' : 'Delete Workspace'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
