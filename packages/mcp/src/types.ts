import { z } from 'zod';

// ── Workspace ──────────────────────────────────────────────────────────────────

export const WorkspaceInputSchema = z.object({
  workspaceId: z.string().describe('Target workspace UUID (get from get_workspaces)'),
});

// ── get_workspaces ─────────────────────────────────────────────────────────────

export const GetWorkspacesInputSchema = z.object({});

// ── get_design_system ──────────────────────────────────────────────────────────

export const GetDesignSystemInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
  include: z.array(z.enum(['variables', 'components', 'collections']))
    .default(['variables', 'components', 'collections'])
    .optional()
    .describe('Which parts of the design system to fetch'),
});

// ── set_tokens ─────────────────────────────────────────────────────────────────

export const TokenEntrySchema = z.object({
  variableName: z.string().describe(
    'Variable name e.g. "color/brand/primary", "spacing/4", "radius/md"'
  ),
  value: z.union([z.string(), z.number()]).describe(
    'Hex color string (e.g. "#2563EB") for COLOR tokens, or number for FLOAT tokens'
  ),
  type: z.enum(['COLOR', 'FLOAT', 'STRING']).optional().describe(
    'Variable type — inferred from value if omitted'
  ),
});

export const SetTokensInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
  tokens: z.array(TokenEntrySchema).min(1).describe('Array of token entries to create/update'),
});

// ── create_component ───────────────────────────────────────────────────────────

export const VariantPropertySchema = z.object({
  name: z.string().describe('Property name e.g. "Size", "Type", "State"'),
  type: z.enum(['VARIANT', 'BOOLEAN', 'TEXT', 'INSTANCE_SWAP']),
  values: z.array(z.string()).optional().describe('Possible values e.g. ["Small","Medium","Large"]'),
});

export const VariantSpecSchema = z.object({
  properties: z.record(z.string(), z.string()).describe(
    'Property key-value pairs e.g. { "Size": "Large", "Type": "Primary", "State": "Default" }'
  ),
});

export const CreateComponentInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
  pageName: z.string().describe('Figma page name e.g. "Buttons", "Forms", "Data Display"'),
  componentName: z.string().describe('Component name e.g. "Button", "Input", "Badge"'),
  description: z.string().optional(),
  width: z.number().optional().describe('Component width in pixels (default: auto)'),
  variants: z.array(VariantSpecSchema).optional().describe(
    'All variant combinations to create'
  ),
  properties: z.array(VariantPropertySchema).optional().describe(
    'Property definitions — defines the grid layout of variants'
  ),
  tokenMappings: z.record(z.string(), z.string()).optional().describe(
    'Component token → existing variable, e.g. { "button-primary-bg": "color/brand/primary" }'
  ),
});

// ── get_sync_status ────────────────────────────────────────────────────────────

export const GetSyncStatusInputSchema = z.object({
  workspaceId: z.string().optional().describe('Optional workspace UUID for last-sync info'),
});

// ── analyze_tokens ─────────────────────────────────────────────────────────────

export const AnalyzeTokensInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
  checks: z.array(z.enum(['completeness', 'naming', 'wcag_contrast', 'aliases']))
    .default(['completeness', 'naming', 'wcag_contrast', 'aliases'])
    .optional()
    .describe('Which checks to run'),
});

// ── rename_variable ────────────────────────────────────────────────────────────

export const RenameVariableInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
  oldName: z.string().describe('Current variable name e.g. "color/brand/blue"'),
  newName: z.string().describe('New variable name e.g. "color/brand/primary"'),
});

// ── delete_tokens ──────────────────────────────────────────────────────────────

export const DeleteTokensInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
  variableNames: z.array(z.string()).min(1).describe('Variable names to delete e.g. ["color/old/token", "spacing/legacy"]'),
});

// ── export_tokens ──────────────────────────────────────────────────────────────

export const ExportTokensInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
  format: z.enum(['css', 'json', 'tailwind', 'js']).describe(
    'Export format: "css" → CSS custom properties, "json" → Design Tokens Community Group format, "tailwind" → tailwind.config.js, "js" → ES module export'
  ),
  collections: z.array(z.string()).optional().describe(
    'Filter by collection names e.g. ["Primitives", "Semantic"]. If omitted, all collections are exported.'
  ),
});

// ── list_pages ─────────────────────────────────────────────────────────────────

export const ListPagesInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
});

// ── create_page ────────────────────────────────────────────────────────────────

export const CreatePageInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
  pageName: z.string().describe('Name for the new Figma page e.g. "Buttons", "Forms", "Icons"'),
});

// ── update_component ───────────────────────────────────────────────────────────

export const UpdateComponentInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
  componentName: z.string().describe('Name of the existing component set to update'),
  pageName: z.string().optional().describe('Page where the component lives (helps locate it)'),
  description: z.string().optional().describe('New description for the component'),
  tokenMappings: z.record(z.string(), z.string()).optional().describe(
    'Update token bindings: { "button-primary-bg": "color/brand/updated" }'
  ),
  addVariants: z.array(z.object({
    properties: z.record(z.string(), z.string()),
  })).optional().describe('New variant combinations to add to the existing component set'),
});
