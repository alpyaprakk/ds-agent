# DS Agent

AI-powered Design System Agent with Figma integration and real-time sync.

## 🎯 Overview

DS Agent is an intelligent design system management platform that combines:
- **AI Agent (Claude)**: Smart design system assistant
- **Figma Plugin**: Direct integration with Figma files
- **Dashboard**: Web-based control center
- **Real-time Sync**: WebSocket-based bidirectional sync
- **Multi-workspace**: Manage multiple design systems

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│           Dashboard (React)              │
│         WebSocket + REST API             │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────┴──────────────────────┐
│      Server (Node.js + Express)         │
│   WebSocket + PostgreSQL + Agent        │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────┴──────────────────────┐
│        Figma Plugin (TypeScript)        │
│     Document Listener + Sync Client     │
└─────────────────────────────────────────┘
```

## 📦 Packages

- `@ds-agent/server` - Backend server with WebSocket and database
- `@ds-agent/agent` - AI agent core logic
- `@ds-agent/dashboard` - React dashboard
- `@ds-agent/figma-plugin` - Figma plugin

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- PostgreSQL >= 14
- npm >= 9

### Installation

```bash
# Clone repository
git clone <your-repo-url>
cd ds-agent

# Install dependencies
npm install

# Setup database
npm run db:migrate
npm run db:seed

# Initialize agent context
npm run agent:init

# Start development
npm run dev
```

### Environment Variables

Create `.env` files in each package:

**packages/server/.env:**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/dsagent
PORT=3000
WS_PORT=3001
NODE_ENV=development
FIGMA_TOKEN=your_figma_token
CLAUDE_API_KEY=your_claude_api_key
```

**packages/dashboard/.env:**
```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3001
```

## 📚 Documentation

- [Project Plan](./PROJECT_PLAN.md) - Complete project architecture
- [Workspace Architecture](./WORKSPACE_ARCHITECTURE.md) - Multi-workspace design
- [Sync Strategy](./SYNC_STRATEGY.md) - Real-time sync and conflict resolution
- [Final Configuration](./FINAL_CONFIGURATION.md) - Implementation decisions

## 🎯 Key Features

### ✅ Multi-Workspace Support
Manage multiple design systems simultaneously, each with its own Figma files and rules.

### ✅ Smart AI Agent
Claude-powered agent that understands design systems, follows best practices, and suggests improvements.

### ✅ Real-Time Sync
Changes in Figma appear in dashboard within 2-3 seconds, and vice versa.

### ✅ Conflict Resolution (Strategy B+)
Intelligent conflict detection with severity-based resolution:
- **LOW**: Auto-resolve + notify
- **MEDIUM**: Auto-resolve + ask confirmation
- **HIGH**: Manual resolution required

### ✅ Variable Management
- Auto-detect missing variables
- Create proper aliases
- Validate coverage
- Organize collections

### ✅ Component Creation
- AI-driven component generation
- Auto-layout enforcement
- Variable binding
- Variant management

## 🔄 Workflow Example

```
User: "Create a Button component"

Agent:
1. ✓ Checking existing design system...
2. ✓ Found color/primary/* variables
3. ⚠️ Missing border/radius/md, creating...
4. ✓ Creating Button component with:
   - Variants: Default, Primary, Secondary
   - Sizes: Small, Medium, Large
   - States: Default, Hover, Active, Disabled
5. ✓ Applied auto-layout
6. ✓ Bound all values to variables
7. ✓ Component created successfully!

[View in Figma] [Modify]
```

## 📊 Database Schema

See [database/schema.sql](./database/schema.sql) for complete schema.

Key tables:
- `workspaces` - Workspace configuration
- `figma_files` - Linked Figma files
- `variables` - Variable cache
- `components` - Component cache
- `conflicts` - Conflict tracking
- `change_logs` - Audit trail

## 🛠️ Development

```bash
# Run all packages in dev mode
npm run dev

# Build all packages
npm run build

# Run linting
npm run lint

# Run tests
npm run test

# Clean build artifacts
npm run clean
```

## 📈 Roadmap

### Phase 1: Foundation (Weeks 1-2) ✅
- [x] Project structure
- [x] Database schema
- [x] Agent context system

### Phase 2: Core Agent (Weeks 3-4)
- [ ] Context loader
- [ ] Decision engine
- [ ] Variable analyzer
- [ ] Component creation logic

### Phase 3: Figma Plugin (Weeks 5-6)
- [ ] Plugin scaffold
- [ ] Document change listener
- [ ] Sync client
- [ ] API operations

### Phase 4: Dashboard (Weeks 7-8)
- [ ] UI components
- [ ] WebSocket integration
- [ ] Variable manager
- [ ] Conflicts page

### Phase 5: Integration (Weeks 9-10)
- [ ] End-to-end sync
- [ ] Conflict resolution
- [ ] Testing
- [ ] Bug fixes

### Phase 6: Polish (Weeks 11-12)
- [ ] UI refinements
- [ ] Documentation
- [ ] Examples
- [ ] Launch

## 🤝 Contributing

(Add your contributing guidelines here)

## 📄 License

(Add your license here)

## 🙏 Acknowledgments

Built with:
- [Claude AI](https://anthropic.com/claude) - AI agent
- [Figma Plugin API](https://figma.com/plugin-docs/) - Figma integration
- [React](https://react.dev/) - Dashboard UI
- [Socket.io](https://socket.io/) - Real-time sync
- [PostgreSQL](https://postgresql.org/) - Database
