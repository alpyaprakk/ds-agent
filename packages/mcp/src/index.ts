#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import 'dotenv/config';

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
} from './types.js';

import { getWorkspaces }    from './tools/get-workspaces.js';
import { getDesignSystem }  from './tools/get-design-system.js';
import { setTokens }        from './tools/set-tokens.js';
import { createComponent }  from './tools/create-component.js';
import { getSyncStatus }    from './tools/get-sync-status.js';
import { analyzeTokens }    from './tools/analyze-tokens.js';
import { renameVariable }   from './tools/rename-variable.js';
import { deleteTokens }     from './tools/delete-tokens.js';
import { exportTokens }     from './tools/export-tokens.js';
import { listPages }        from './tools/list-pages.js';
import { createPage }       from './tools/create-page.js';
import { updateComponent }  from './tools/update-component.js';

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
  'Retrieve the current design system state: all variables (tokens), collections, and components from a workspace. Always call this before creating components so you can supply correct tokenMappings.',
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
  'Create a Figma component set with multiple variants on a specific page. Supported components with built-in shadcn-accurate styling: Button, Input, Checkbox. For others a generic builder is used. Always call get_design_system first and supply tokenMappings mapping component token names to existing variable names.',
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
