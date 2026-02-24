import { useState } from 'react';
import { useWorkspaceStore } from '../store/workspace-store';
import { X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Add Figma File</h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* URL Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Figma File URL *
            </label>
            <input
              type="text"
              value={formData.url}
              onChange={(e) => {
                setFormData({ ...formData, url: e.target.value });
                setError('');
              }}
              placeholder="https://figma.com/file/ABC123/Design-System"
              className={`
                w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
                ${error ? 'border-red-300' : 'border-gray-300'}
              `}
              disabled={loading}
            />
            {error && (
              <div className="mt-2 flex items-start gap-2 text-sm text-red-600">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Paste the URL from your Figma file (file/... or design/... URLs supported)
            </p>
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              File Role *
            </label>
            <div className="space-y-2">
              {ROLE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`
                    flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition
                    ${
                      formData.role === option.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
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
                    <div className="font-medium text-gray-900">{option.label}</div>
                    <div className="text-sm text-gray-500">{option.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">How it works:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>Paste your Figma file URL</li>
                  <li>We'll extract variables and components</li>
                  <li>Changes will sync automatically via the plugin</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !currentWorkspace}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add File'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
