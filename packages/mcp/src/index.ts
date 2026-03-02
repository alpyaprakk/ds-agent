#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import {
  GetWorkspacesInputSchema,
  GetDesignSystemInputSchema,
  SetTokensInputSchema,
  CreateComponentInputSchema,
  GetSyncStatusInputSchema,
  AnalyzeTokensInputSchema,
  RenameVariableInputSchema,
  DeleteTokensInputSchema,
  ExportTokensInputSchema,
  ListPagesInputSchema,
  CreatePageInputSchema,
  UpdateComponentInputSchema,
  GenerateCodeInputSchema,
  InstantiateComponentInputSchema,
  CaptureScreenshotInputSchema,
  GetNodeInputSchema,
  UpdateNodeInputSchema,
  BatchUpdateNodesInputSchema,
  ListFilesInputSchema,
  GetConsoleLogsInputSchema,
} from './types.js';

import { getWorkspaces }         from './tools/get-workspaces.js';
import { getDesignSystem }       from './tools/get-design-system.js';
import { setTokens }             from './tools/set-tokens.js';
import { createComponent }       from './tools/create-component.js';
import { getSyncStatus }         from './tools/get-sync-status.js';
import { analyzeTokens }         from './tools/analyze-tokens.js';
import { renameVariable }        from './tools/rename-variable.js';
import { deleteTokens }          from './tools/delete-tokens.js';
import { exportTokens }          from './tools/export-tokens.js';
import { listPages }             from './tools/list-pages.js';
import { createPage }            from './tools/create-page.js';
import { updateComponent }       from './tools/update-component.js';
import { generateCode }          from './tools/generate-code.js';
import { instantiateComponent }  from './tools/instantiate-component.js';
import { captureScreenshot }     from './tools/capture-screenshot.js';
import { getNode }               from './tools/get-node.js';
import { updateNode }            from './tools/update-node.js';
import { batchUpdateNodes }      from './tools/batch-update-nodes.js';
import { listFiles }             from './tools/list-files.js';
import { getConsoleLogs }        from './tools/get-console-logs.js';

const server = new McpServer({
  name: 'tokenhaus',
  version: '1.0.0',
});

// ── get_workspaces ─────────────────────────────────────────────────────────────
server.tool(
  'get_workspaces',
  'List all Tokenhaus workspaces available to the authenticated user. Use this first to get workspaceId values.',
  GetWorkspacesInputSchema.shape,
  async () => {
    const result = await getWorkspaces();
    return { content: [{ type: 'text', text: result }] };
  }
);

// ── get_design_system ──────────────────────────────────────────────────────────
server.tool(
  'get_design_system',
  [
    'Retrieve the current design system state: all variables (tokens), collections, and components from a workspace.',
    'ALWAYS call this before create_component so you can:',
    '  1. Use exact token names from tokensByRole (e.g. "color/bg/default", "color/text/primary") in layers fill/stroke/textColor fields.',
    '  2. Supply correct tokenMappings mapping component-scoped token names to workspace variable names.',
    '  3. Reference layerAnatomyExamples for correct layer JSON structure — these examples are pre-populated with real token names from this workspace.',
    '  4. See which components already exist (components list) before creating new ones.',
    'The tokensByRole map groups color tokens by semantic role — use it to pick the right token for each visual property.',
  ].join(' '),
  GetDesignSystemInputSchema.shape,
  async (input) => {
    const result = await getDesignSystem(input);
    return { content: [{ type: 'text', text: result }] };
  }
);

// ── set_tokens ─────────────────────────────────────────────────────────────────
server.tool(
  'set_tokens',
  'Create or update design tokens (Figma variables) in bulk. Supports COLOR (hex) and FLOAT (number) types. Tokens are organized into collections by naming prefix: color/* → Primitives, spacing/* and radius/* → Spacing & Radius, component prefixes → Components.',
  SetTokensInputSchema.shape,
  async (input) => {
    const result = await setTokens(input);
    return { content: [{ type: 'text', text: result }] };
  }
);

// ── create_component ───────────────────────────────────────────────────────────
server.tool(
  'create_component',
  [
    'Create a Figma component set with multiple variants on a specific page.',
    '',
    'CRITICAL RULE: You MUST always provide the `layers` parameter for every component.',
    'Without `layers`, components render as blank rectangles with no internal structure.',
    'REQUIRES `layers`: Button, Input, Checkbox, Badge, Avatar, Card, Toast, Tag, Switch, Tooltip, Drawer, ListItem, Modal, NavItem, TableRow, Screen, and ALL others.',
    '',
    'MANDATORY WORKFLOW:',
    '  1. ALWAYS call get_design_system FIRST — you need tokensByRole and layerAnatomyExamples.',
    '  2. Copy the relevant example from layerAnatomyExamples as your starting point.',
    '  3. Replace placeholder token names with EXACT token names from the workspace variables.',
    '  4. Use variantCondition to show/hide layers per variant state.',
    '  5. Use componentRef to embed existing Figma components (e.g. Button inside Drawer footer).',
    '',
    'LAYERS RULES:',
    '  - fill/stroke/textColor: MUST use exact token name from workspace variables OR hex (#rrggbb).',
    '  - layout "horizontal"/"vertical" enables auto-layout; "none" = absolute/free positioning.',
    '  - width/height: number=fixed px, "fill"=stretch to fill parent, "hug"=wrap content.',
    '  - variantCondition: { "PropName=Value": true/false } — controls per-variant layer visibility.',
    '  - componentRef: { componentName: "Button", variantProps: { "Type": "Primary" } } — real instance.',
    '  - Always set counterAlign and primaryAlign on every frame for correct child alignment.',
  ].join('\n'),
  CreateComponentInputSchema.shape,
  async (input) => {
    const result = await createComponent(input);
    return { content: [{ type: 'text', text: result }] };
  }
);

// ── get_sync_status ────────────────────────────────────────────────────────────
server.tool(
  'get_sync_status',
  'Check whether the Tokenhaus Figma plugin is currently connected and ready to receive commands. Check this before executing set_tokens or create_component.',
  GetSyncStatusInputSchema.shape,
  async (input) => {
    const result = await getSyncStatus(input);
    return { content: [{ type: 'text', text: result }] };
  }
);

// ── analyze_tokens ─────────────────────────────────────────────────────────────
server.tool(
  'analyze_tokens',
  'Evaluate the design token system quality: checks completeness against required semantic tokens, naming convention compliance, WCAG AA contrast ratios for key color pairs, and alias chain integrity for component tokens.',
  AnalyzeTokensInputSchema.shape,
  async (input) => {
    const result = await analyzeTokens(input);
    return { content: [{ type: 'text', text: result }] };
  }
);

// ── rename_variable ────────────────────────────────────────────────────────────
server.tool(
  'rename_variable',
  'Rename an existing Figma variable (design token). Useful for fixing naming convention violations or restructuring token hierarchy. The rename propagates automatically to all aliases pointing to this variable.',
  RenameVariableInputSchema.shape,
  async (input) => {
    const result = await renameVariable(input);
    return { content: [{ type: 'text', text: result }] };
  }
);

// ── delete_tokens ──────────────────────────────────────────────────────────────
server.tool(
  'delete_tokens',
  'Delete one or more design tokens (Figma variables) by name. Use with caution — deleting a token that is aliased by others will break those aliases. Always call get_design_system first to verify no critical aliases depend on the tokens you intend to delete.',
  DeleteTokensInputSchema.shape,
  async (input) => {
    const result = await deleteTokens(input);
    return { content: [{ type: 'text', text: result }] };
  }
);

// ── export_tokens ──────────────────────────────────────────────────────────────
server.tool(
  'export_tokens',
  'Export design tokens from the workspace in a developer-friendly format. Formats: "css" → CSS custom properties (:root { --color-brand-primary: #2563eb; }), "json" → Design Tokens Community Group format with type metadata, "tailwind" → tailwind.config.js with theme.extend, "js" → ES module export with camelCase keys. Does NOT require the Figma plugin — reads from the synced database.',
  ExportTokensInputSchema.shape,
  async (input) => {
    const result = await exportTokens(input);
    return { content: [{ type: 'text', text: result }] };
  }
);

// ── list_pages ─────────────────────────────────────────────────────────────────
server.tool(
  'list_pages',
  'List all pages in the currently open Figma file. Use this before create_component to see existing pages and avoid duplicates. Returns page names and IDs.',
  ListPagesInputSchema.shape,
  async (input) => {
    const result = await listPages(input);
    return { content: [{ type: 'text', text: result }] };
  }
);

// ── create_page ────────────────────────────────────────────────────────────────
server.tool(
  'create_page',
  'Create a new page in the currently open Figma file. Call list_pages first to confirm the page does not already exist.',
  CreatePageInputSchema.shape,
  async (input) => {
    const result = await createPage(input);
    return { content: [{ type: 'text', text: result }] };
  }
);

// ── update_component ───────────────────────────────────────────────────────────
server.tool(
  'update_component',
  'Update an existing Figma component set: change token bindings, update description, or add new variant combinations. Use this instead of recreating the entire component when making incremental changes.',
  UpdateComponentInputSchema.shape,
  async (input) => {
    const result = await updateComponent(input);
    return { content: [{ type: 'text', text: result }] };
  }
);

// ── generate_code ──────────────────────────────────────────────────────────────
server.tool(
  'generate_code',
  [
    'Generate production-ready code from any Figma design node. Supports React, Vue, Svelte, and HTML with multiple styling approaches.',
    '',
    'This is a CRITICAL feature for the product vision: enabling users to create designs in Figma and get code output.',
    '',
    'WORKFLOW:',
    '  1. Select any Figma node (component, frame, or design)',
    '  2. Choose framework (react/vue/svelte/html) and styling (tailwind/css-modules/styled-components/css)',
    '  3. Enable useTokens=true to map colors/spacing to design tokens (recommended)',
    '  4. Receive production-ready code with proper structure, types (if TypeScript), and token references',
    '',
    'FEATURES:',
    '  - Auto-detects component hierarchy and generates nested components',
    '  - Maps design tokens to CSS variables or framework-specific token usage',
    '  - Generates TypeScript types for React/Vue/Svelte',
    '  - Extracts image assets with URLs',
    '  - Preserves design system consistency via token mapping',
  ].join('\n'),
  GenerateCodeInputSchema.shape,
  async (input) => {
    const result = await generateCode(input);
    return { content: [{ type: 'text', text: result }] };
  }
);

// ── instantiate_component ──────────────────────────────────────────────────────
server.tool(
  'instantiate_component',
  [
    'Create an instance of an existing Figma component. Essential for design reusability and building complex layouts from design system components.',
    '',
    'WORKFLOW:',
    '  1. Provide componentKey (component name or Figma key)',
    '  2. Optionally specify variant properties to select the right variant',
    '  3. Optionally set position and size',
    '  4. Optionally provide parentId to nest the instance',
    '',
    'FEATURES:',
    '  - Automatically finds the best matching variant based on provided properties',
    '  - Supports custom positioning and sizing',
    '  - Can be added to specific parent nodes or current page',
    '  - Supports property overrides (text content, visibility, etc.)',
    '',
    'EXAMPLE:',
    '  Create a Primary Large Button instance:',
    '  {',
    '    "componentKey": "Button",',
    '    "variant": { "Type": "Primary", "Size": "Large", "State": "Default" },',
    '    "position": { "x": 100, "y": 200 }',
    '  }',
  ].join('\n'),
  InstantiateComponentInputSchema.shape,
  async (input) => {
    const result = await instantiateComponent(input);
    return { content: [{ type: 'text', text: result }] };
  }
);

// ── capture_screenshot ─────────────────────────────────────────────────────────
server.tool(
  'capture_screenshot',
  [
    'Capture a high-quality screenshot of any Figma node. Essential for visual validation, design documentation, and AI feedback loops.',
    '',
    'WORKFLOW:',
    '  1. Provide nodeId (any visible node: frame, component, group, etc.)',
    '  2. Choose format (PNG/JPG/SVG/PDF) - default: PNG',
    '  3. Choose scale (1x-4x) - default: 2x for retina displays',
    '  4. Receive base64-encoded image data',
    '',
    'FEATURES:',
    '  - Supports PNG (with transparency), JPG, SVG (vector), and PDF formats',
    '  - Configurable scale: 1x (standard), 2x (retina), 3x/4x (ultra-high-res)',
    '  - Returns base64 data URI - ready to embed or save',
    '  - Includes dimensions and file size estimate',
    '',
    'SECURITY:',
    '  - Scale limited to 1-4x to prevent memory exhaustion',
    '  - Automatic timeout for oversized nodes',
    '',
    'EXAMPLE:',
    '  Capture high-res PNG of a component:',
    '  {',
    '    "nodeId": "123:456",',
    '    "format": "PNG",',
    '    "scale": 3',
    '  }',
  ].join('\n'),
  CaptureScreenshotInputSchema.shape,
  async (input) => {
    const result = await captureScreenshot(input);
    return { content: [{ type: 'text', text: result }] };
  }
);

// ── get_node ───────────────────────────────────────────────────────────────────
server.tool(
  'get_node',
  [
    'Read properties and metadata from any Figma node. Essential for design-to-code workflows and understanding the structure of existing designs.',
    '',
    'WORKFLOW:',
    '  1. Provide nodeId (any node: frame, component, text, shape, etc.)',
    '  2. Optionally include children (includeChildren: true)',
    '  3. Optionally traverse deeper (depth: 1-3, default: 1)',
    '  4. Receive comprehensive node data: type, name, dimensions, styles, fills, strokes, effects, constraints, etc.',
    '',
    'FEATURES:',
    '  - Reads all visual properties: fills, strokes, effects, corner radius, opacity, blend mode',
    '  - Returns layout data: width, height, x, y, rotation, constraints',
    '  - Includes text properties for text nodes: content, font family, font size, font weight, line height, letter spacing',
    '  - Returns children hierarchy (configurable depth 1-3)',
    '  - Extracts variable bindings (design token references)',
    '  - Auto-detect component instances and variant properties',
    '',
    'SECURITY:',
    '  - Depth limited to 3 levels to prevent memory exhaustion',
    '  - Automatic timeout for oversized node trees',
    '',
    'USE CASES:',
    '  - Inspect design properties before code generation',
    '  - Understand component structure and variants',
    '  - Extract token usage from existing designs',
    '  - Verify design implementation matches specs',
    '',
    'EXAMPLE:',
    '  Read a button component with its children:',
    '  {',
    '    "nodeId": "123:456",',
    '    "includeChildren": true,',
    '    "depth": 2',
    '  }',
  ].join('\n'),
  GetNodeInputSchema.shape,
  async (input) => {
    const result = await getNode(input);
    return { content: [{ type: 'text', text: result }] };
  }
);

// ── update_node ────────────────────────────────────────────────────────────────
server.tool(
  'update_node',
  [
    'Update visual, layout, and text properties of any Figma node. Essential for programmatic design editing and batch modifications.',
    '',
    'WORKFLOW:',
    '  1. Provide nodeId of the node to update',
    '  2. Specify which properties to change in the updates object',
    '  3. Only provided properties will be modified - others remain unchanged',
    '',
    'UPDATABLE PROPERTIES:',
    '  Visual:',
    '    - fills: Array of paint objects (SOLID, GRADIENT, IMAGE)',
    '    - strokes: Array of stroke paint objects',
    '    - strokeWeight: Stroke thickness in pixels',
    '    - cornerRadius: Corner radius in pixels',
    '    - opacity: Node opacity (0-1)',
    '',
    '  Layout:',
    '    - x, y: Position in pixels',
    '    - width, height: Dimensions in pixels',
    '    - rotation: Rotation in degrees',
    '',
    '  Text (text nodes only):',
    '    - characters: Text content',
    '    - fontSize: Font size in pixels',
    '    - fontWeight: Font weight (400, 500, 600, 700)',
    '    - textColor: Text color (hex or token name)',
    '',
    '  Other:',
    '    - name: Node name',
    '    - visible: Visibility (true/false)',
    '    - locked: Lock state (true/false)',
    '',
    'COLOR VALUES:',
    '  - Use hex colors: "#FF0000"',
    '  - Or token names: "color/brand/primary"',
    '  - Plugin will resolve tokens automatically',
    '',
    'EXAMPLE:',
    '  Update a button background and text:',
    '  {',
    '    "nodeId": "123:456",',
    '    "updates": {',
    '      "fills": [{ "type": "SOLID", "color": "#2563EB" }],',
    '      "cornerRadius": 8,',
    '      "opacity": 0.9',
    '    }',
    '  }',
  ].join('\n'),
  UpdateNodeInputSchema.shape,
  async (input) => {
    const result = await updateNode(input);
    return { content: [{ type: 'text', text: result }] };
  }
);

// ── batch_update_nodes ─────────────────────────────────────────────────────────
server.tool(
  'batch_update_nodes',
  [
    'Update multiple Figma nodes in a single batch operation. Essential for bulk design edits and theming changes.',
    '',
    'WORKFLOW:',
    '  1. Provide an array of node update specs (max 50 nodes)',
    '  2. Each spec contains nodeId + updates object',
    '  3. All updates execute in parallel for maximum performance',
    '  4. Receive per-node success/failure results',
    '',
    'BENEFITS:',
    '  - Update up to 50 nodes in one command',
    '  - Atomic operation - all or nothing',
    '  - Detailed per-node error reporting',
    '  - Same update properties as update_node',
    '',
    'USE CASES:',
    '  - Apply theme colors to multiple components',
    '  - Batch resize multiple frames',
    '  - Update text content across multiple labels',
    '  - Change visibility of multiple nodes',
    '',
    'EXAMPLE:',
    '  Update 3 buttons with new colors:',
    '  {',
    '    "nodes": [',
    '      {',
    '        "nodeId": "123:1",',
    '        "updates": { "fills": [{ "type": "SOLID", "color": "#2563EB" }] }',
    '      },',
    '      {',
    '        "nodeId": "123:2",',
    '        "updates": { "fills": [{ "type": "SOLID", "color": "#10B981" }] }',
    '      },',
    '      {',
    '        "nodeId": "123:3",',
    '        "updates": { "opacity": 0.8 }',
    '      }',
    '    ]',
    '  }',
  ].join('\n'),
  BatchUpdateNodesInputSchema.shape,
  async (input) => {
    const result = await batchUpdateNodes(input);
    return { content: [{ type: 'text', text: result }] };
  }
);

// ── list_files ─────────────────────────────────────────────────────────────────
server.tool(
  'list_files',
  [
    'List all Figma files associated with a workspace. Essential for multi-file workflows and understanding workspace structure.',
    '',
    'WORKFLOW:',
    '  1. Provide workspaceId',
    '  2. Receive list of all files with comprehensive metadata',
    '',
    'FEATURES:',
    '  - Shows file role (primary = main design system, secondary = additional files, reference = read-only)',
    '  - Displays sync status (pending/syncing/success/error) and last sync timestamp',
    '  - Includes stats: variables count, collections count, components count',
    '  - Returns Figma URLs for direct access to each file',
    '  - Shows file type and configuration',
    '',
    'USE CASES:',
    '  - Discover available files before running operations',
    '  - Check sync status of multiple files in a workspace',
    '  - Understand workspace file organization and roles',
    '  - Identify the primary design system file',
    '  - Verify file accessibility before operations',
    '',
    'FILE ROLES:',
    '  - primary: Main design system file containing the source of truth for tokens and components',
    '  - secondary: Additional design files that use the primary design system',
    '  - reference: Read-only files for reference or inspiration',
    '',
    'EXAMPLE:',
    '  {',
    '    "workspaceId": "550e8400-e29b-41d4-a716-446655440000"',
    '  }',
  ].join('\n'),
  ListFilesInputSchema.shape,
  async (input) => {
    const result = await listFiles(input);
    return { content: [{ type: 'text', text: result }] };
  }
);

// ── get_console_logs ───────────────────────────────────────────────────────────
server.tool(
  'get_console_logs',
  [
    'Retrieve recent console logs from Figma plugin and server for debugging. Essential for troubleshooting command execution and understanding system behavior.',
    '',
    'WORKFLOW:',
    '  1. Provide workspaceId',
    '  2. Optionally filter by level (log/info/warn/error) and source (plugin/server)',
    '  3. Optionally limit number of logs returned (max 1000)',
    '  4. Receive chronological list of console logs with timestamps',
    '',
    'FEATURES:',
    '  - Real-time console log streaming from Figma plugin',
    '  - Server-side operation logging',
    '  - Filterable by log level and source',
    '  - Includes structured data payloads when available',
    '  - Timestamp for each log entry',
    '',
    'USE CASES:',
    '  - Debug command execution failures',
    '  - Monitor plugin-server communication',
    '  - Understand token resolution behavior',
    '  - Track component creation progress',
    '  - Investigate sync errors',
    '',
    'LOG LEVELS:',
    '  - log: General information and progress updates',
    '  - info: Important state changes and milestones',
    '  - warn: Warnings that don\'t stop execution',
    '  - error: Errors and failures',
    '',
    'EXAMPLE:',
    '  Get last 50 error logs from plugin:',
    '  {',
    '    "workspaceId": "550e8400-e29b-41d4-a716-446655440000",',
    '    "limit": 50,',
    '    "level": "error",',
    '    "source": "plugin"',
    '  }',
  ].join('\n'),
  GetConsoleLogsInputSchema.shape,
  async (input) => {
    const result = await getConsoleLogs(input);
    return { content: [{ type: 'text', text: result }] };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// MCP RESOURCES & PROMPTS (Future Enhancement)
// ══════════════════════════════════════════════════════════════════════════════

// NOTE: Resources and Prompts temporarily disabled due to MCP SDK typing constraints
// All pre-built workflows are available via the 19 MCP tools above
// Future enhancement: Add proper Resource/Prompt typing when SDK is updated

// Planned Resources:
// - tokenhaus://tokens/{workspaceId} - Browseable token hierarchy
// - tokenhaus://components/{workspaceId} - Browseable component library

// Planned Prompts:
// - create-design-system-dashboard - Generate token browser + component gallery
// - audit-design-system - Comprehensive quality report
// - migrate-colors-to-tokens - Smart hex→token replacement
// - generate-design-system-from-scratch - Bootstrap complete design system

// ── Start ──────────────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[tokenhaus-mcp] ✅ Connected via stdio\n');
}

main().catch(err => {
  process.stderr.write(`[tokenhaus-mcp] Fatal: ${err}\n`);
  process.exit(1);
});
