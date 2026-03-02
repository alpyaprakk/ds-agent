# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DS Agent is an AI-powered design system management platform that bridges Claude AI with Figma through an MCP (Model Context Protocol) server. It enables direct manipulation of Figma design tokens, components, and variables through natural language conversations.

## Architecture

This is a **Turborepo monorepo** with 6 packages working together:

```
packages/
├── mcp/            # MCP server - bridges Claude Desktop to Figma plugin
├── server/         # Backend API with WebSocket & database
├── admin/          # Admin panel (React + Vite)
├── dashboard/      # User dashboard (React + Vite)
├── figma-plugin/   # Figma plugin with real-time sync
└── agent/          # AI agent core logic
```

### Data Flow

```
Claude Desktop (via MCP)
    ↓
MCP Server (@ds-agent/mcp)
    ↓ HTTP/WebSocket
Backend Server (@ds-agent/server)
    ↓ WebSocket
Figma Plugin (@ds-agent/figma-plugin)
    ↓ Figma Plugin API
Figma Document
```

## Common Commands

### Development

```bash
# Install dependencies (run from root)
npm install

# Build all packages
npm run build

# Run all packages in dev mode (uses Turborepo)
npm run dev

# Lint all packages
npm run lint

# Run tests
npm run test

# Clean all build artifacts
npm run clean
```

### Database Operations

```bash
# Run migrations
npm run db:migrate

# Seed database
npm run db:seed
```

### MCP Server Development

```bash
# Build MCP server (required before testing)
cd packages/mcp
npm run build

# The MCP server runs via stdio when invoked by Claude Desktop
# Configure in Claude Desktop settings:
# {
#   "mcpServers": {
#     "tokenhaus": {
#       "command": "node",
#       "args": ["/path/to/ds-agent/packages/mcp/dist/index.js"],
#       "env": {
#         "TOKENHAUS_SERVER_URL": "https://ds-agent.alpy.io",
#         "TOKENHAUS_EMAIL": "your-email",
#         "TOKENHAUS_PASSWORD": "your-password"
#       }
#     }
#   }
# }
```

## Key Architecture Patterns

### MCP Server Authentication Flow

The MCP server (`packages/mcp/src/auth.ts`) supports two authentication methods:

1. **Browser-based polling** (default): Generates a session URL, writes it to stderr, polls for completion
2. **Email/password** (fallback): Uses `TOKENHAUS_EMAIL` and `TOKENHAUS_PASSWORD` env vars

**Important**: The browser-based flow prints the login URL to stderr but does NOT automatically open a browser. Users must manually copy the URL.

### Figma Plugin Communication

The Figma plugin (`packages/figma-plugin/src/code.ts`) uses a message-passing architecture:

1. **Sync operations**: Full document sync on demand (`full-sync` message)
2. **Command execution**: Receives commands via `execute-command` message
3. **Variable cache**: Maintains a local cache (`_variableCache`) refreshed per command to avoid async lookups

**Critical**: Always call `refreshVariableCache()` at the start of any command that needs variable access.

### Layer Anatomy Engine

Components are created using a declarative `LayerSpec` structure. The engine (`packages/figma-plugin/src/code.ts:398-721`) recursively builds Figma nodes from this spec.

**Key concepts**:
- `layers[0]` is the root layer — its properties apply to the ComponentNode
- Fill/stroke/textColor accept **token names** (e.g., `"color/brand/primary"`) or hex codes
- `variantCondition` controls per-variant visibility
- `variantStyles` applies style overrides per variant
- `componentRef` embeds existing Figma components as instances

### Token Resolution Strategy

When creating component tokens (`packages/figma-plugin/src/code.ts:143-196`):

1. **Name-based lookup**: Exact → suffix → partial match
2. **Fallback lookup**: Try `spec.fallbacks` list
3. **Create new token**: If not found
4. **Alias to semantic token**: If `spec.aliasFor` is provided and target exists
5. **Fallback to raw value**: If aliasing fails

**Important**: Component tokens are NEVER reused by value — each gets its own identity so it can be properly aliased.

### WebSocket Sync Architecture

Real-time sync (`packages/server/src/sync/orchestrator.ts`):

1. Figma plugin sends changes via WebSocket
2. Server validates and stores in PostgreSQL
3. Server broadcasts to connected clients
4. Dashboard receives updates and refreshes UI

**Conflict resolution** (`packages/server/src/sync/conflict-detector.ts`):
- **LOW**: Auto-resolve + notify
- **MEDIUM**: Auto-resolve + ask confirmation
- **HIGH**: Manual resolution required

## Environment Variables

### MCP Server (`packages/mcp/.env`)

```env
TOKENHAUS_SERVER_URL=https://ds-agent.alpy.io
TOKENHAUS_EMAIL=your-email
TOKENHAUS_PASSWORD=your-password
NODE_ENV=production
```

### Backend Server (`packages/server/.env`)

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dsagent
PORT=3000
WS_PORT=3001
NODE_ENV=development
FIGMA_TOKEN=your_figma_token
CLAUDE_API_KEY=your_claude_api_key
JWT_SECRET=your_secret_key
```

### Dashboard/Admin (`packages/dashboard/.env`, `packages/admin/.env`)

```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3001
```

## Important Implementation Details

### MCP Tool Workflow

When implementing new MCP tools (`packages/mcp/src/tools/*`):

1. Define Zod schema in `packages/mcp/src/types.ts`
2. Create tool handler in `packages/mcp/src/tools/`
3. Register in `packages/mcp/src/index.ts`
4. Tool calls backend API via `client.ts` (HTTP with JWT auth)

### Figma Plugin Command Execution

All commands go through `executeCommand()` in `packages/figma-plugin/src/code.ts:969-1171`:

1. Refresh variable cache
2. Execute command type-specific logic
3. Return `{ success, message, data? }`
4. Plugin triggers auto-sync 1.5s after successful command

### Component Creation Requirements

**CRITICAL**: The `layers` parameter is MANDATORY for all component creation:

```typescript
// ❌ WRONG - creates blank rectangle
{ componentName: "Button" }

// ✅ CORRECT - includes full anatomy
{
  componentName: "Button",
  layers: [{
    type: "frame",
    name: "Button",
    layout: "horizontal",
    paddingH: 16,
    paddingV: 8,
    fill: "color/brand/primary",
    children: [
      { type: "text", name: "Label", text: "Button" }
    ]
  }]
}
```

### Token Naming Conventions

The plugin infers collection names from token names:

- `button-*`, `input-*`, `badge-*` → **Components** collection
- `spacing/*`, `radius/*`, `font-size/*` → **Spacing & Radius** collection
- Everything else → **Primitives** collection

## Testing & Debugging

### MCP Server Testing

```bash
# Build first
cd packages/mcp
npm run build

# Test via Claude Desktop
# Check stderr output in:
# ~/Library/Logs/Claude/mcp*.log
```

### Figma Plugin Testing

1. Open Figma Desktop
2. Plugins → Development → Import plugin from manifest
3. Select `packages/figma-plugin/manifest.json`
4. Open plugin UI to test

**Debugging**: Use `console.log()` in plugin code — output appears in Figma DevTools (Plugins → Development → Open Console)

### Backend API Testing

```bash
# Start server
cd packages/server
npm run dev

# Test endpoints
curl http://localhost:3000/api/workspaces
```

## Common Pitfalls

1. **Forgot to build MCP server**: Always run `npm run build` in `packages/mcp` after changes
2. **Variable cache not refreshed**: Call `refreshVariableCache()` before any variable operations
3. **Missing layers parameter**: Component creation will fail without `layers` array
4. **Token name mismatch**: Use exact token names from workspace variables (check via `get_design_system`)
5. **Browser login not working**: MCP server prints URL to stderr but doesn't open browser — users must copy URL manually

## Project Structure Rationale

- **Monorepo**: Shared TypeScript types and tooling across packages
- **Turborepo**: Parallel builds with smart caching
- **MCP over REST**: Claude Desktop natively supports MCP protocol
- **Variable cache**: Avoids expensive async Figma API calls in tight loops
- **Layer anatomy**: Declarative component structure easier for AI to generate than imperative Figma API calls

## Related Documentation

- [PROJECT_PLAN.md](./PROJECT_PLAN.md) - Complete project architecture
- [WORKSPACE_ARCHITECTURE.md](./WORKSPACE_ARCHITECTURE.md) - Multi-workspace design
- [SYNC_STRATEGY.md](./SYNC_STRATEGY.md) - Real-time sync and conflict resolution
- [FINAL_CONFIGURATION.md](./FINAL_CONFIGURATION.md) - Implementation decisions
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Dokploy deployment guide
