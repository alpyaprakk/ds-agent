import { useState, useEffect, useRef } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialContext?: {
    conflictId: string;
    title: string;
    description: string;
    suggestion?: string;
    entityType: string;
    entityName: string;
  };
  onApplyFix?: (fix: any) => void;
}

export function AIChatPanel({ isOpen, onClose, initialContext, onApplyFix }: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && initialContext) {
      // Initialize chat with context
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
        timestamp: new Date()
      };

      setMessages([systemMessage, assistantMessage]);
    }
  }, [isOpen, initialContext]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // TODO: Call AI API to get response
      // For now, simulate response
      await new Promise(resolve => setTimeout(resolve, 1000));

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: 'I understand your question. Let me help you with that...\n\n(AI response will be implemented here)',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Failed to get AI response:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyAutoFix = () => {
    if (initialContext && onApplyFix) {
      // Send fix command to plugin
      onApplyFix({
        conflictId: initialContext.conflictId,
        entityId: initialContext.entityName,
        action: 'auto-fix',
        suggestion: initialContext.suggestion
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl border-l bg-background shadow-lg">
        <Card className="h-full rounded-none border-0">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <HugeiconsIcon icon={AiCloudIcon} size={20} className="text-primary" />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    AI Assistant
                    <Badge variant="secondary" className="gap-1">
                      <HugeiconsIcon icon={SparklesIcon} size={12} />
                      Active
                    </Badge>
                  </CardTitle>
                  {initialContext && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Helping with: {initialContext.entityName}
                    </p>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <HugeiconsIcon icon={Cancel01Icon} size={20} />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex h-[calc(100%-80px)] flex-col p-0">
            {/* Messages */}
            <ScrollArea className="flex-1 p-6" ref={scrollRef}>
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex gap-3',
                      message.role === 'user' && 'flex-row-reverse'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0',
                        message.role === 'assistant' && 'bg-primary/10',
                        message.role === 'user' && 'bg-muted',
                        message.role === 'system' && 'bg-muted/50'
                      )}
                    >
                      {message.role === 'assistant' && (
                        <HugeiconsIcon icon={AiCloudIcon} size={16} className="text-primary" />
                      )}
                      {message.role === 'user' && (
                        <HugeiconsIcon icon={UserIcon} size={16} />
                      )}
                      {message.role === 'system' && (
                        <HugeiconsIcon icon={SparklesIcon} size={16} />
                      )}
                    </div>

                    <div
                      className={cn(
                        'max-w-[80%] rounded-lg px-4 py-3',
                        message.role === 'assistant' && 'bg-muted',
                        message.role === 'user' && 'bg-primary text-primary-foreground',
                        message.role === 'system' && 'bg-muted/50 text-xs italic'
                      )}
                    >
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {message.content}
                      </div>
                      <div
                        className={cn(
                          'mt-2 text-xs opacity-60',
                          message.role === 'user' && 'text-primary-foreground'
                        )}
                      >
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <HugeiconsIcon icon={AiCloudIcon} size={16} className="text-primary animate-pulse" />
                    </div>
                    <div className="rounded-lg bg-muted px-4 py-3">
                      <div className="flex gap-1">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0.2s' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="border-t p-4">
              {initialContext?.suggestion && (
                <div className="mb-3">
                  <Button
                    onClick={handleApplyAutoFix}
                    className="w-full gap-2"
                    variant="secondary"
                  >
                    <HugeiconsIcon icon={SparklesIcon} size={16} />
                    Apply Suggested Fix Automatically
                  </Button>
                </div>
              )}

              <div className="flex gap-2">
                <Textarea
                  placeholder="Ask me anything about this issue..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  className="min-h-[60px] max-h-[120px] resize-none"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="h-[60px] w-[60px] flex-shrink-0"
                >
                  <HugeiconsIcon icon={ArrowRight01Icon} size={20} />
                </Button>
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
