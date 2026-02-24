import { useState } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { HugeiconsIcon } from '@hugeicons/react';
import { Alert02Icon } from '@hugeicons/core-free-icons';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface AddFigmaFileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROLE_OPTIONS = [
  {
    value: 'primary',
    label: 'Primary',
    description: 'Main source of truth for the design system',
  },
  {
    value: 'secondary',
    label: 'Secondary',
    description: 'Additional design file with components',
  },
  {
    value: 'reference',
    label: 'Reference',
    description: 'Reference file for inspiration',
  },
];

export function AddFigmaFileModal({ isOpen, onClose }: AddFigmaFileModalProps) {
  const { currentWorkspace, addFigmaFile } = useWorkspaceStore();
  const [formData, setFormData] = useState({
    url: '',
    role: 'primary',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const extractFigmaFileKey = (url: string): { file_key: string; name: string } | null => {
    try {
      // Remove whitespace
      url = url.trim();

      // Support formats:
      // https://www.figma.com/file/ABC123/File-Name
      // https://figma.com/file/ABC123/File-Name
      // https://www.figma.com/design/ABC123/File-Name
      // https://figma.com/design/ABC123/File-Name

      const patterns = [
        /figma\.com\/file\/([a-zA-Z0-9]+)\/([^?/]+)/,
        /figma\.com\/design\/([a-zA-Z0-9]+)\/([^?/]+)/,
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
          const file_key = match[1];
          const name = decodeURIComponent(match[2].replace(/-/g, ' '));
          return { file_key, name };
        }
      }

      return null;
    } catch (e) {
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentWorkspace) {
      toast.error('No workspace selected');
      return;
    }

    if (!formData.url.trim()) {
      setError('Figma file URL is required');
      return;
    }

    const extracted = extractFigmaFileKey(formData.url);
    if (!extracted) {
      setError('Invalid Figma URL. Please use a valid Figma file or design URL.');
      return;
    }

    setLoading(true);
    try {
      await addFigmaFile(currentWorkspace.id, {
        figma_key: extracted.file_key,
        name: extracted.name,
        role: formData.role as 'primary' | 'secondary' | 'reference',
      });

      toast.success(`Figma file "${extracted.name}" added successfully`);
      onClose();

      // Reset form
      setFormData({
        url: '',
        role: 'primary',
      });
    } catch (error) {
      toast.error('Failed to add Figma file');
      console.error('Add Figma file error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Figma File</DialogTitle>
          <DialogDescription>
            Connect a Figma file to your workspace to sync variables and components.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* URL Input */}
          <div className="space-y-2">
            <Label htmlFor="url">Figma File URL *</Label>
            <Input
              id="url"
              type="text"
              value={formData.url}
              onChange={(e) => {
                setFormData({ ...formData, url: e.target.value });
                setError('');
              }}
              placeholder="https://figma.com/file/ABC123/Design-System"
              className={cn(error && 'border-destructive')}
              disabled={loading}
            />
            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive">
                <HugeiconsIcon icon={Alert02Icon} className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Paste the URL from your Figma file (file/... or design/... URLs supported)
            </p>
          </div>

          {/* Role Selection */}
          <div className="space-y-3">
            <Label>File Role *</Label>
            <div className="space-y-2">
              {ROLE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    'flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition',
                    formData.role === option.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-muted-foreground'
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={option.value}
                    checked={formData.role === option.value}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="mt-0.5"
                    disabled={loading}
                  />
                  <div>
                    <div className="font-medium">{option.label}</div>
                    <div className="text-sm text-muted-foreground">{option.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4">
            <div className="flex gap-3">
              <HugeiconsIcon icon={Alert02Icon} className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900 dark:text-blue-100">
                <p className="font-medium mb-1">How it works:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
                  <li>Paste your Figma file URL</li>
                  <li>We'll extract variables and components</li>
                  <li>Changes will sync automatically via the plugin</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !currentWorkspace}
              className="flex-1"
            >
              {loading ? 'Adding...' : 'Add File'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
