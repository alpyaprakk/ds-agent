import { useState, useEffect, useRef, useCallback } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  AiCloudIcon,
  ArrowRight01Icon,
  Cancel01Icon,
  SparklesIcon,
  UserIcon
} from '@hugeicons/core-free-icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { apiClient, ChatMessage, ChatAction } from '@/lib/api-client';
import { useWorkspaceStore } from '@/store/workspace-store';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  agentType?: 'uiux' | 'design-system';
  actions?: ChatAction[];
}

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: string;
  initialContext?: {
    conflictId: string;
    title: string;
    description: string;
    suggestion?: string;
    entityType: string;
    entityName: string;
  };
  onApplyFix?: (fix: any) => void;
  fixResult?: { success: boolean; conflictId?: string; error?: string } | null;
}

export function AIChatPanel({ isOpen, onClose, workspaceId: workspaceIdProp, initialContext, onApplyFix, fixResult }: AIChatPanelProps) {
  const { currentWorkspace } = useWorkspaceStore();
  const workspaceId = workspaceIdProp || currentWorkspace?.id || '';
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevContextRef = useRef<string | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      prevContextRef.current = null;
      return;
    }

    if (initialContext) {
      const contextKey = initialContext.conflictId;
      if (prevContextRef.current === contextKey) return;
      prevContextRef.current = contextKey;

      const systemMessage: Message = {
        id: 'system-1',
        role: 'system',
        content: `I'm analyzing this issue:\n\n**${initialContext.title}**\n\n${initialContext.description}\n\n${initialContext.suggestion ? `Suggested fix: ${initialContext.suggestion}` : ''}`,
        timestamp: new Date()
      };

      const assistantMessage: Message = {
        id: 'assistant-1',
        role: 'assistant',
        content: `I've analyzed the **${initialContext.entityType}** issue with "${initialContext.entityName}".\n\nHere's what I found:\n\n${initialContext.description}\n\n${initialContext.suggestion ? `**Recommended approach:**\n${initialContext.suggestion}\n\n` : ''}Would you like me to:\n1. Explain the issue in more detail\n2. Provide step-by-step fix instructions\n3. Generate the fix automatically (if auto-fixable)`,
        timestamp: new Date(),
        agentType: 'design-system'
      };

      setMessages([systemMessage, assistantMessage]);
      setInput('');
    } else {
      // General design system chat — show welcome message once
      setMessages(prev => {
        if (prev.length > 0) return prev;
        return [{
          id: 'welcome-1',
          role: 'assistant',
          content: "Hi! I'm your design system assistant. I have two specialized agents ready to help:\n\n- **UI/UX Agent** — design principles, best practices, accessibility\n- **Design System Agent** — variables, components, naming conventions\n\nWhat would you like to work on?",
          timestamp: new Date(),
          agentType: 'uiux'
        }];
      });
    }
  }, [isOpen, initialContext]);

  useEffect(() => {
    if (!fixResult) return;

    if (!fixResult.success) {
      setMessages(prev => [...prev, {
        id: `fix-result-${Date.now()}`,
        role: 'assistant',
        content: `❌ Fix failed: ${fixResult.error || 'Could not apply the fix. Make sure the Figma plugin is running and the file is synced.'}`,
        timestamp: new Date(),
        agentType: 'design-system'
      }]);
      return;
    }

    // Success: ask AI to summarize what was done
    const entity = initialContext?.entityName || '';
    const entityType = initialContext?.entityType || '';
    const suggestion = initialContext?.suggestion || '';
    const autoPrompt = `The fix has been applied to the Figma file. Briefly summarize what was done and any follow-up recommendations:
- Entity: ${entity} (${entityType})
- Action taken: ${suggestion || 'Issue acknowledged and marked as resolved'}`;

    setIsLoading(true);
    const currentMessages = [...messages];
    apiClient.sendChatMessage({
      message: autoPrompt,
      history: currentMessages.filter(m => m.role !== 'system').map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      })),
      workspaceId
    }).then(response => {
      setMessages(prev => [...prev, {
        id: `fix-result-${Date.now()}`,
        role: 'assistant',
        content: `✅ Fix applied!\n\n${response.reply}`,
        timestamp: new Date(),
        agentType: 'design-system'
      }]);
    }).catch(() => {
      setMessages(prev => [...prev, {
        id: `fix-result-${Date.now()}`,
        role: 'assistant',
        content: `✅ Fix applied successfully!\n\n**Entity:** ${entity}\n**Action:** ${suggestion || 'Issue marked as resolved'}\n\nThe conflict has been resolved. Re-sync to confirm the change.`,
        timestamp: new Date(),
        agentType: 'design-system'
      }]);
    }).finally(() => setIsLoading(false));
  }, [fixResult]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    const currentInput = input;
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Build conversation history for the API (exclude system messages, prefix agent identity)
      const history: ChatMessage[] = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.agentType
            ? `[${m.agentType === 'uiux' ? 'UI/UX Agent' : 'Design System Agent'}]: ${m.content}`
            : m.content
        }));

      const response = await apiClient.sendChatMessage({
        message: currentInput,
        history,
        workspaceId: workspaceId || ''
      });

      let content = response.reply;
      if (response.command && response.commandStatus === 'sent') {
        content += '\n\n⚙️ *Command sent to Figma plugin — executing...*';
      } else if (response.command && response.commandStatus === 'no_plugin') {
        content += '\n\n⚠️ *Plugin not connected. Open the DS Agent plugin in Figma to execute this command.*';
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content,
        timestamp: new Date(),
        agentType: response.agentType,
        actions: response.actions
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      const msg = error?.message || '';
      const errorContent = msg.includes('AI not configured') || msg.includes('Add an API key')
        ? 'AI is not configured for this workspace. Please add an API key in Settings.'
        : msg.includes('workspaceId') || msg.includes('required')
        ? 'No workspace selected. Please select a workspace first.'
        : msg || 'Sorry, something went wrong. Please try again.';

      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: errorContent,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = (action: ChatAction) => {
    if (action.type === 'create_component' && onApplyFix) {
      onApplyFix({ action: 'create_component', ...action.payload });
    }
  };

  const handleApplyAutoFix = () => {
    if (initialContext && onApplyFix) {
      onApplyFix({
        conflictId: initialContext.conflictId,
        entityId: initialContext.entityName,
        action: 'auto-fix',
        suggestion: initialContext.suggestion
      });
    }
  };

  const agentLabel = (agentType: 'uiux' | 'design-system') =>
    agentType === 'uiux' ? 'UI/UX Agent' : 'Design System Agent';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="fixed right-0 top-0 h-full w-full max-w-xl border-l bg-background shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="h-full rounded-none border-0 flex flex-col">
          <CardHeader className="border-b flex-shrink-0 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <HugeiconsIcon icon={AiCloudIcon} size={16} className="text-primary" />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    AI Assistant
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <HugeiconsIcon icon={SparklesIcon} size={10} />
                      Active
                    </Badge>
                  </CardTitle>
                  {initialContext ? (
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[280px]">
                      Helping with: {initialContext.entityName}
                    </p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Design System Assistant
                    </p>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={onClose}>
                <HugeiconsIcon icon={Cancel01Icon} size={16} />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex flex-1 flex-col p-0 overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-2.5',
                    message.role === 'user' && 'flex-row-reverse'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0',
                      message.role === 'assistant' && 'bg-primary/10',
                      message.role === 'user' && 'bg-muted',
                      message.role === 'system' && 'bg-muted/50'
                    )}
                  >
                    {message.role === 'assistant' && (
                      <HugeiconsIcon icon={AiCloudIcon} size={14} className="text-primary" />
                    )}
                    {message.role === 'user' && (
                      <HugeiconsIcon icon={UserIcon} size={14} />
                    )}
                    {message.role === 'system' && (
                      <HugeiconsIcon icon={SparklesIcon} size={14} />
                    )}
                  </div>

                  <div
                    className={cn(
                      'max-w-[80%] rounded-lg px-3 py-2.5',
                      message.role === 'assistant' && 'bg-muted',
                      message.role === 'user' && 'bg-primary text-primary-foreground',
                      message.role === 'system' && 'bg-muted/50 text-[11px] italic'
                    )}
                  >
                    {/* Agent identity badge */}
                    {message.role === 'assistant' && message.agentType && (
                      <div className="text-[9px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                        {agentLabel(message.agentType)}
                      </div>
                    )}

                    <div className="whitespace-pre-wrap text-xs leading-relaxed">
                      {message.content}
                    </div>

                    {/* Action buttons */}
                    {message.actions && message.actions.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1">
                        {message.actions.map((action, i) => (
                          <Button
                            key={i}
                            size="sm"
                            variant="secondary"
                            className="text-xs w-full justify-start h-7"
                            onClick={() => handleAction(action)}
                          >
                            <HugeiconsIcon icon={SparklesIcon} size={10} className="mr-1.5" />
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    )}

                    <div
                      className={cn(
                        'mt-1.5 text-[10px] opacity-60',
                        message.role === 'user' && 'text-primary-foreground'
                      )}
                    >
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                    <HugeiconsIcon icon={AiCloudIcon} size={14} className="text-primary animate-pulse" />
                  </div>
                  <div className="rounded-lg bg-muted px-3 py-2.5">
                    <div className="flex gap-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" />
                      <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t p-3 flex-shrink-0">
              {initialContext?.suggestion && (
                <div className="mb-2">
                  <Button
                    onClick={handleApplyAutoFix}
                    className="w-full gap-1.5 text-xs"
                    variant="secondary"
                    size="sm"
                  >
                    <HugeiconsIcon icon={SparklesIcon} size={12} />
                    Apply Suggested Fix Automatically
                  </Button>
                </div>
              )}

              <div className="flex gap-2">
                <Textarea
                  placeholder={initialContext ? "Ask me anything about this issue..." : "Ask about your design system..."}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  className="min-h-[48px] max-h-[100px] resize-none text-xs"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="h-[48px] w-[48px] flex-shrink-0"
                >
                  <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
                </Button>
              </div>

              <p className="text-[10px] text-muted-foreground mt-1.5">
                Enter to send, Shift+Enter for new line
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
