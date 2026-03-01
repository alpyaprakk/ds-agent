import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
import { useWorkspaceStore } from '@/store/workspace-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

type Step = 'loading' | 'login' | 'workspace' | 'done' | 'error';

export function PluginAuth() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');

  const { user, token, checkAuth, login } = useAuthStore();
  const { workspaces, fetchWorkspaces } = useWorkspaceStore();

  const [step, setStep] = useState<Step>('loading');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [selectedWsId, setSelectedWsId] = useState('');
  const [completing, setCompleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Check if session is valid
  useEffect(() => {
    if (!sessionId) {
      setStep('error');
      setErrorMsg('No session ID in URL. Please initiate login from the Figma plugin.');
      return;
    }
    // Check auth state
    checkAuth().then(() => {
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        // Already logged in — fetch workspaces and go to workspace step
        fetchWorkspaces().then(() => {
          const ws = useWorkspaceStore.getState().workspaces;
          if (ws.length === 1) {
            completeSession(useAuthStore.getState().token!, currentUser.id, ws[0].id);
          } else {
            setStep('workspace');
          }
        });
      } else {
        setStep('login');
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function completeSession(jwt: string, _userId: string, workspaceId: string) {
    setCompleting(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/plugin-session/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ sessionId, workspaceId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to complete session');
      }
      setStep('done');
    } catch (err: any) {
      setStep('error');
      setErrorMsg(err.message || 'Failed to complete plugin auth');
    } finally {
      setCompleting(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      await login(email, password);
      const jwt = useAuthStore.getState().token!;
      const currentUser = useAuthStore.getState().user!;
      await fetchWorkspaces();
      const ws = useWorkspaceStore.getState().workspaces;
      if (ws.length === 1) {
        await completeSession(jwt, currentUser.id, ws[0].id);
      } else {
        setStep('workspace');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleWorkspaceSelect() {
    if (!selectedWsId || !token) return;
    await completeSession(token, user!.id, selectedWsId);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <img src="/logo.svg" alt="Tokenhaus" className="h-10 w-10 dark:invert" />
          <h1 className="text-xl font-semibold tracking-tight">Tokenhaus</h1>
          <p className="text-sm text-muted-foreground">Figma Plugin Connect</p>
        </div>

        {/* Loading */}
        {step === 'loading' && (
          <p className="text-center text-sm text-muted-foreground">Loading…</p>
        )}

        {/* Login form */}
        {step === 'login' && (
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <div>
              <h2 className="font-semibold">Sign in</h2>
              <p className="text-sm text-muted-foreground mt-1">Sign in to connect the Figma plugin</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              {loginError && <p className="text-sm text-destructive">{loginError}</p>}
              <Button type="submit" className="w-full" disabled={loginLoading}>
                {loginLoading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </div>
        )}

        {/* Workspace selector */}
        {step === 'workspace' && (
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <div>
              <h2 className="font-semibold">Select workspace</h2>
              <p className="text-sm text-muted-foreground mt-1">Choose which workspace to connect to the plugin</p>
            </div>
            <div className="space-y-2">
              {workspaces.map(ws => (
                <button
                  key={ws.id}
                  onClick={() => setSelectedWsId(ws.id)}
                  className={`w-full text-left rounded-md border px-4 py-3 text-sm transition-colors ${
                    selectedWsId === ws.id
                      ? 'border-primary bg-primary/5 font-medium'
                      : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30'
                  }`}
                >
                  {ws.name}
                </button>
              ))}
            </div>
            <Button
              className="w-full"
              disabled={!selectedWsId || completing}
              onClick={handleWorkspaceSelect}
            >
              {completing ? 'Connecting…' : 'Connect to plugin'}
            </Button>
          </div>
        )}

        {/* Done */}
        {step === 'done' && (
          <div className="rounded-lg border bg-card p-6 space-y-3 text-center">
            <div className="text-2xl">✅</div>
            <h2 className="font-semibold">Connected!</h2>
            <p className="text-sm text-muted-foreground">
              You can close this tab and return to Figma. The plugin will connect automatically.
            </p>
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 space-y-3 text-center">
            <div className="text-2xl">❌</div>
            <h2 className="font-semibold text-destructive">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
          </div>
        )}
      </div>
    </div>
  );
}
