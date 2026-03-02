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

// Recursive LayerSpec schema — describes the internal anatomy of any component.
// AI can use this to create Toast, Avatar, Tag, Switch, Tooltip, List Item, etc.
// Per-variant style override object — all fields optional, applied on top of base layer styles
const VariantStyleOverrideSchema = z.object({
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWeight: z.number().optional(),
  textColor: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)]).optional(),
  opacity: z.number().min(0).max(1).optional(),
  cornerRadius: z.union([z.number(), z.string()]).optional(),
  paddingH: z.number().optional(),
  paddingV: z.number().optional(),
  paddingLeft: z.number().optional(),
  paddingRight: z.number().optional(),
  paddingTop: z.number().optional(),
  paddingBottom: z.number().optional(),
  itemSpacing: z.number().optional(),
  width: z.union([z.number(), z.enum(['fill', 'hug'])]).optional(),
  height: z.union([z.number(), z.enum(['fill', 'hug'])]).optional(),
  text: z.string().optional(),
});

const LayerSpecSchemaBase = z.object({
  type: z.enum(['frame', 'text', 'rectangle', 'ellipse', 'divider', 'icon', 'componentRef']).describe(
    'Node type: frame=container, text=text node, rectangle/ellipse=shape, divider=1px line, icon=icon placeholder, componentRef=embed existing Figma component instance'
  ),
  name: z.string().describe('Layer name in Figma'),
  layout: z.enum(['horizontal', 'vertical', 'none']).optional().describe('Auto layout direction (frames only)'),
  width: z.union([z.number(), z.enum(['fill', 'hug'])]).optional().describe('Width in px, or "fill" to fill parent, "hug" to hug contents'),
  height: z.union([z.number(), z.enum(['fill', 'hug'])]).optional().describe('Height in px, or "fill" to fill parent, "hug" to hug contents'),
  x: z.number().optional().describe('Absolute X position — only used when parent has layout:"none"'),
  y: z.number().optional().describe('Absolute Y position — only used when parent has layout:"none"'),
  primaryAlign: z.enum(['min', 'center', 'max', 'space-between']).optional().describe('Primary axis alignment'),
  counterAlign: z.enum(['min', 'center', 'max']).optional().describe('Counter axis alignment'),
  paddingH: z.number().optional().describe('Horizontal padding (left+right)'),
  paddingV: z.number().optional().describe('Vertical padding (top+bottom)'),
  paddingLeft: z.number().optional(),
  paddingRight: z.number().optional(),
  paddingTop: z.number().optional(),
  paddingBottom: z.number().optional(),
  itemSpacing: z.number().optional().describe('Gap between children'),
  fill: z.string().optional().describe('Fill color — hex (#ffffff) or token name (e.g. "color/surface/default")'),
  stroke: z.string().optional().describe('Stroke color — hex or token name'),
  strokeWeight: z.number().optional(),
  cornerRadius: z.union([z.number(), z.string()]).optional().describe(
    'Corner radius — number for fixed px (e.g. 8), or token name for variable-bound radius (e.g. "radius/md"). Use 9999 for pill shapes.'
  ),
  opacity: z.number().min(0).max(1).optional(),
  text: z.string().optional().describe('Text content (text nodes only)'),
  fontSize: z.number().optional(),
  fontWeight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)]).optional(),
  textColor: z.string().optional().describe('Text color — hex or token name'),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  clip: z.boolean().optional().describe('Clip children to bounds'),
  variantText: z.record(z.string(), z.string()).optional().describe(
    'Per-variant text overrides. Key format: "PropName=Value" e.g. { "State=Error": "Error message" }. ' +
    'Applies to the current layer\'s text content when the variant matches.'
  ),
  variantCondition: z.record(z.string(), z.boolean()).optional().describe(
    'Per-variant visibility control. Key format: "PropName=Value", value is true (show) or false (hide). ' +
    'Example: { "State=Error": true, "State=Default": false } — shows this layer only on Error state. ' +
    'If no key matches the current variant, the layer is always shown.'
  ),
  variantStyles: z.record(z.string(), VariantStyleOverrideSchema).optional().describe(
    'Per-variant style overrides — changes fill/stroke/textColor/padding/size/opacity per variant. ' +
    'Key format: "PropName=Value" or comma-joined "PropA=V1,PropB=V2" for multi-condition. ' +
    'All matching keys are merged (later keys win). ' +
    'Example: { "Type=Primary": { fill: "color/brand/primary", textColor: "color/text/inverse" }, ' +
    '"Type=Secondary": { fill: "transparent", stroke: "color/border/default" }, ' +
    '"Size=Large": { paddingH: 24, paddingV: 12, fontSize: 16 }, ' +
    '"Size=Small": { paddingH: 8, paddingV: 4, fontSize: 12 } }. ' +
    'Use this on the ROOT layer to vary the component background/border per variant. ' +
    'Use on child layers to vary icon color, label color, or badge visibility per variant.'
  ),
  componentRef: z.object({
    componentName: z.string().describe('Exact name of the Figma ComponentSet to embed e.g. "Button", "Input"'),
    variantProps: z.record(z.string(), z.string()).optional().describe(
      'Variant property values to select the right variant e.g. { "Type": "Primary", "Size": "Medium", "State": "Default" }'
    ),
  }).optional().describe(
    'Embed an existing Figma component as a real instance. type must be "componentRef". ' +
    'The plugin finds the named ComponentSet and creates an instance of the best matching variant. ' +
    'If the component does not exist yet, a placeholder frame is used.'
  ),
});

// Flatten to 3 levels deep so zod-to-json-schema can render children without recursive $ref
// (z.lazy() collapses to `any` in JSON Schema, hiding the nested layer structure from the AI)
const LayerSpecL3 = LayerSpecSchemaBase; // leaf — no children
const LayerSpecL2 = LayerSpecSchemaBase.extend({
  children: z.array(LayerSpecL3).optional().describe('Nested child layers (depth 3)'),
});
const LayerSpecSchema = LayerSpecSchemaBase.extend({
  children: z.array(LayerSpecL2).optional().describe('Nested child layers'),
});
type LayerSpecInput = z.input<typeof LayerSpecSchema>;

export const CreateComponentInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
  pageName: z.string().describe('Figma page name e.g. "Buttons", "Forms", "Data Display"'),
  componentName: z.string().describe('Component name e.g. "Button", "Input", "Badge", "Toast", "Avatar", "Tag"'),
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
  layers: z.array(LayerSpecSchema).describe(
    '⚠️ REQUIRED — always provide this. ' +
    'Layer anatomy describing the full internal structure of the component. ' +
    'Without this, components render as blank rectangles. ' +
    'The first element is the root/wrapper layer; its children become the component children. ' +
    'Fill/stroke/textColor/cornerRadius accept hex (#ffffff) or token names (color/surface/default). ' +
    'Use variantCondition to show/hide layers per variant state. ' +
    'Use componentRef to embed existing Figma components as real instances.'
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

// ── generate_code ──────────────────────────────────────────────────────────────

export const GenerateCodeInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
  nodeId: z.string().describe(
    'Figma node ID to generate code from (e.g. "123:456"). Can be a frame, component, or any design node.'
  ),
  framework: z.enum(['react', 'vue', 'svelte', 'html']).describe('Target framework for code generation'),
  styling: z.enum(['tailwind', 'css-modules', 'styled-components', 'css']).describe('Styling approach'),
  useTokens: z.boolean().default(true).optional().describe(
    'Map colors and spacing to design tokens (recommended: true)'
  ),
  includeTypes: z.boolean().default(true).optional().describe(
    'Generate TypeScript types for React/Vue/Svelte (ignored for HTML)'
  ),
  componentName: z.string().optional().describe(
    'Custom component name (default: auto-generated from node name)'
  ),
});

// ── instantiate_component ──────────────────────────────────────────────────────

export const InstantiateComponentInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
  componentKey: z.string().describe(
    'Component key or component name to instantiate. Can be a Figma component key or the exact component name.'
  ),
  variant: z.record(z.string(), z.string()).optional().describe(
    'Variant properties to select specific variant. E.g. { "Type": "Primary", "Size": "Large", "State": "Default" }'
  ),
  position: z.object({
    x: z.number().describe('X coordinate in pixels'),
    y: z.number().describe('Y coordinate in pixels'),
  }).optional().describe('Position where the instance should be placed'),
  size: z.object({
    width: z.number().describe('Width in pixels'),
    height: z.number().describe('Height in pixels'),
  }).optional().describe('Custom size for the instance (overrides component default)'),
  parentId: z.string().optional().describe(
    'Parent node ID to append the instance to. If not provided, adds to current page.'
  ),
  overrides: z.record(z.string(), z.any()).optional().describe(
    'Property overrides for the instance. E.g. text content, visibility, etc.'
  ),
});

// ── capture_screenshot ─────────────────────────────────────────────────────────

export const CaptureScreenshotInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
  nodeId: z.string().describe(
    'Figma node ID to capture (e.g. "123:456"). Can be any visible node: frame, component, group, etc.'
  ),
  format: z.enum(['PNG', 'JPG', 'SVG', 'PDF']).default('PNG').optional().describe(
    'Image format for the screenshot. PNG recommended for designs with transparency.'
  ),
  scale: z.number().min(1).max(4).default(2).optional().describe(
    'Export scale factor (1x, 2x, 3x, 4x). Higher values = higher resolution but larger file size. Default: 2x for retina displays.'
  ),
});

// ── get_node ───────────────────────────────────────────────────────────────────

export const GetNodeInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
  nodeId: z.string().describe(
    'Figma node ID to read (e.g. "123:456"). Can be any node: frame, component, text, shape, etc.'
  ),
  includeChildren: z.boolean().default(false).optional().describe(
    'Include immediate children in the response (default: false)'
  ),
  depth: z.number().min(1).max(3).default(1).optional().describe(
    'How many levels deep to traverse children (1-3, default: 1). Security: Limited to 3 to prevent memory exhaustion.'
  ),
});

// ── update_node ────────────────────────────────────────────────────────────────

const NodeUpdatesSchema = z.object({
  fills: z.array(z.object({
    type: z.enum(['SOLID', 'GRADIENT_LINEAR', 'GRADIENT_RADIAL', 'IMAGE']),
    color: z.string().optional().describe('Hex color for SOLID fills'),
    opacity: z.number().min(0).max(1).optional(),
  })).optional().describe('Fill paints - hex colors or token names'),
  strokes: z.array(z.object({
    type: z.enum(['SOLID']),
    color: z.string().describe('Hex color or token name'),
    opacity: z.number().min(0).max(1).optional(),
  })).optional().describe('Stroke paints'),
  strokeWeight: z.number().min(0).optional().describe('Stroke thickness in pixels'),
  cornerRadius: z.number().min(0).optional().describe('Corner radius in pixels'),
  opacity: z.number().min(0).max(1).optional().describe('Node opacity (0-1)'),
  x: z.number().optional().describe('X position in pixels'),
  y: z.number().optional().describe('Y position in pixels'),
  width: z.number().min(0).optional().describe('Width in pixels'),
  height: z.number().min(0).optional().describe('Height in pixels'),
  rotation: z.number().optional().describe('Rotation in degrees'),
  characters: z.string().optional().describe('Text content'),
  fontSize: z.number().min(1).optional().describe('Font size in pixels'),
  fontWeight: z.number().optional().describe('Font weight (400, 500, 600, 700)'),
  textColor: z.string().optional().describe('Text color - hex or token name'),
  name: z.string().optional().describe('Node name'),
  visible: z.boolean().optional().describe('Visibility'),
  locked: z.boolean().optional().describe('Lock state'),
});

export const UpdateNodeInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
  nodeId: z.string().describe('Figma node ID to update (e.g. "123:456")'),
  updates: NodeUpdatesSchema.describe('Properties to update - only specified properties will be changed'),
}).describe('Update visual, layout, and text properties of any Figma node');

// ── batch_update_nodes ─────────────────────────────────────────────────────────

export const BatchUpdateNodesInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
  nodes: z.array(z.object({
    nodeId: z.string().describe('Figma node ID to update'),
    updates: NodeUpdatesSchema,
  })).min(1).max(50).describe('Array of node update specs (max 50 nodes per batch)'),
}).describe('Update multiple nodes in a single batch operation');

// ── list_files ─────────────────────────────────────────────────────────────────

export const ListFilesInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
}).describe('List all Figma files associated with a workspace');

// ── get_console_logs ───────────────────────────────────────────────────────────

export const GetConsoleLogsInputSchema = z.object({
  workspaceId: z.string().describe('Workspace UUID'),
  limit: z.number().min(1).max(1000).optional().describe('Maximum number of logs to return (default: 100, max: 1000)'),
  level: z.enum(['all', 'log', 'info', 'warn', 'error']).optional().describe('Filter by log level (default: all)'),
  source: z.enum(['all', 'plugin', 'server']).optional().describe('Filter by source (default: all)'),
}).describe('Retrieve recent console logs from Figma plugin and server for debugging');
